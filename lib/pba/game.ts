import type {
  DerivedSet,
  GameAction,
  MatchConfig,
  PerSetConfig,
  Side,
  SideDerived,
  Turn,
} from "./types"
import { playersPerTeam, setPlayersPerSet } from "./types"

export function getSetConfig(config: MatchConfig, setIndex: number): PerSetConfig | undefined {
  return config.sets?.[setIndex]
}

export function getWinningScoreForSet(config: MatchConfig, setIndex: number): number {
  const sc = getSetConfig(config, setIndex)
  if (sc?.winningScore) return sc.winningScore
  return config.winningScore
}

export function isDoublesSet(config: MatchConfig, setIndex: number): boolean {
  const sc = getSetConfig(config, setIndex)
  if (sc) return sc.format === "doubles"
  return config.mode === "doubles"
}

export function getSetPlayers(
  config: MatchConfig,
  setIndex: number,
  side: Side,
): string[] {
  const sc = getSetConfig(config, setIndex)
  if (sc) {
    const list = side === "away" ? sc.awayPlayers : sc.homePlayers
    if (list && list.length > 0) return list.filter((p) => p && p.trim().length > 0)
  }
  const team = side === "away" ? config.away : config.home
  return team.players
}

function emptySide(): SideDerived {
  return {
    turns: [],
    total: 0,
    innings: 0,
    highRun: 0,
    average: 0,
    timeoutsUsed: 0,
    setTimeoutsUsed: 0,
  }
}

/**
 * Decide a winner for a set that has reached the max innings cap
 * with both teams having completed their 30th inning.
 * Priority: (1) higher total score, (2) higher high-run, (3) banking (PBA rule).
 * Returns null only if still undecidable (shouldn't normally happen after banking).
 */
export function decideSetWinnerByTieRules(
  away: SideDerived,
  home: SideDerived,
): Side | null {
  if (away.total !== home.total) {
    return away.total > home.total ? "away" : "home"
  }
  if (away.highRun !== home.highRun) {
    return away.highRun > home.highRun ? "away" : "home"
  }
  return null
}

export function deriveSet(
  actions: GameAction[],
  config: MatchConfig,
  firstBreak: Side = config.firstBreak,
  tieBreak: boolean = false,
  setIndex: number = 0,
): DerivedSet {
  const setCfg = getSetConfig(config, setIndex)
  const doubles = isDoublesSet(config, setIndex)
  const ppt = doubles ? 2 : 1
  const scotch = doubles
  const winningScore = getWinningScoreForSet(config, setIndex)
  const maxInnings = Math.max(1, config.maxInningsPerSet || 999)
  const second: Side = firstBreak === "away" ? "home" : "away"

  const away = emptySide()
  const home = emptySide()
  const sideData: Record<Side, SideDerived> = { away, home }
  const turnCount: Record<Side, number> = { away: 0, home: 0 }

  let currentSide: Side = firstBreak
  let currentInning = 1
  let currentPoints = 0
  let currentSequence: number[] = []
  let currentMarkers: string[] = []
  let currentPlayerSequence: number[] = []
  let winner: Side | null = null
  let decidedByBanking = false

  const scotchNext: Record<Side, number> = { away: 0, home: 0 }
  let turnStartPlayer = 0

  const playerIndexFor = (side: Side) => {
    if (scotch) return scotchNext[side]
    return turnCount[side] % ppt
  }

  const finalizeWinnerByInningCap = (): Side | null => {
    if (currentInning < maxInnings) return null
    if (away.innings < maxInnings || home.innings < maxInnings) return null
    const byRule = decideSetWinnerByTieRules(away, home)
    if (byRule) {
      return byRule
    }
    return null
  }

  for (const action of actions) {
    if (winner) break
    if (action.type === "point") {
      const sd = sideData[currentSide]
      const playerIdx = scotch ? scotchNext[currentSide] : turnCount[currentSide] % ppt
      if (currentSequence.length === 0 && currentPlayerSequence.length === 0) {
        turnStartPlayer = playerIdx
      }
      if (tieBreak) {
        currentPoints += action.value
        currentSequence.push(action.value)
        currentPlayerSequence.push(playerIdx)
        sd.total += action.value
      } else {
        const remaining = winningScore - sd.total
        const add = Math.max(0, Math.min(action.value, remaining))
        if (add > 0) {
          currentPoints += add
          currentSequence.push(add)
          currentPlayerSequence.push(playerIdx)
          sd.total += add
        }
      }
      if (scotch) {
        scotchNext[currentSide] = (scotchNext[currentSide] + 1) % ppt
      }
      if (!tieBreak && sd.total >= winningScore) {
        commitTurn(
          sd,
          currentSide,
          currentInning,
          turnStartPlayer,
          currentPoints,
          currentSequence,
          currentPlayerSequence,
          currentMarkers,
          turnCount,
        )
        currentPoints = 0
        currentSequence = []
        currentPlayerSequence = []
        currentMarkers = []
        winner = currentSide
      }
    } else if (action.type === "timeout") {
      const sd = sideData[action.side]
      const setLimit = 2
      const globalLimit = config.timeouts || 0
      if (sd.setTimeoutsUsed < setLimit && sd.timeoutsUsed < globalLimit) {
        sd.timeoutsUsed += 1
        sd.setTimeoutsUsed += 1
        currentMarkers.push("T")
      }
    } else {
      if (scotch) {
        if (currentSequence.length === 0) {
          turnStartPlayer = scotchNext[currentSide]
        }
        scotchNext[currentSide] = (scotchNext[currentSide] + 1) % ppt
      }
      const sd = sideData[currentSide]
      const startPlayer = scotch ? turnStartPlayer : turnCount[currentSide] % ppt
      commitTurn(
        sd,
        currentSide,
        currentInning,
        startPlayer,
        currentPoints,
        currentSequence,
        currentPlayerSequence,
        currentMarkers,
        turnCount,
      )
      currentPoints = 0
      currentSequence = []
      currentPlayerSequence = []
      currentMarkers = []
      if (currentSide === firstBreak) {
        currentSide = second
      } else {
        currentSide = firstBreak
        currentInning += 1
        if (tieBreak) {
          if (away.total > home.total) winner = "away"
          else if (home.total > away.total) winner = "home"
        }
        if (!winner) {
          const capped = finalizeWinnerByInningCap()
          if (capped) {
            winner = capped
            decidedByBanking = away.total === home.total && away.highRun === home.highRun
          }
        }
      }
    }
  }

  if (!winner) {
    const capped = finalizeWinnerByInningCap()
    if (capped) {
      winner = capped
      decidedByBanking = away.total === home.total && away.highRun === home.highRun
    }
  }

  finalizeStats(away)
  finalizeStats(home)

  return {
    away,
    home,
    currentSide,
    currentInning,
    currentPlayerIndex: winner ? 0 : playerIndexFor(currentSide),
    currentPoints,
    currentSequence,
    currentPlayerSequence,
    currentMarkers,
    winner,
    firstBreak,
    tieBreak,
    decidedByBanking,
  }
}

