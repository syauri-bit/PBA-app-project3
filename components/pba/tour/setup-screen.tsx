"use client"

import { useMemo, useState } from "react"
import { ChevronLeft, Home, Play, Save } from "lucide-react"
import type { GameMode, MatchConfig, Method, PerSetConfig, Side } from "@/lib/pba/types"
import { MODE_LABELS, TEAM_COLORS, playersPerTeam } from "@/lib/pba/types"
import { useTheme } from "./theme-context"

interface SetupScreenProps {
  mode: GameMode
  onBack: () => void
  onStart: (config: MatchConfig) => void
}

const DEFAULT_TEAM_LEAGUE_SETS: Omit<PerSetConfig, "awayPlayers" | "homePlayers">[] = [
  { format: "doubles", winningScore: 11, label: "복식 11점제" },
  { format: "doubles", winningScore: 9, label: "복식 9점제" },
  { format: "single", winningScore: 15, label: "단식 15점제" },
  { format: "doubles", winningScore: 9, label: "복식 9점제" },
  { format: "single", winningScore: 11, label: "단식 11점제" },
  { format: "single", winningScore: 9, label: "단식 9점제" },
  { format: "single", winningScore: 11, label: "남자 단식 11점제" },
]

function BallIcon({ color, ring }: { color: string; ring?: boolean }) {
  return (
    <span
      className="inline-block h-4 w-4 rounded-full align-middle"
      style={{
        backgroundColor: color,
        border: ring ? "2px solid currentColor" : "1px solid rgba(0,0,0,0.25)",
      }}
      aria-hidden
    />
  )
}

