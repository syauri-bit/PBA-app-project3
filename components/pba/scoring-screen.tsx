"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  ChevronLeft,
  Download,
  Eye,
  FileText,
  Home,
  Plus,
  RotateCcw,
  Save,
  SkipForward,
  Sparkles,
  Table,
  ListChecks,
} from "lucide-react"
import type { GameAction, MatchConfig, Side } from "@/lib/pba/types"
import { TEAM_COLORS, playersPerTeam } from "@/lib/pba/types"
import {
  countSetWins,
  currentTurn,
  deriveSet,
  firstBreakForSet,
  formatAverage,
  getSetConfig,
  getSetPlayers,
  getWinningScoreForSet,
  isDoublesSet,
} from "@/lib/pba/game"
import { downloadMatchHtml, type MatchMeta } from "@/lib/pba/export"
import { withAlpha } from "@/lib/pba/colors"
import { useTheme } from "./theme-context"
import { Scoreboard } from "./scoreboard"
import { useLongPress } from "./use-long-press"
import { PreviewDialog } from "./preview-dialog"
import { ReviewScreen } from "./review-screen"
import type { MatchDraft } from "@/lib/pba/draft"

interface ScoringScreenProps {
  config: MatchConfig
  initialSets?: GameAction[][]
  resumeData?: MatchDraft | null
  tieBreak?: boolean
  tieBreakFirstBreak?: Side
  onDraftChange?: (draft: MatchDraft) => void
  onClearDraft?: () => void
  onFinish: (setActions: GameAction[][], meta: MatchMeta) => void
  onExit: () => void
}

function HoldButton({
  label,
  onComplete,
  disabled,
  theme,
  icon: Icon,
}: {
  label: string
  onComplete: () => void
  disabled?: boolean
  theme: { bg: string; fg: string }
  icon?: React.ComponentType<{ className?: string }>
}) {
  const { handlers, progress } = useLongPress(onComplete)
  return (
    <button
      type="button"
      disabled={disabled}
      {...(disabled ? {} : handlers)}
      className="relative flex flex-1 items-center justify-center gap-1 overflow-hidden rounded-xl border py-3 text-sm font-bold shadow-md active:translate-y-px disabled:opacity-40"
      style={{ borderColor: theme.fg, backgroundColor: theme.bg, color: theme.fg }}
    >
      <span
        className="absolute inset-y-0 left-0 -z-0"
        style={{ width: `${progress * 100}%`, backgroundColor: theme.fg, opacity: 0.18 }}
        aria-hidden
      />
      <span className="relative z-10 flex items-center gap-1">
        {Icon && <Icon className="h-4 w-4" />}
        {label}
      </span>
      <span className="relative z-10 ml-1 block text-[10px] font-normal opacity-60">
        길게 누르기
      </span>
    </button>
  )
}

function FirstBreakBall({ side, size = 28 }: { side: Side; size?: number }) {
  const accent = TEAM_COLORS[side]
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full"
      style={{
        width: size,
        height: size,
        backgroundColor: "#FFFFFF",
        border: `3px solid ${accent}`,
        boxShadow: "0 2px 6px rgba(0,0,0,0.18)",
      }}
      title="초구 (첫 공격)"
      aria-label="초구"
    />
  )
}

function DoublesTag(playerIdx: number): "A" | "B" {
  return playerIdx === 0 ? "A" : "B"
}