function commitTurn(
  sd: SideDerived,
  side: Side,
  inning: number,
  playerIndex: number,
  points: number,
  sequence: number[],
  playerSequence: number[],
  markers: string[],
  turnCount: Record<Side, number>,
): void {
  const turn: Turn = {
    side,
    inning,
    playerIndex,
    points,
    sequence: [...sequence],
    playerSequence: [...playerSequence],
    markers: [...markers],
    runningTotal: sd.total,
    done: true,
  }
  sd.turns.push(turn)
  sd.innings += 1
  turnCount[side] += 1
}

function finalizeStats(sd: SideDerived) {
  sd.highRun = sd.turns.reduce((max, t) => Math.max(max, t.points), 0)
  sd.average = sd.innings > 0 ? sd.total / sd.innings : 0
}

export function currentTurn(derived: DerivedSet): Turn | null {
  if (derived.winner) return null
  const sd = derived[derived.currentSide]
  return {
    side: derived.currentSide,
    inning: derived.currentInning,
    playerIndex: derived.currentPlayerIndex,
    points: derived.currentPoints,
    sequence: derived.currentSequence,
    playerSequence: derived.currentPlayerSequence,
    markers: derived.currentMarkers,
    runningTotal: sd.total,
    done: false,
  }
}

export function formatAverage(avg: number): string {
  return avg.toFixed(3)
}

export function firstBreakForSet(config: MatchConfig, setIndex: number): Side {
  if (setIndex % 2 === 0) return config.firstBreak
  return config.firstBreak === "away" ? "home" : "away"
}

export function countSetWins(
  completedSets: GameAction[][],
  config: MatchConfig,
): { away: number; home: number } {
  let away = 0
  let home = 0
  completedSets.forEach((actions, i) => {
    const d = deriveSet(actions, config, firstBreakForSet(config, i), false, i)
    if (d.winner === "away") away++
    else if (d.winner === "home") home++
  })
  return { away, home }
}

export function matchOutcome(
  completedSets: GameAction[][],
  config: MatchConfig,
): { winner: Side | null; tieBreak: boolean } {
  if (config.method === "point") {
    return { winner: null, tieBreak: false }
  }
  const wins = countSetWins(completedSets, config)
  if (wins.away >= config.winningSets) return { winner: "away", tieBreak: false }
  if (wins.home >= config.winningSets) return { winner: "home", tieBreak: false }
  const maxRegulationSets = config.sets?.length || config.winningSets * 2 - 1
  if (completedSets.length >= maxRegulationSets && wins.away === wins.home) {
    return { winner: null, tieBreak: true }
  }
  return { winner: null, tieBreak: false }
}

export function compareHighRuns(
  setActions: GameAction[][],
  config: MatchConfig,
): Side | null {
  const highRuns: Record<Side, number[]> = { away: [], home: [] }
  setActions.forEach((actions, i) => {
    const d = deriveSet(actions, config, firstBreakForSet(config, i), false, i)
    highRuns.away.push(d.away.highRun)
    highRuns.home.push(d.home.highRun)
  })
  const awaySorted = [...highRuns.away].sort((a, b) => b - a)
  const homeSorted = [...highRuns.home].sort((a, b) => b - a)
  const len = Math.max(awaySorted.length, homeSorted.length)
  for (let i = 0; i < len; i++) {
    const a = awaySorted[i] ?? 0
    const h = homeSorted[i] ?? 0
    if (a > h) return "away"
    if (h > a) return "home"
  }
  return null
}
