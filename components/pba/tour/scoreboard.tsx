"use client"

import { useEffect, useRef } from "react"
import type { DerivedSet, MatchConfig, Side, Turn } from "@/lib/pba/types"
import { TEAM_COLORS } from "@/lib/pba/types"
import { isDoublesSet, getSetPlayers } from "@/lib/pba/game"
import { withAlpha } from "@/lib/pba/colors"
import { useTheme } from "./theme-context"

interface ScoreboardProps {
  config: MatchConfig
  derived: DerivedSet
  current: Turn | null
  setIndex?: number
}

function DoublesLetter(idx: number): "A" | "B" {
  return idx === 0 ? "A" : "B"
}

function playerName(config: MatchConfig, setIndex: number, side: Side, playerIndex: number): string {
  const list = getSetPlayers(config, setIndex ?? 0, side)
  return list[playerIndex] ?? list[0] ?? "선수"
}

function playerShortName(config: MatchConfig, setIndex: number, side: Side, playerIndex: number): string {
  const name = playerName(config, setIndex, side, playerIndex)
  return name.length <= 2 ? name : name.slice(0, 2)
}

function TurnCell({
  config,
  setIndex,
  side,
  turn,
  isCurrent,
  fg,
  accent,
}: {
  config: MatchConfig
  setIndex: number
  side: Side
  turn: Turn | null
  isCurrent: boolean
  fg: string
  accent: string
}) {
  const isDoubles = isDoublesSet(config, setIndex)
  if (!turn) {
    return (
      <div
        className="min-h-[3.5rem] rounded-md border border-dashed opacity-30"
        style={{ borderColor: fg }}
        id={isCurrent ? `current-${side}` : undefined}
      />
    )
  }
  const highlight = isCurrent ? accent : fg
  const pName = isDoubles
    ? `${playerShortName(config, setIndex, side, turn.playerIndex)}#${DoublesLetter(turn.playerIndex)}`
    : playerName(config, setIndex, side, turn.playerIndex)
  return (
    <div
      ref={(el) => {
        if (isCurrent && el) {
          requestAnimationFrame(() => {
            el.scrollIntoView({ behavior: "smooth", block: "center" })
          })
        }
      }}
      className="min-h-[3.5rem] rounded-md px-2.5 py-2 transition-all"
      id={`turn-${side}-${turn.inning}`}
      style={
        isCurrent
          ? {
              border: `2px solid ${highlight}`,
              backgroundColor: withAlpha(highlight, 0.12),
              fontWeight: 700,
              boxShadow: `0 0 0 3px ${withAlpha(highlight, 0.2)}`,
            }
          : { border: `1px solid ${withAlpha(fg, 0.2)}` }
      }
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="truncate text-xs font-semibold opacity-80">{pName}</span>
        <span className="shrink-0 tabular-nums text-right text-[10px] opacity-50">
          누적 {turn.runningTotal}
        </span>
      </div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="tabular-nums text-2xl font-black leading-none">+{turn.points}</span>
        <span className="tabular-nums text-lg font-bold leading-none">{turn.runningTotal}</span>
      </div>
      {(turn.sequence.length > 0 || turn.markers.length > 0) && (
        <div
          className="mt-1.5 flex flex-wrap items-center gap-1"
          aria-label="이닝 득점 순서"
        >
          {turn.sequence.map((v, i) => {
            const pIdx = turn.playerSequence[i] ?? turn.playerIndex
            return (
              <span
                key={`s${i}`}
                className="inline-flex min-w-[2rem] items-center justify-center rounded tabular-nums text-[11px] font-bold leading-none"
                style={{
                  border: `1px solid ${withAlpha(fg, 0.35)}`,
                  padding: "2px 4px",
                }}
              >
                {isDoubles && (
                  <span className="mr-0.5 opacity-70">{DoublesLetter(pIdx)}</span>
                )}
                {v}
              </span>
            )
          })}
          {turn.markers.map((m, i) => (
            <span
              key={`m${i}`}
              className="inline-flex items-center justify-center rounded text-[11px] font-bold leading-none"
              style={{
                border: `1px solid ${accent}`,
                color: accent,
                padding: "2px 4px",
              }}
              title="타임아웃"
            >
              {m === "T" ? "ⓣ" : m}
            </span>
          ))}
        </div>
      )}
      {turn.done && (
        <div className="mt-1 select-none text-center font-mono text-[10px] tracking-widest opacity-30">
          --------
        </div>
      )}
    </div>
  )
}

export function Scoreboard({
  config,
  derived,
  current,
  setIndex = 0,
}: ScoreboardProps) {
  const { theme } = useTheme()
  const scrollRef = useRef<HTMLDivElement>(null)

  const lastTurnInning = Math.max(
    derived.away.turns.reduce((m, t) => Math.max(m, t.inning), 0),
    derived.home.turns.reduce((m, t) => Math.max(m, t.inning), 0),
  )
  const maxInning = Math.max(derived.currentInning, lastTurnInning, 1)

  const getTurn = (side: Side, inning: number): Turn | null => {
    if (current && current.side === side && current.inning === inning) return current
    const found = derived[side].turns.find((t) => t.inning === inning)
    return found ?? null
  }

  const isCurrentCell = (side: Side, inning: number) =>
    !!current && current.side === side && current.inning === inning

  const innings = Array.from({ length: maxInning }, (_, i) => i + 1)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [maxInning, current?.side, current?.inning, derived.currentPoints])

  return (
    <div ref={scrollRef} className="mx-auto w-full max-w-3xl">
      <div
        className="sticky top-0 z-[1] grid grid-cols-[1fr_auto_1fr] gap-2 py-1 text-center"
        style={{ backgroundColor: theme.bg }}
      >
        <div
          className="rounded-md border-b-2 py-1 text-sm font-black"
          style={{ borderColor: TEAM_COLORS.away, color: TEAM_COLORS.away }}
        >
          {config.away.name}
        </div>
        <div className="w-10 self-center text-xs font-bold opacity-50">이닝</div>
        <div
          className="rounded-md border-b-2 py-1 text-sm font-black"
          style={{ borderColor: TEAM_COLORS.home, color: TEAM_COLORS.home }}
        >
          {config.home.name}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        {innings.map((inning) => (
          <div
            key={inning}
            className="grid grid-cols-[1fr_auto_1fr] items-stretch gap-1.5 rounded-lg border p-1.5"
            style={{ borderColor: withAlpha(theme.fg, 0.15) }}
          >
            <TurnCell
              config={config}
              setIndex={setIndex}
              side="away"
              turn={getTurn("away", inning)}
              isCurrent={isCurrentCell("away", inning)}
              fg={theme.fg}
              accent={TEAM_COLORS.away}
            />
            <div className="flex w-10 items-center justify-center">
              <span
                className="flex h-7 w-7 items-center justify-center rounded-full text-sm font-black tabular-nums"
                style={{
                  border: `1px solid ${withAlpha(theme.fg, 0.3)}`,
                  color: theme.fg,
                }}
              >
                {inning}
              </span>
            </div>
            <TurnCell
              config={config}
              setIndex={setIndex}
              side="home"
              turn={getTurn("home", inning)}
              isCurrent={isCurrentCell("home", inning)}
              fg={theme.fg}
              accent={TEAM_COLORS.home}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