export function ScoringScreen({
  config,
  initialSets,
  resumeData,
  tieBreak = false,
  tieBreakFirstBreak,
  onDraftChange,
  onClearDraft,
  onFinish,
  onExit,
}: ScoringScreenProps) {
  const { theme } = useTheme()
  const seed = initialSets && initialSets.length > 0 ? initialSets : [[]]
  const [completedSets, setCompletedSets] = useState<GameAction[][]>(() =>
    resumeData ? resumeData.completedSets : seed.slice(0, -1),
  )
  const [actions, setActions] = useState<GameAction[]>(() =>
    resumeData ? resumeData.actions : seed[seed.length - 1] ?? [],
  )
  const [showPreview, setShowPreview] = useState(false)
  const [showReview, setShowReview] = useState(false)
  const [summaryView, setSummaryView] = useState(false)
  const startedAtRef = useRef<number>(resumeData ? resumeData.startedAt : Date.now())
  const [tbFirstBreak, setTbFirstBreak] = useState<Side | null>(
    tieBreak ? (tieBreakFirstBreak ?? null) : null,
  )

  const isTieBreak = tieBreak
  const setIndex = completedSets.length
  const firstBreak = isTieBreak
    ? tbFirstBreak ?? config.firstBreak
    : firstBreakForSet(config, setIndex)
  const currentSetCfg = getSetConfig(config, setIndex)
  const doublesForSet = isDoublesSet(config, setIndex)
  const winningScoreForSet = getWinningScoreForSet(config, setIndex)
  const derived = useMemo(
    () => deriveSet(actions, config, firstBreak, isTieBreak, setIndex),
    [actions, config, firstBreak, isTieBreak, setIndex],
  )
  const current = currentTurn(derived)
  const ppt = doublesForSet ? 2 : 1

  const finishReportedRef = useRef<boolean>(derived.winner != null)

  const setWins = useMemo(
    () => countSetWins(completedSets, config),
    [completedSets, config],
  )

  useEffect(() => {
    if (setIndex === 0 && actions.length === 0 && !resumeData) {
      startedAtRef.current = Date.now()
    }
  }, [setIndex, actions.length, resumeData])

  useEffect(() => {
    if (derived.winner) return
    if (!onDraftChange) return
    onDraftChange({
      config,
      completedSets,
      actions,
      startedAt: startedAtRef.current,
      tieBreak: isTieBreak,
      tieBreakFirstBreak: tbFirstBreak ?? undefined,
      savedAt: Date.now(),
    })
  }, [actions, completedSets, derived.winner, config, isTieBreak, tbFirstBreak, onDraftChange])

  useEffect(() => {
    if (!derived.winner) {
      finishReportedRef.current = false
      return
    }
    if (finishReportedRef.current) return
    finishReportedRef.current = true
    if (config.method === "point" || isTieBreak) {
      onClearDraft?.()
      onFinish([...completedSets, actions], {
        startedAt: startedAtRef.current,
        endedAt: Date.now(),
      })
    } else {
      const newWins = {
        away: setWins.away + (derived.winner === "away" ? 1 : 0),
        home: setWins.home + (derived.winner === "home" ? 1 : 0),
      }
      if (newWins.away >= config.winningSets || newWins.home >= config.winningSets) {
        onClearDraft?.()
        onFinish([...completedSets, actions], {
          startedAt: startedAtRef.current,
          endedAt: Date.now(),
        })
      } else {
        setCompletedSets((prev) => [...prev, actions])
        setActions([])
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [derived.winner])

  const push = useCallback(
    (a: GameAction) => {
      if (derived.winner) return
      setActions((prev) => [...prev, a])
    },
    [derived.winner],
  )

  const undo = useCallback(() => {
    setActions((prev) => prev.slice(0, -1))
  }, [])

  const endSet = useCallback(() => {
    if (actions.length === 0 && completedSets.length === 0) return
    setCompletedSets((prev) => [...prev, actions])
    setActions([])
  }, [actions, completedSets.length])

  const endMatch = useCallback(() => {
    onClearDraft?.()
    onFinish([...completedSets, actions], {
      startedAt: startedAtRef.current,
      endedAt: Date.now(),
    })
  }, [completedSets, actions, onFinish, onClearDraft])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement
      const isTextInput =
        activeEl &&
        (activeEl.tagName === "INPUT" ||
          activeEl.tagName === "TEXTAREA" ||
          (activeEl as HTMLElement).isContentEditable)

      if (isTextInput) return

      if (showReview || showPreview) {
        if (e.key === "Escape") {
          setShowReview(false)
          setShowPreview(false)
        }
        return
      }

      switch (e.key) {
        case "1":
          e.preventDefault()
          push({ type: "point", value: 1 })
          break
        case "2":
          e.preventDefault()
          push({ type: "point", value: 2 })
          break
        case "0":
          e.preventDefault()
          push({ type: "endturn" })
          break
        case "Backspace":
          e.preventDefault()
          setActions((prev) => prev.slice(0, -1))
          break
        case "F12":
          e.preventDefault()
          if (config.method === "set" && !isTieBreak) {
            setCompletedSets((prev) => [...prev, actions])
            setActions([])
          }
          break
        case "F4":
          e.preventDefault()
          setShowPreview(true)
          break
        case "Enter":
          e.preventDefault()
          endMatch()
          break
        case " ":
        case "Spacebar":
          e.preventDefault()
          setShowReview(true)
          break
        case "Escape":
          e.preventDefault()
          if (onExit) onExit()
          break
        default:
          break
      }
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [
    showReview,
    showPreview,
    push,
    actions,
    config.method,
    isTieBreak,
    onExit,
    endMatch,
  ])

  const playersAway = getSetPlayers(config, setIndex, "away")
  const playersHome = getSetPlayers(config, setIndex, "home")

  const playerNameFor = (side: Side, idx: number): string => {
    const list = side === "away" ? playersAway : playersHome
    return list[idx] ?? list[0] ?? "선수"
  }

  const activeTeam = current ? (current.side === "away" ? config.away : config.home) : null
  const activePlayer = current ? playerNameFor(current.side, current.playerIndex) : null

  const accent = current ? TEAM_COLORS[current.side] : theme.fg
  const ctrlStyle = { borderColor: accent, backgroundColor: accent, color: theme.bg }
  const outlineStyle = { borderColor: accent, backgroundColor: theme.bg, color: accent }

  const meta: MatchMeta = { startedAt: startedAtRef.current, endedAt: Date.now() }

  const setAvgAway = derived.away.innings > 0 ? derived.away.total / derived.away.innings : 0
  const setAvgHome = derived.home.innings > 0 ? derived.home.total / derived.home.innings : 0
  const setHrAway = derived.away.highRun
  const setHrHome = derived.home.highRun

  const cumulative = useMemo(() => {
    let awayTotal = derived.away.total
    let homeTotal = derived.home.total
    let awayInn = derived.away.innings
    let homeInn = derived.home.innings
    let awayHr = derived.away.highRun
    let homeHr = derived.home.highRun
    for (let i = 0; i < completedSets.length; i++) {
      const d = deriveSet(completedSets[i], config, firstBreakForSet(config, i), false, i)
      awayTotal += d.away.total
      homeTotal += d.home.total
      awayInn += d.away.innings
      homeInn += d.home.innings
      awayHr = Math.max(awayHr, d.away.highRun)
      homeHr = Math.max(homeHr, d.home.highRun)
    }
    return {
      away: { avg: awayInn ? awayTotal / awayInn : 0, hr: awayHr },
      home: { avg: homeInn ? homeTotal / homeInn : 0, hr: homeHr },
    }
  }, [completedSets, config, derived])

  const setPerSideTimeoutLimit = 2
  const awaySetTLeft = Math.max(0, setPerSideTimeoutLimit - derived.away.setTimeoutsUsed)
  const homeSetTLeft = Math.max(0, setPerSideTimeoutLimit - derived.home.setTimeoutsUsed)
  const awayGlobalTLeft = Math.max(0, config.timeouts - derived.away.timeoutsUsed)
  const homeGlobalTLeft = Math.max(0, config.timeouts - derived.home.timeoutsUsed)

  const isAwayTurn = !!current && current.side === "away"
  const isHomeTurn = !!current && current.side === "home"

  return (
    <div className="flex h-full flex-col">
      <header
        className="z-20 shrink-0 border-b px-3 py-2 shadow-sm"
        style={{
          borderColor: theme.fg,
          backgroundColor: current ? withAlpha(accent, 0.08) : theme.bg,
        }}
      >
        <div className="mb-1 flex items-center justify-between">
          <button
            type="button"
            onClick={onExit}
            className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold shadow-sm"
            style={{ borderColor: "currentColor" }}
          >
            <Home className="h-3.5 w-3.5" />
            메인
          </button>
          <span className="text-xs font-semibold opacity-70">
            {isTieBreak
              ? "승부치기"
              : config.method === "point"
                ? "점수제"
                : `${setIndex + 1}${currentSetCfg?.label ? `세트 · ${currentSetCfg.label}` : "세트"}`}
            {" · "}
            승리 {winningScoreForSet}점
            {config.method === "set" && !isTieBreak ? ` / ${config.winningSets}세트선` : ""}
            {" · "}
            {current?.inning ?? derived.currentInning}이닝 / {config.maxInningsPerSet || "-"}
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setShowReview(true)}
              className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold shadow-sm"
              style={{ borderColor: "currentColor" }}
            >
              <FileText className="h-3.5 w-3.5" />
              기록지
            </button>
            <button
              type="button"
              onClick={() => setShowPreview(true)}
              className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold shadow-sm"
              style={{ borderColor: "currentColor" }}
            >
              <Save className="h-3.5 w-3.5" />
              저장
            </button>
          </div>
        </div>

        <div className="grid grid-cols-[auto_1fr_auto_1fr_auto] items-center gap-2">
          <div className="flex justify-center">
            {firstBreak === "away" && <FirstBreakBall side="away" />}
          </div>

          <div className="flex flex-col items-center text-center">
            <div className="flex items-center gap-1">
              <TimeoutBadges
                setUsed={derived.away.setTimeoutsUsed}
                setLimit={setPerSideTimeoutLimit}
                globalUsed={derived.away.timeoutsUsed}
                globalLimit={config.timeouts}
                accent={TEAM_COLORS.away}
                onUse={() => push({ type: "timeout", side: "away" })}
                disabled={!!derived.winner || !isAwayTurn}
              />
              <div className="truncate text-sm font-bold" style={{ color: TEAM_COLORS.away }}>
                {config.away.name}
              </div>
            </div>
            <div className="tabular-nums text-5xl font-black leading-none">{derived.away.total}</div>
            <div className="mt-0.5 text-[10px] font-semibold tabular-nums opacity-70">
              AVG {formatAverage(setAvgAway)} · HR {setHrAway}
            </div>
            <div className="text-[10px] font-semibold tabular-nums opacity-50">
              누적 AVG {formatAverage(cumulative.away.avg)} · HR {cumulative.away.hr}
            </div>
            <div className="text-[10px] font-bold tabular-nums opacity-60">
              세트당T {awaySetTLeft} / 총T {awayGlobalTLeft}
            </div>
          </div>

          <div className="flex flex-col items-center px-1 text-center">
            {config.method === "set" && (
              <div
                className="mb-0.5 flex items-center gap-1.5 rounded-lg px-2 py-0.5 text-xl font-black tabular-nums"
                style={{ backgroundColor: theme.fg, color: theme.bg }}
              >
                <span style={{ color: TEAM_COLORS.away }}>{setWins.away}</span>
                <span className="opacity-50">:</span>
                <span style={{ color: TEAM_COLORS.home }}>{setWins.home}</span>
              </div>
            )}
            <div className="text-xs font-bold opacity-60">VS</div>
          </div>

          <div className="flex flex-col items-center text-center">
            <div className="flex items-center gap-1">
              <div className="truncate text-sm font-bold" style={{ color: TEAM_COLORS.home }}>
                {config.home.name}
              </div>
              <TimeoutBadges
                setUsed={derived.home.setTimeoutsUsed}
                setLimit={setPerSideTimeoutLimit}
                globalUsed={derived.home.timeoutsUsed}
                globalLimit={config.timeouts}
                accent={TEAM_COLORS.home}
                onUse={() => push({ type: "timeout", side: "home" })}
                disabled={!!derived.winner || !isHomeTurn}
              />
            </div>
            <div className="tabular-nums text-5xl font-black leading-none">{derived.home.total}</div>
            <div className="mt-0.5 text-[10px] font-semibold tabular-nums opacity-70">
              AVG {formatAverage(setAvgHome)} · HR {setHrHome}
            </div>
            <div className="text-[10px] font-semibold tabular-nums opacity-50">
              누적 AVG {formatAverage(cumulative.home.avg)} · HR {cumulative.home.hr}
            </div>
            <div className="text-[10px] font-bold tabular-nums opacity-60">
              세트당T {homeSetTLeft} / 총T {homeGlobalTLeft}
            </div>
          </div>

          <div className="flex justify-center">
            {firstBreak === "home" && <FirstBreakBall side="home" />}
          </div>
        </div>

        {activePlayer && (
          <div className="mt-1 text-center text-xs font-semibold">
            현재 타순:{" "}
            <span className="font-black" style={{ color: accent }}>
              {activeTeam?.name} · {activePlayer}
              {ppt > 1
                ? ` (#${DoublesTag(current!.playerIndex)})`
                : ""}
            </span>
          </div>
        )}
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
        {summaryView ? (
          <SetSummaryView
            config={config}
            completedSets={completedSets}
            currentActions={actions}
          />
        ) : (
          <Scoreboard
            config={config}
            derived={derived}
            current={current}
            setIndex={setIndex}
          />
        )}
      </main>

      <footer
        className="z-20 shrink-0 border-t px-3 py-2 shadow-[0_-2px_8px_rgba(0,0,0,0.06)]"
        style={{ borderColor: theme.fg, backgroundColor: theme.bg }}
      >
        <div className="mb-2 grid grid-cols-4 gap-2">
          <button
            type="button"
            onClick={() => push({ type: "point", value: 1 })}
            className="flex flex-col items-center justify-center rounded-xl border py-3 text-sm font-bold shadow-md active:translate-y-px"
            style={ctrlStyle}
          >
            <Plus className="h-5 w-5" />
            1점
          </button>
          <button
            type="button"
            onClick={() => push({ type: "point", value: 2 })}
            className="flex flex-col items-center justify-center rounded-xl border py-3 text-sm font-bold shadow-md active:translate-y-px"
            style={ctrlStyle}
          >
            <Plus className="h-5 w-5" />
            뱅크 2점
          </button>
          <button
            type="button"
            onClick={() => push({ type: "endturn" })}
            className="flex flex-col items-center justify-center rounded-xl border py-3 text-sm font-bold shadow-md active:translate-y-px"
            style={outlineStyle}
          >
            <SkipForward className="h-5 w-5" />
            턴종료
          </button>
          <button
            type="button"
            onClick={undo}
            disabled={actions.length === 0}
            className="flex flex-col items-center justify-center rounded-xl border py-3 text-sm font-bold shadow-md active:translate-y-px disabled:opacity-40"
            style={outlineStyle}
          >
            <RotateCcw className="h-5 w-5" />
            턴취소
          </button>
        </div>
        <div className="grid grid-cols-4 gap-2">
          <button
            type="button"
            onClick={() => setSummaryView((v) => !v)}
            className="flex items-center justify-center gap-1.5 rounded-xl border py-3 text-sm font-bold shadow-md active:translate-y-px"
            style={outlineStyle}
          >
            {summaryView ? <Table className="h-4 w-4" /> : <ListChecks className="h-4 w-4" />}
            {summaryView ? "기록지" : "요약"}
          </button>
          <button
            type="button"
            onClick={() => setShowReview(true)}
            className="flex items-center justify-center gap-1.5 rounded-xl border py-3 text-sm font-bold shadow-md active:translate-y-px"
            style={outlineStyle}
          >
            <Eye className="h-4 w-4" />
            기록지 보기
          </button>
          <HoldButton
            label="세트 종료"
            icon={Sparkles}
            theme={theme}
            disabled={config.method !== "set" || isTieBreak}
            onComplete={endSet}
          />
          <HoldButton label="경기 종료" icon={Download} theme={theme} onComplete={endMatch} />
        </div>
      </footer>

      <div
        className="shrink-0 border-t px-3 py-1 text-center text-[10px] opacity-50"
        style={{ borderColor: theme.fg }}
      >
        1:1점 · 2:2점 · 0:턴종료 · ⌫:취소 · F12:세트종료 · Enter:경기종료 · Space:기록지 · F4:저장 · ESC:메인
      </div>

      {isTieBreak && tbFirstBreak === null && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/40 px-6">
          <div
            className="w-full max-w-sm rounded-2xl border p-5 shadow-xl"
            style={{ borderColor: theme.fg, backgroundColor: theme.bg }}
          >
            <h2 className="mb-1 text-center text-lg font-black">승부치기 초구 선택</h2>
            <p className="mb-4 text-center text-xs opacity-70">먼저 시작할 팀을 선택하세요</p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setTbFirstBreak("away")}
                className="flex-1 rounded-xl border py-4 text-base font-black shadow-md active:translate-y-px"
                style={{
                  borderColor: TEAM_COLORS.away,
                  backgroundColor: TEAM_COLORS.away,
                  color: "#fff",
                }}
              >
                {config.away.name}
              </button>
              <button
                type="button"
                onClick={() => setTbFirstBreak("home")}
                className="flex-1 rounded-xl border py-4 text-base font-black shadow-md active:translate-y-px"
                style={{
                  borderColor: TEAM_COLORS.home,
                  backgroundColor: TEAM_COLORS.home,
                  color: "#fff",
                }}
              >
                {config.home.name}
              </button>
            </div>
          </div>
        </div>
      )}

      {showPreview && (
        <PreviewDialog
          config={config}
          setActions={[...completedSets, actions]}
          meta={meta}
          onClose={() => setShowPreview(false)}
        />
      )}

      {showReview && (
        <ReviewScreen
          config={config}
          setActions={[...completedSets, actions]}
          onBack={() => setShowReview(false)}
        />
      )}
    </div>
  )
}

