"use client"

import { useMemo, useState } from "react"
import {
  ChevronLeft,
  Clock,
  Download,
  FileText,
  Home,
  ListChecks,
  Pencil,
  Save,
  Sword,
  Table,
  Trophy,
} from "lucide-react"
import type { GameAction, MatchConfig, Side } from "@/lib/pba/types"
import { TEAM_COLORS } from "@/lib/pba/types"
import {
  compareHighRuns,
  countSetWins,
  deriveSet,
  firstBreakForSet,
  formatAverage,
  getSetConfig,
  getSetPlayers,
} from "@/lib/pba/game"
import { downloadMatchHtml, formatDuration, type MatchMeta } from "@/lib/pba/export"
import { withAlpha } from "@/lib/pba/colors"
import { useTheme } from "./theme-context"
import { Scoreboard } from "./scoreboard"

interface ResultScreenProps {
  config: MatchConfig
  setActions: GameAction[][]
  meta?: MatchMeta
  forcedWinner?: Side | null
  onEdit: () => void
  onHome: () => void
  onTieBreak: (firstBreak: Side) => void
  onForceWinner: (side: Side) => void
}

export function ResultScreen({
  config,
  setActions,
  meta,
  forcedWinner,
  onEdit,
  onHome,
  onTieBreak,
  onForceWinner,
}: ResultScreenProps) {
  const { theme } = useTheme()
  const [view, setView] = useState<"report" | "sheet">("report")

  const derivedSets = useMemo(
    () =>
      setActions.map((a, i) =>
        deriveSet(a, config, firstBreakForSet(config, i), false, i),
      ),
    [setActions, config],
  )

  const totals = useMemo(() => {
    let awayTotal = 0
    let homeTotal = 0
    let awayInnings = 0
    let homeInnings = 0
    let awayHR = 0
    let homeHR = 0
    for (const d of derivedSets) {
      awayTotal += d.away.total
      homeTotal += d.home.total
      awayInnings += d.away.innings
      homeInnings += d.home.innings
      awayHR = Math.max(awayHR, d.away.highRun)
      homeHR = Math.max(homeHR, d.home.highRun)
    }
    return {
      away: {
        total: awayTotal,
        innings: awayInnings,
        avg: awayInnings ? awayTotal / awayInnings : 0,
        hr: awayHR,
      },
      home: {
        total: homeTotal,
        innings: homeInnings,
        avg: homeInnings ? homeTotal / homeInnings : 0,
        hr: homeHR,
      },
    }
  }, [derivedSets])

  const setWins = useMemo(
    () => countSetWins(setActions, config),
    [setActions, config],
  )

  const isDraw = useMemo(() => {
    if (config.method === "set") return setWins.away === setWins.home
    return totals.away.total === totals.home.total
  }, [config.method, totals, setWins])

  const winner: Side | null = useMemo(() => {
    if (forcedWinner) return forcedWinner
    if (config.method === "set") {
      if (setWins.away === setWins.home) return null
      return setWins.away > setWins.home ? "away" : "home"
    }
    if (totals.away.total === totals.home.total) {
      return compareHighRuns(setActions, config)
    }
    return totals.away.total > totals.home.total ? "away" : "home"
  }, [config.method, totals, setWins, forcedWinner, setActions, config])

  const winnerName =
    winner === "away"
      ? config.away.name
      : winner === "home"
        ? config.home.name
        : "무승부"

  const playerTotals = useMemo(() => {
    const bySide: Record<Side, Record<string, number>> = {
      away: {},
      home: {},
    }
    derivedSets.forEach((d, i) => {
      ;(["away", "home"] as Side[]).forEach((side) => {
        const players = getSetPlayers(config, i, side)
        d[side].turns.forEach((t) => {
          const name = players[t.playerIndex] ?? `선수${t.playerIndex + 1}`
          bySide[side][name] = (bySide[side][name] ?? 0) + t.points
        })
      })
    })
    return bySide
  }, [derivedSets, config])

  const duration = meta ? formatDuration(meta.endedAt - meta.startedAt) : ""

  const StatCard = ({ side }: { side: Side }) => {
    const s = totals[side]
    const team = side === "away" ? config.away : config.home
    const isWinner = winner === side
    const accent = TEAM_COLORS[side]
    const pTotals = Object.entries(playerTotals[side])
    return (
      <div
        className="flex flex-col gap-2 rounded-2xl border p-4"
        style={{
          borderColor: accent,
          backgroundColor: isWinner ? withAlpha(accent, 0.1) : "transparent",
        }}
      >
        <div className="flex items-center justify-between">
          <span className="text-base font-bold" style={{ color: accent }}>
            {team.name}
          </span>
          {isWinner && <Trophy className="h-5 w-5" style={{ color: accent }} />}
        </div>
        <div className="text-xs opacity-70">{team.players.join(", ")}</div>
        <div className="tabular-nums text-5xl font-black leading-none">{s.total}</div>
        <dl className="mt-1 grid grid-cols-2 gap-1 text-sm">
          <div className="flex justify-between">
            <dt className="opacity-60">이닝</dt>
            <dd className="font-semibold tabular-nums">{s.innings}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="opacity-60">AVG</dt>
            <dd className="font-semibold tabular-nums">{formatAverage(s.avg)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="opacity-60">HR</dt>
            <dd className="font-semibold tabular-nums">{s.hr}</dd>
          </div>
          {config.method === "set" && (
            <div className="flex justify-between">
              <dt className="opacity-60">세트</dt>
              <dd className="font-semibold tabular-nums">{setWins[side]}</dd>
            </div>
          )}
        </dl>
        {pTotals.length > 0 && (
          <div
            className="mt-1 border-t pt-2 text-xs"
            style={{ borderColor: withAlpha(accent, 0.4) }}
          >
            {pTotals.map(([name, pts]) => (
              <div key={name} className="flex justify-between">
                <span className="opacity-70">{name}</span>
                <span className="font-bold tabular-nums">{pts}점</span>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  const judges: string[] = []
  if (config.refereeMain) judges.push(`주심 ${config.refereeMain}`)
  if (config.refereeSub) judges.push(`부심 ${config.refereeSub}`)
  if (config.refereeRecorder) judges.push(`기록심 ${config.refereeRecorder}`)
  if (config.recorders?.length) judges.push(`경기원 ${config.recorders.join(", ")}`)

  return (
    <div className="flex min-h-full flex-col">
      <header className="flex items-center justify-between px-4 pt-4">
        <button
          type="button"
          onClick={onHome}
          className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold shadow-sm"
          style={{ borderColor: "currentColor" }}
        >
          <Home className="h-3.5 w-3.5" />
          메인
        </button>
        <div
          className="flex overflow-hidden rounded-lg border"
          style={{ borderColor: "currentColor" }}
        >
          <button
            type="button"
            onClick={() => setView("report")}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold"
            style={
              view === "report"
                ? { backgroundColor: theme.fg, color: theme.bg }
                : {}
            }
          >
            <ListChecks className="h-3.5 w-3.5" />
            리포트
          </button>
          <button
            type="button"
            onClick={() => setView("sheet")}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold"
            style={
              view === "sheet"
                ? { backgroundColor: theme.fg, color: theme.bg }
                : {}
            }
          >
            <Table className="h-3.5 w-3.5" />
            기록지
          </button>
        </div>
        <button
          type="button"
          onClick={() => downloadMatchHtml(config, setActions, meta)}
          className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold shadow-sm"
          style={{ borderColor: "currentColor" }}
        >
          <Save className="h-3.5 w-3.5" />
          저장
        </button>
      </header>

      {view === "report" ? (
        <div className="flex-1 px-4 py-4">
          <div className="mx-auto w-full max-w-2xl">
            <div className="mb-4 text-center">
              <h1 className="flex items-center justify-center gap-2 text-2xl font-black">
                {winner && <Trophy className="h-6 w-6" />}
                {winner ? `${winnerName} 승리` : "무승부"}
              </h1>
              {(config.round || config.roundDay) && (
                <p className="mt-1 text-xs opacity-60">
                  {config.round ? `${config.round} ` : ""}
                  {config.roundDay ?? ""}
                </p>
              )}
              {isDraw && !winner && config.method === "point" && (
                <p className="mt-1 text-xs opacity-60">
                  하이런 비교 결과로도 승부를 가리지 못했습니다
                </p>
              )}
              {isDraw && !winner && config.method === "set" && (
                <p className="mt-1 text-xs opacity-60">세트 승수가 동점입니다</p>
              )}
              {duration && (
                <p className="mt-1 flex items-center justify-center gap-1 text-xs opacity-60">
                  <Clock className="h-3.5 w-3.5" />
                  경기 소요 시간 {duration}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <StatCard side="away" />
              <StatCard side="home" />
            </div>

            {config.method === "set" && derivedSets.length > 1 && (
              <div
                className="mt-4 rounded-xl border p-3 text-center"
                style={{ borderColor: "currentColor" }}
              >
                <div className="text-xs font-bold opacity-60">세트 스코어</div>
                <div className="mt-1 flex items-center justify-center gap-3 text-xl font-black tabular-nums">
                  <span style={{ color: TEAM_COLORS.away }}>{setWins.away}</span>
                  <span className="opacity-40">:</span>
                  <span style={{ color: TEAM_COLORS.home }}>{setWins.home}</span>
                </div>
                <div className="mt-2 flex flex-wrap justify-center gap-1 text-xs">
                  {derivedSets.map((d, i) => {
                    const sc = getSetConfig(config, i)
                    const label = sc?.label ?? ""
                    return (
                      <span
                        key={i}
                        className="rounded px-2 py-0.5"
                        style={{
                          backgroundColor: d.winner
                            ? withAlpha(TEAM_COLORS[d.winner], 0.15)
                            : "transparent",
                          color: d.winner ? TEAM_COLORS[d.winner] : "currentColor",
                        }}
                      >
                        {i + 1}세트
                        {label ? `(${label})` : ""} {d.away.total}:{d.home.total}
                        {d.decidedByBanking ? " 뱅킹" : ""}
                      </span>
                    )
                  })}
                </div>
              </div>
            )}

            {isDraw && (
              <div
                className="mt-4 rounded-xl border p-4"
                style={{ borderColor: "currentColor" }}
              >
                <div className="mb-3 flex items-center gap-2 text-sm font-bold">
                  <Sword className="h-4 w-4" />
                  승부치기
                </div>
                {config.method === "point" && (
                  <p className="mb-3 text-xs opacity-70">
                    하이런 비교: {config.away.name} {totals.away.hr} vs{" "}
                    {config.home.name} {totals.home.hr}
                    {winner && ` → ${winnerName} 승리`}
                  </p>
                )}
                {config.method === "set" && (
                  <p className="mb-3 text-xs opacity-70">
                    세트 승수가 동점입니다. 승자를 직접 선택하거나 승부치기 세트를 진행할 수
                    있습니다.
                  </p>
                )}
                <div className="flex flex-col gap-2">
                  {config.method === "set" && (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => onForceWinner("away")}
                        className="flex flex-1 items-center justify-center gap-2 rounded-xl border py-3 text-sm font-bold shadow-md active:translate-y-px"
                        style={{
                          borderColor: TEAM_COLORS.away,
                          backgroundColor:
                            forcedWinner === "away" ? TEAM_COLORS.away : theme.bg,
                          color: forcedWinner === "away" ? "#fff" : TEAM_COLORS.away,
                        }}
                      >
                        <Trophy className="h-4 w-4" />
                        {config.away.name} 승
                      </button>
                      <button
                        type="button"
                        onClick={() => onForceWinner("home")}
                        className="flex flex-1 items-center justify-center gap-2 rounded-xl border py-3 text-sm font-bold shadow-md active:translate-y-px"
                        style={{
                          borderColor: TEAM_COLORS.home,
                          backgroundColor:
                            forcedWinner === "home" ? TEAM_COLORS.home : theme.bg,
                          color: forcedWinner === "home" ? "#fff" : TEAM_COLORS.home,
                        }}
                      >
                        <Trophy className="h-4 w-4" />
                        {config.home.name} 승
                      </button>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => onTieBreak("away")}
                      className="flex flex-1 items-center justify-center gap-2 rounded-xl border py-3 text-sm font-bold shadow-md active:translate-y-px"
                      style={{
                        borderColor: theme.fg,
                        backgroundColor: theme.bg,
                        color: theme.fg,
                      }}
                    >
                      <Sword className="h-4 w-4" />
                      승부치기 ({config.away.name} 초구)
                    </button>
                    <button
                      type="button"
                      onClick={() => onTieBreak("home")}
                      className="flex flex-1 items-center justify-center gap-2 rounded-xl border py-3 text-sm font-bold shadow-md active:translate-y-px"
                      style={{
                        borderColor: theme.fg,
                        backgroundColor: theme.bg,
                        color: theme.fg,
                      }}
                    >
                      <Sword className="h-4 w-4" />
                      승부치기 ({config.home.name} 초구)
                    </button>
                  </div>
                </div>
              </div>
            )}

            {(judges.length > 0 || config.memo) && (
              <div
                className="mt-4 rounded-xl border p-3 text-sm"
                style={{ borderColor: "currentColor" }}
              >
                {judges.map((j, i) => (
                  <div key={i}>
                    <span className="opacity-60">{j}</span>
                  </div>
                ))}
                {config.memo && <div className="mt-1 opacity-80">{config.memo}</div>}
              </div>
            )}

            <div className="mt-6 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => downloadMatchHtml(config, setActions, meta)}
                className="flex items-center justify-center gap-2 rounded-xl border py-3 text-sm font-bold shadow-md active:translate-y-px"
                style={{
                  borderColor: theme.fg,
                  backgroundColor: theme.fg,
                  color: theme.bg,
                }}
              >
                <Download className="h-4 w-4" />
                기록지 HTML 다운로드
              </button>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setView("sheet")}
                  className="flex items-center justify-center gap-1.5 rounded-xl border py-3 text-sm font-bold shadow-md active:translate-y-px"
                  style={{
                    borderColor: theme.fg,
                    backgroundColor: theme.bg,
                    color: theme.fg,
                  }}
                >
                  <FileText className="h-4 w-4" />
                  기록지
                </button>
                <button
                  type="button"
                  onClick={onEdit}
                  className="flex items-center justify-center gap-1.5 rounded-xl border py-3 text-sm font-bold shadow-md active:translate-y-px"
                  style={{
                    borderColor: theme.fg,
                    backgroundColor: theme.bg,
                    color: theme.fg,
                  }}
                >
                  <Pencil className="h-4 w-4" />
                  수정
                </button>
                <button
                  type="button"
                  onClick={onHome}
                  className="flex items-center justify-center gap-1.5 rounded-xl border py-3 text-sm font-bold shadow-md active:translate-y-px"
                  style={{
                    borderColor: theme.fg,
                    backgroundColor: theme.bg,
                    color: theme.fg,
                  }}
                >
                  <ChevronLeft className="h-4 w-4" />
                  뒤로
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto px-3 py-3">
          {derivedSets.map((d, i) => (
            <div key={i} className="mb-4">
              {derivedSets.length > 1 && (
                <div className="mb-1 text-center text-xs font-bold opacity-70">
                  {i + 1}세트
                  {getSetConfig(config, i)?.label
                    ? ` · ${getSetConfig(config, i)!.label}`
                    : ""}
                  {d.tieBreak ? " (승부치기)" : ""}
                  {d.decidedByBanking ? " · 뱅킹 결정" : ""}
                </div>
              )}
              <Scoreboard config={config} derived={d} current={null} setIndex={i} />
            </div>
          ))}
          <div className="mx-auto mb-4 flex max-w-2xl gap-2">
            <button
              type="button"
              onClick={() => setView("report")}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl border py-3 text-sm font-bold shadow-md active:translate-y-px"
              style={{
                borderColor: theme.fg,
                backgroundColor: theme.bg,
                color: theme.fg,
              }}
            >
              <ListChecks className="h-4 w-4" />
              리포트로
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
