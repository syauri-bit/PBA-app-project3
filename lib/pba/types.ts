export type GameMode = "single" | "doubles" | "teamIndividual"

export type SetFormat = "single" | "doubles"

export type Method = "point" | "set"

export type Side = "away" | "home"

export interface TeamConfig {
  name: string
  players: string[]
}

export interface PerSetConfig {
  format: SetFormat
  winningScore: number
  label?: string
  awayPlayers: string[]
  homePlayers: string[]
}

export interface MatchConfig {
  mode: GameMode
  method: Method
  winningScore: number
  winningSets: number
  firstBreak: Side
  ballSide: Side
  timeouts: number
  refereeMain: string
  refereeSub: string
  refereeRecorder: string
  recorders: string[]
  memo: string
  round: string
  roundDay: string
  maxInningsPerSet: number
  sets: PerSetConfig[]
  away: TeamConfig
  home: TeamConfig
}

export type GameAction =
  | { type: "point"; value: 1 | 2 }
  | { type: "endturn" }
  | { type: "timeout"; side: Side }

export interface Turn {
  side: Side
  inning: number
  playerIndex: number
  points: number
  sequence: number[]
  playerSequence: number[]
  markers: string[]
  runningTotal: number
  done: boolean
}

export interface SideDerived {
  turns: Turn[]
  total: number
  innings: number
  highRun: number
  average: number
  timeoutsUsed: number
  setTimeoutsUsed: number
}

export interface DerivedSet {
  away: SideDerived
  home: SideDerived
  currentSide: Side
  currentInning: number
  currentPlayerIndex: number
  currentPoints: number
  currentSequence: number[]
  currentPlayerSequence: number[]
  currentMarkers: string[]
  winner: Side | null
  firstBreak: Side
  tieBreak: boolean
  decidedByBanking?: boolean
}

export interface CompletedSet {
  derived: DerivedSet
  winner: Side | null
}

export interface GameState {
  config: MatchConfig
  completedSets: GameAction[][]
  actions: GameAction[]
  finished: boolean
}

export const MODE_LABELS: Record<GameMode, string> = {
  single: "1부투어 (개인전)",
  doubles: "팀리그 (복식)",
  teamIndividual: "팀리그 (개인)",
}

export const TEAM_COLORS: Record<Side, string> = {
  away: "#1E88E5",
  home: "#E53935",
}

export function playersPerTeam(mode: GameMode): number {
  return mode === "doubles" ? 2 : 1
}

export function setPlayersPerSet(setConfig?: PerSetConfig): number {
  if (!setConfig) return 1
  return setConfig.format === "doubles" ? 2 : 1
}