function SetSummaryView({
  config,
  completedSets,
  currentActions,
}: {
  config: MatchConfig
  completedSets: GameAction[][]
  currentActions: GameAction[]
}) {
  const { theme } = useTheme()
  const allSets = [...completedSets, currentActions]
  const derivedSets = allSets.map((a, i) =>
    deriveSet(a, config, firstBreakForSet(config, i), false, i),
  )

  return (
    <div className="mx-auto w-full max-w-3xl">
      <div className="mb-2 text-center text-xs font-bold opacity-70">세트별 경기 요약</div>
      <div className="flex flex-col gap-2">
        {derivedSets.map((d, i) => {
          const isCurrent = i === derivedSets.length - 1 && !d.winner
          const sc = getSetConfig(config, i)
          const setLabel = sc?.label
            ? `${i + 1}세트 · ${sc.label}`
            : `${i + 1}세트`
          return (
            <div
              key={i}
              className="rounded-xl border p-3"
              style={{
                borderColor: d.winner ? TEAM_COLORS[d.winner] : theme.fg,
                backgroundColor: d.winner ? withAlpha(TEAM_COLORS[d.winner!], 0.08) : "transparent",
              }}
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-bold opacity-70">
                  {setLabel}
                  {isCurrent ? " (진행 중)" : ""}
                  {d.tieBreak ? " · 승부치기" : ""}
                  {d.decidedByBanking ? " · 뱅킹 결정" : ""}
                </span>
                {d.winner && (
                  <span className="text-xs font-bold" style={{ color: TEAM_COLORS[d.winner] }}>
                    {d.winner === "away" ? config.away.name : config.home.name} 승
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                {(["away", "home"] as Side[]).map((side) => {
                  const sd = d[side]
                  const team = side === "away" ? config.away : config.home
                  const teamPlayers = getSetPlayers(config, i, side)
                  return (
                    <div key={side} className="flex flex-col gap-0.5">
                      <span className="text-sm font-bold" style={{ color: TEAM_COLORS[side] }}>
                        {team.name}
                      </span>
                      <div className="flex items-baseline justify-between">
                        <span className="text-2xl font-black tabular-nums">{sd.total}</span>
                        <span className="text-xs tabular-nums opacity-70">
                          {sd.innings}이닝
                        </span>
                      </div>
                      <div className="text-[11px] tabular-nums opacity-60">
                        AVG {formatAverage(sd.average)} · HR {sd.highRun}
                      </div>
                      <div className="text-[10px] tabular-nums opacity-50 truncate">
                        {teamPlayers.join(" / ")}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function TimeoutBadges({
  setUsed,
  setLimit,
  globalUsed,
  globalLimit,
  accent,
  onUse,
  disabled,
}: {
  setUsed: number
  setLimit: number
  globalUsed: number
  globalLimit: number
  accent: string
  onUse: () => void
  disabled?: boolean
}) {
  if (globalLimit <= 0) return null
  const showCount = Math.min(globalLimit, setLimit)
  return (
    <div className="flex shrink-0 items-center gap-0.5">
      {Array.from({ length: showCount }).map((_, i) => {
        const setExhausted = i >= setLimit - setUsed
        const globalExhausted = i >= globalLimit - globalUsed
        const isUsed = setExhausted || globalExhausted
        return (
          <button
            key={i}
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              if (!disabled && !isUsed) onUse()
            }}
            disabled={disabled || isUsed}
            className="flex h-5 w-5 items-center justify-center rounded-full border text-[10px] font-black leading-none disabled:cursor-default"
            style={
              isUsed
                ? {
                    borderColor: accent,
                    backgroundColor: "#fff",
                    color: accent,
                    opacity: 0.7,
                  }
                : { borderColor: accent, backgroundColor: accent, color: "#fff" }
            }
            title={isUsed ? "사용됨" : "타임아웃 사용"}
            aria-label={`타임아웃 ${i + 1}`}
          >
            T
          </button>
        )
      })}
    </div>
  )
}