export function SetupScreen({ mode, onBack, onStart }: SetupScreenProps) {
  const { theme } = useTheme()
  const isTeamLeague = mode === "teamIndividual" || mode === "doubles"
  const ppt = playersPerTeam(mode)

  const defaultMethod: Method = isTeamLeague ? "set" : "point"
  const defaultTimeouts = isTeamLeague ? "4" : "4"
  const defaultWinningSets = isTeamLeague ? "4" : "3"
  const defaultMaxInnings = 30

  const [method, setMethod] = useState<Method>(defaultMethod)
  const [winningScore, setWinningScore] = useState(isTeamLeague ? "15" : "15")
  const [winningSets, setWinningSets] = useState(defaultWinningSets)
  const [firstBreak, setFirstBreak] = useState<Side>("away")
  const [ballSide, setBallSide] = useState<Side>("away")
  const [timeouts, setTimeouts] = useState(defaultTimeouts)
  const [refereeMain, setRefereeMain] = useState("")
  const [refereeSub, setRefereeSub] = useState("")
  const [refereeRecorder, setRefereeRecorder] = useState("")
  const [recorder1, setRecorder1] = useState("")
  const [recorder2, setRecorder2] = useState("")
  const [memo, setMemo] = useState("")
  const [round, setRound] = useState("")
  const [roundDay, setRoundDay] = useState("")
  const [maxInningsPerSet, setMaxInningsPerSet] = useState(String(defaultMaxInnings))
  const [awayName, setAwayName] = useState("어웨이팀")
  const [homeName, setHomeName] = useState("홈팀")
  const [awayPlayers, setAwayPlayers] = useState<string[]>(["", ""])
  const [homePlayers, setHomePlayers] = useState<string[]>(["", ""])

  const displaySetCount = Math.min(
    Math.max(Number(winningSets) * 2 - 1, DEFAULT_TEAM_LEAGUE_SETS.length),
    DEFAULT_TEAM_LEAGUE_SETS.length,
  )

  const initialSetConfigs = (): PerSetConfig[] =>
    DEFAULT_TEAM_LEAGUE_SETS.slice(0, displaySetCount).map((s) => ({
      ...s,
      awayPlayers: s.format === "doubles" ? ["", ""] : [""],
      homePlayers: s.format === "doubles" ? ["", ""] : [""],
    }))

  const [sets, setSets] = useState<PerSetConfig[]>(() => initialSetConfigs())

  const visibleSets = isTeamLeague ? sets : []
  const shownSetCount = isTeamLeague
    ? Math.min(
        Math.max(1, (Number(winningSets) || 1) * 2 - 1),
        DEFAULT_TEAM_LEAGUE_SETS.length,
      )
    : 0

  if (isTeamLeague && visibleSets.length !== shownSetCount) {
    const trimmed = initialSetConfigs().slice(0, shownSetCount)
    setSets(trimmed)
  }

  const inputStyle = {
    backgroundColor: "transparent",
    borderColor: "currentColor",
    color: theme.fg,
  }

  const updateSet = (i: number, patch: Partial<PerSetConfig>) => {
    setSets((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)))
  }

  const toggleSetFormat = (i: number) => {
    setSets((prev) =>
      prev.map((s, idx) => {
        if (idx !== i) return s
        const nextFormat: "single" | "doubles" = s.format === "doubles" ? "single" : "doubles"
        const pad = (arr: string[], len: number) => {
          if (arr.length === len) return arr
          if (arr.length > len) return arr.slice(0, len)
          return [...arr, ...Array.from({ length: len - arr.length }, () => "")]
        }
        return {
          ...s,
          format: nextFormat,
          awayPlayers: pad(s.awayPlayers, nextFormat === "doubles" ? 2 : 1),
          homePlayers: pad(s.homePlayers, nextFormat === "doubles" ? 2 : 1),
        }
      }),
    )
  }

  const start = () => {
    const score = Math.max(1, Number.parseInt(winningScore, 10) || 1)
    const setsWin = Math.max(1, Number.parseInt(winningSets, 10) || 1)
    const to = Math.min(5, Math.max(1, Number.parseInt(timeouts, 10) || 1))
    const maxInn = Math.max(1, Number.parseInt(maxInningsPerSet, 10) || 30)

    const finalSets: PerSetConfig[] = isTeamLeague
      ? sets.slice(0, shownSetCount).map((s, i) => {
          const pptLocal = s.format === "doubles" ? 2 : 1
          return {
            ...s,
            winningScore: Math.max(1, s.winningScore || 11),
            awayPlayers: s.awayPlayers
              .slice(0, pptLocal)
              .map((p, k) => p.trim() || `${awayName || "어웨이"} 선수${k + 1}`),
            homePlayers: s.homePlayers
              .slice(0, pptLocal)
              .map((p, k) => p.trim() || `${homeName || "홈"} 선수${k + 1}`),
          }
        })
      : []

    const firstAway = (finalSets[0]?.awayPlayers ?? awayPlayers).slice(0, ppt)
    const firstHome = (finalSets[0]?.homePlayers ?? homePlayers).slice(0, ppt)

    const config: MatchConfig = {
      mode,
      method,
      winningScore: score,
      winningSets: setsWin,
      firstBreak,
      ballSide,
      timeouts: to,
      refereeMain: refereeMain.trim(),
      refereeSub: refereeSub.trim(),
      refereeRecorder: refereeRecorder.trim(),
      recorders: [recorder1.trim(), recorder2.trim()].filter((x) => x.length > 0),
      memo: memo.trim(),
      round: round.trim(),
      roundDay: roundDay.trim(),
      maxInningsPerSet: maxInn,
      sets: finalSets,
      away: {
        name: awayName.trim() || "어웨이팀",
        players: firstAway.length
          ? firstAway
          : Array.from({ length: ppt }, (_, i) => `선수${i + 1}`),
      },
      home: {
        name: homeName.trim() || "홈팀",
        players: firstHome.length
          ? firstHome
          : Array.from({ length: ppt }, (_, i) => `선수${i + 1}`),
      },
    }
    onStart(config)
  }

  const TeamColumn = ({
    side,
    name,
    setName,
    players,
    setPlayers,
    hidePlayers,
  }: {
    side: Side
    name: string
    setName: (v: string) => void
    players: string[]
    setPlayers: (v: string[]) => void
    hidePlayers?: boolean
  }) => {
    const isFirst = firstBreak === side
    const isBall = ballSide === side
    return (
      <div
        className="flex flex-col gap-2 rounded-xl border p-3"
        style={{ borderColor: "currentColor" }}
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase opacity-60">
            {side === "away" ? "어웨이 (왼쪽)" : "홈 (오른쪽)"}
          </span>
          <div className="flex items-center gap-1 text-[11px] font-semibold">
            {isFirst && (
              <span className="flex items-center gap-1">
                초구 <BallIcon color="#FFFFFF" ring />
              </span>
            )}
            {isBall && !isFirst && (
              <span className="flex items-center gap-1">
                공 <BallIcon color="#FDD835" />
              </span>
            )}
            {!isFirst && !isBall ? <span className="opacity-70">&nbsp;</span> : null}
          </div>
        </div>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="팀명"
          className="w-full rounded-md border px-2 py-1.5 text-sm font-semibold outline-none"
          style={inputStyle}
        />
        {!hidePlayers &&
          Array.from({ length: ppt }).map((_, i) => (
            <input
              key={i}
              value={players[i] ?? ""}
              onChange={(e) => {
                const next = [...players]
                next[i] = e.target.value
                setPlayers(next)
              }}
              placeholder={ppt > 1 ? `선수 ${i + 1}` : "선수명"}
              className="w-full rounded-md border px-2 py-1.5 text-sm outline-none"
              style={inputStyle}
            />
          ))}
      </div>
    )
  }

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
          <Home className="h-4 w-4" />
          메인
        </button>
        <span className="truncate text-sm font-bold opacity-80">{MODE_LABELS[mode]}</span>
        <button
          type="button"
          onClick={start}
          className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-bold shadow-md active:scale-95"
          style={{ backgroundColor: theme.fg, color: theme.bg, borderColor: theme.fg }}
        >
          <Play className="h-4 w-4" />
          경기시작
        </button>
      </header>

      <main className="flex-1 px-4 py-3">
        <div className="mx-auto flex max-w-2xl flex-col gap-3">
          {isTeamLeague && (
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold opacity-60">라운드</label>
                <input
                  value={round}
                  onChange={(e) => setRound(e.target.value)}
                  placeholder="예: 1라운드"
                  className="w-full rounded-md border px-2 py-1.5 text-sm outline-none"
                  style={inputStyle}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold opacity-60">일차</label>
                <input
                  value={roundDay}
                  onChange={(e) => setRoundDay(e.target.value)}
                  placeholder="예: 1일차"
                  className="w-full rounded-md border px-2 py-1.5 text-sm outline-none"
                  style={inputStyle}
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold opacity-60">방식</label>
              <div
                className="flex overflow-hidden rounded-md border"
                style={{ borderColor: "currentColor" }}
              >
                {(["point", "set"] as Method[]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMethod(m)}
                    className="flex-1 px-2 py-1.5 text-sm font-semibold"
                    style={
                      method === m
                        ? { backgroundColor: theme.fg, color: theme.bg }
                        : { backgroundColor: "transparent" }
                    }
                  >
                    {m === "point" ? "점수제" : "세트제"}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold opacity-60">
                {isTeamLeague ? "최대 이닝 / 세트" : "승리 점수"}
              </label>
              <input
                inputMode="numeric"
                value={isTeamLeague ? maxInningsPerSet : winningScore}
                onChange={(e) => {
                  const v = e.target.value.replace(/[^0-9]/g, "")
                  if (isTeamLeague) setMaxInningsPerSet(v)
                  else setWinningScore(v)
                }}
                className="w-full rounded-md border px-2 py-1.5 text-sm outline-none"
                style={inputStyle}
              />
            </div>
          </div>

          {method === "set" && (
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold opacity-60">승리 세트 수</label>
                <input
                  inputMode="numeric"
                  value={winningSets}
                  onChange={(e) => setWinningSets(e.target.value.replace(/[^0-9]/g, ""))}
                  className="w-full rounded-md border px-2 py-1.5 text-sm outline-none"
                  style={inputStyle}
                />
              </div>
              {!isTeamLeague && (
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold opacity-60">승리 점수 / 세트</label>
                  <input
                    inputMode="numeric"
                    value={winningScore}
                    onChange={(e) => setWinningScore(e.target.value.replace(/[^0-9]/g, ""))}
                    className="w-full rounded-md border px-2 py-1.5 text-sm outline-none"
                    style={inputStyle}
                  />
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold opacity-60">초구 (선공)</label>
              <div
                className="flex overflow-hidden rounded-md border"
                style={{ borderColor: "currentColor" }}
              >
                {(["away", "home"] as Side[]).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setFirstBreak(s)}
                    className="flex-1 px-2 py-1.5 text-sm font-semibold"
                    style={
                      firstBreak === s
                        ? { backgroundColor: theme.fg, color: theme.bg }
                        : { backgroundColor: "transparent" }
                    }
                  >
                    <span className="inline-flex items-center gap-1">
                      <BallIcon color="#FFFFFF" ring />
                      {s === "away" ? "어웨이" : "홈"}
                    </span>
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold opacity-60">공 (볼 배정)</label>
              <div
                className="flex overflow-hidden rounded-md border"
                style={{ borderColor: "currentColor" }}
              >
                {(["away", "home"] as Side[]).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setBallSide(s)}
                    className="flex-1 px-2 py-1.5 text-sm font-semibold"
                    style={
                      ballSide === s
                        ? { backgroundColor: theme.fg, color: theme.bg }
                        : { backgroundColor: "transparent" }
                    }
                  >
                    <span className="inline-flex items-center gap-1">
                      <BallIcon color="#FDD835" />
                      {s === "away" ? "어웨이" : "홈"}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold opacity-60">타임아웃 (1~5) / 세트당 최대 2회</label>
            <input
              inputMode="numeric"
              value={timeouts}
              onChange={(e) =>
                setTimeouts(e.target.value.replace(/[^0-9]/g, "").slice(0, 1))
              }
              className="w-full rounded-md border px-2 py-1.5 text-sm outline-none"
              style={inputStyle}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <TeamColumn
              side="away"
              name={awayName}
              setName={setAwayName}
              players={awayPlayers}
              setPlayers={setAwayPlayers}
              hidePlayers={isTeamLeague}
            />
            <TeamColumn
              side="home"
              name={homeName}
              setName={setHomeName}
              players={homePlayers}
              setPlayers={setHomePlayers}
              hidePlayers={isTeamLeague}
            />
          </div>

          {isTeamLeague &&
            visibleSets.slice(0, shownSetCount).map((sc, i) => (
              <div
                key={i}
                className="rounded-xl border p-3"
                style={{ borderColor: "currentColor" }}
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="text-xs font-black opacity-80">
                    {i + 1}세트 · {sc.label || `${sc.format === "doubles" ? "복식" : "단식"}`}
                  </span>
                  <div className="flex gap-2">
                    <div
                      className="flex overflow-hidden rounded-md border"
                      style={{ borderColor: "currentColor" }}
                    >
                      <button
                        type="button"
                        onClick={() => toggleSetFormat(i)}
                        className="px-2 py-1 text-[11px] font-bold"
                        style={{
                          backgroundColor: theme.fg,
                          color: theme.bg,
                        }}
                      >
                        {sc.format === "doubles" ? "복식" : "단식"} ↔
                      </button>
                    </div>
                    <input
                      inputMode="numeric"
                      value={sc.winningScore}
                      onChange={(e) =>
                        updateSet(i, {
                          winningScore: Math.max(
                            1,
                            Number.parseInt(e.target.value.replace(/[^0-9]/g, "") || "1", 10),
                          ),
                        })
                      }
                      className="w-16 rounded-md border px-2 py-1 text-xs font-bold outline-none"
                      style={inputStyle}
                      title="승점"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {(["away", "home"] as Side[]).map((side) => {
                    const list = side === "away" ? sc.awayPlayers : sc.homePlayers
                    const setList = (v: string[]) =>
                      updateSet(i, side === "away" ? { awayPlayers: v } : { homePlayers: v })
                    return (
                      <div
                        key={side}
                        className="flex flex-col gap-1 rounded-lg border p-2"
                        style={{ borderColor: withAlphaLocal(theme.fg, 0.25) }}
                      >
                        <div
                          className="text-[11px] font-black"
                          style={{ color: TEAM_COLORS[side] }}
                        >
                          {side === "away" ? awayName || "어웨이" : homeName || "홈"}
                        </div>
                        {list.map((p, k) => (
                          <input
                            key={k}
                            value={p}
                            onChange={(e) => {
                              const next = [...list]
                              next[k] = e.target.value
                              setList(next)
                            }}
                            placeholder={
                              sc.format === "doubles"
                                ? `선수 #${k === 0 ? "A" : "B"}`
                                : "선수명"
                            }
                            className="w-full rounded-md border px-2 py-1 text-xs outline-none"
                            style={inputStyle}
                          />
                        ))}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}

          <div className="grid grid-cols-3 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold opacity-60">주심</label>
              <input
                value={refereeMain}
                onChange={(e) => setRefereeMain(e.target.value)}
                className="w-full rounded-md border px-2 py-1.5 text-sm outline-none"
                style={inputStyle}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold opacity-60">부심</label>
              <input
                value={refereeSub}
                onChange={(e) => setRefereeSub(e.target.value)}
                className="w-full rounded-md border px-2 py-1.5 text-sm outline-none"
                style={inputStyle}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold opacity-60">기록심</label>
              <input
                value={refereeRecorder}
                onChange={(e) => setRefereeRecorder(e.target.value)}
                className="w-full rounded-md border px-2 py-1.5 text-sm outline-none"
                style={inputStyle}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold opacity-60">경기원 1</label>
              <input
                value={recorder1}
                onChange={(e) => setRecorder1(e.target.value)}
                className="w-full rounded-md border px-2 py-1.5 text-sm outline-none"
                style={inputStyle}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold opacity-60">경기원 2</label>
              <input
                value={recorder2}
                onChange={(e) => setRecorder2(e.target.value)}
                className="w-full rounded-md border px-2 py-1.5 text-sm outline-none"
                style={inputStyle}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold opacity-60">메모</label>
            <textarea
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              rows={2}
              className="w-full resize-none rounded-md border px-2 py-1.5 text-sm outline-none"
              style={inputStyle}
            />
          </div>

          <div className="grid grid-cols-2 gap-2 pt-2">
            <button
              type="button"
              onClick={onBack}
              className="flex items-center justify-center gap-1.5 rounded-xl border py-3 text-sm font-bold shadow-md active:translate-y-px"
              style={{ borderColor: theme.fg, backgroundColor: theme.bg, color: theme.fg }}
            >
              <ChevronLeft className="h-4 w-4" />
              뒤로
            </button>
            <button
              type="button"
              onClick={start}
              className="flex items-center justify-center gap-1.5 rounded-xl border py-3 text-sm font-bold shadow-md active:translate-y-px"
              style={{
                borderColor: theme.fg,
                backgroundColor: theme.fg,
                color: theme.bg,
              }}
            >
              <Save className="h-4 w-4" />
              경기 시작
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}

function withAlphaLocal(color: string, alpha: number): string {
  if (!color) return color
  if (color.startsWith("#")) {
    const hex = color.replace("#", "")
    const r = parseInt(hex.substring(0, 2), 16)
    const g = parseInt(hex.substring(2, 4), 16)
    const b = parseInt(hex.substring(4, 6), 16)
    return `rgba(${r}, ${g}, ${b}, ${alpha})`
  }
  return color
}
