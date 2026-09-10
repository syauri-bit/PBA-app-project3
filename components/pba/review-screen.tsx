"use client"

import { useEffect, useRef } from "react"
import { ChevronLeft, FileText, Home } from "lucide-react"
import type { GameAction, MatchConfig } from "@/lib/pba/types"
import { TEAM_COLORS } from "@/lib/pba/types"
import {
  deriveSet,
  firstBreakForSet,
  getSetConfig,
  getSetPlayers,
} from "@/lib/pba/game"
import { Scoreboard } from "./scoreboard"
import { useTheme } from "./theme-context"

interface ReviewScreenProps {
  config: MatchConfig
  setActions: GameAction[][]
  onBack: () => void
}

export function ReviewScreen({ config, setActions, onBack }: ReviewScreenProps) {
  const { theme } = useTheme()
  const scrollRef = useRef<HTMLDivElement>(null)

  const derivedSets = setActions.map((a, i) =>
    deriveSet(a, config, firstBreakForSet(config, i), false, i),
  )

  const totals = derivedSets.reduce(
    (acc, d) => {
      acc.away += d.away.total
      acc.home += d.home.total
      acc.innings += Math.max(d.away.innings, d.home.innings)
      return acc
    },
    { away: 0, home: 0, innings: 0 },
  )

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [setActions])

  return (
    <div className="flex min-h-full flex-col">
      <header
        className="sticky top-0 z-10 flex items-center justify-between gap-2 px-4 py-3 shadow-sm"
        style={{ backgroundColor: theme.bg }}
      >
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-semibold shadow-sm"
          style={{ borderColor: "currentColor" }}
        >
          <ChevronLeft className="h-4 w-4" />
          뒤로
        </button>
        <span className="text-sm font-bold opacity-80">기록지 보기</span>
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-semibold shadow-sm"
          style={{ borderColor: "currentColor" }}
        >
          <Home className="h-4 w-4" />
          메인
        </button>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-2">
        <div
          className="mx-auto mb-3 grid max-w-3xl grid-cols-3 gap-2 rounded-xl border p-3 text-center"
          style={{ borderColor: "currentColor" }}
        >
          <div>
            <div className="text-xs opacity-60">총 이닝</div>
            <div className="text-2xl font-black tabular-nums">{totals.innings}</div>
          </div>
          <div>
            <div className="text-xs opacity-60">{config.away.name}</div>
            <div
              className="text-2xl font-black tabular-nums"
              style={{ color: TEAM_COLORS.away }}
            >
              {totals.away}
            </div>
          </div>
          <div>
            <div className="text-xs opacity-60">{config.home.name}</div>
            <div
              className="text-2xl font-black tabular-nums"
              style={{ color: TEAM_COLORS.home }}
            >
              {totals.home}
            </div>
          </div>
        </div>

        {derivedSets.map((derived, i) => {
          const sc = getSetConfig(config, i)
          const awayPlayers = getSetPlayers(config, i, "away")
          const homePlayers = getSetPlayers(config, i, "home")
          return (
            <div key={i} className="mb-4">
              {derivedSets.length > 1 && (
                <div className="mb-1 text-center">
                  <div className="text-xs font-bold opacity-70">
                    {i + 1}세트
                    {sc?.label ? ` · ${sc.label}` : ""}
                    {derived.decidedByBanking ? " · 뱅킹승부" : ""}
                  </div>
                  <div className="text-[10px] opacity-60 tabular-nums">
                    <span style={{ color: TEAM_COLORS.away }}>
                      {awayPlayers.join(", ")}
                    </span>
                    {" vs "}
                    <span style={{ color: TEAM_COLORS.home }}>
                      {homePlayers.join(", ")}
                    </span>
                  </div>
                </div>
              )}
              <Scoreboard config={config} derived={derived} current={null} setIndex={i} />
            </div>
          )
        })}
      </div>
    </div>
  )
}
