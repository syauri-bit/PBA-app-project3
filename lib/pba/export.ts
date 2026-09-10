import { deriveSet, firstBreakForSet, formatAverage, getSetConfig, getSetPlayers, isDoublesSet } from "./game"
import type { DerivedSet, GameAction, MatchConfig, Side } from "./types"
import { MODE_LABELS } from "./types"

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function DoublesLetter(idx: number): "A" | "B" {
  return idx === 0 ? "A" : "B"
}

function playerName(config: MatchConfig, setIndex: number, side: Side, idx: number): string {
  const list = getSetPlayers(config, setIndex, side)
  const raw = list[idx] ?? list[0] ?? "선수"
  const doubles = isDoublesSet(config, setIndex)
  return doubles ? `${esc(raw)}#${DoublesLetter(idx)}` : esc(raw)
}

function setTableHtml(config: MatchConfig, setIndex: number, derived: DerivedSet): string {
  const lastInning = Math.max(
    derived.away.turns.reduce((m, t) => Math.max(m, t.inning), 0),
    derived.home.turns.reduce((m, t) => Math.max(m, t.inning), 0),
    1,
  )
  const doubles = isDoublesSet(config, setIndex)
  const rows: string[] = []
  for (let i = 1; i <= lastInning; i++) {
    const a = derived.away.turns.find((t) => t.inning === i)
    const h = derived.home.turns.find((t) => t.inning === i)
    const cell = (side: Side, t?: (typeof derived.away.turns)[number]) => {
      if (!t) return "&nbsp;"
      const displayName = doubles
        ? `${esc((getSetPlayers(config, setIndex, side)[t.playerIndex] ?? getSetPlayers(config, setIndex, side)[0] ?? "선수"))}#${DoublesLetter(t.playerIndex)}`
        : esc((getSetPlayers(config, setIndex, side)[t.playerIndex] ?? getSetPlayers(config, setIndex, side)[0] ?? "선수"))
      const seqHtml = t.sequence.length || t.markers.length
        ? `<div class="seq">${t.sequence
            .map((v, si) => {
              const pIdx = t.playerSequence[si] ?? t.playerIndex
              return `<span>${doubles ? `<i>${DoublesLetter(pIdx)}</i>${v}` : `${v}`}</span>`
            })
            .join("")}${t.markers
              .map((m) => `<span class="marker">${m === "T" ? "ⓣ" : m}</span>`)
              .join("")}</div>`
        : ""
      return `<div class="name">${displayName}</div>
        <div class="line"><span class="pts">+${t.points}</span><span class="tot">${t.runningTotal}</span></div>
        ${seqHtml}`
    }
    rows.push(
      `<tr><td class="away">${cell("away", a)}</td><td class="inn">${i}</td><td class="home">${cell("home", h)}</td></tr>`,
    )
  }
  return `<table class="sheet">
    <thead><tr><th>${esc(config.away.name)}</th><th>이닝</th><th>${esc(config.home.name)}</th></tr></thead>
    <tbody>${rows.join("")}</tbody>
  </table>`
}

function statsHtml(config: MatchConfig, setIndex: number, derived: DerivedSet): string {
  const line = (side: Side) => {
    const d = derived[side]
    const team = side === "away" ? config.away : config.home
    const players = getSetPlayers(config, setIndex, side)
    const playersLabel = players.length ? players.join(", ") : team.players.join(", ")
    return `<div class="stat">
      <b>${esc(team.name)}</b>
      <div class="stat-players">${esc(playersLabel)}</div>
      <span>총점 ${d.total}</span>
      <span>이닝 ${d.innings}</span>
      <span>AVG ${formatAverage(d.average)}</span>
      <span>HR ${d.highRun}</span>
      <span>타임아웃 ${d.timeoutsUsed}/${config.timeouts}</span>
      <span>세트T ${d.setTimeoutsUsed}/2</span>
    </div>`
  }
  return `<div class="stats">${line("away")}${line("home")}</div>`
}

function playerStatsHtml(config: MatchConfig, setIndex: number, derived: DerivedSet): string {
  const line = (side: Side) => {
    const team = side === "away" ? config.away : config.home
    const d = derived[side]
    const players = getSetPlayers(config, setIndex, side)
    const byPlayer = players.map((name, idx) => {
      const pts = d.turns
        .filter((t) => t.playerIndex === idx)
        .reduce((sum, t) => sum + t.points, 0)
      const doubles = isDoublesSet(config, setIndex)
      const label = doubles ? `${name}#${DoublesLetter(idx)}` : name
      return `<span>${esc(label)}: ${pts}점</span>`
    })
    return `<div class="pstat"><b>${esc(team.name)}</b>${byPlayer.join("")}</div>`
  }
  return `<div class="pstats">${line("away")}${line("home")}</div>`
}

export interface MatchMeta {
  startedAt: number
  endedAt: number
}

export function buildMatchHtml(
  config: MatchConfig,
  setActions: GameAction[][],
  meta?: MatchMeta,
): string {
  const derivedSets = setActions.map((a, i) =>
    deriveSet(a, config, firstBreakForSet(config, i), false, i),
  )
  const setsHtml = derivedSets
    .map((d, i) => {
      const sc = getSetConfig(config, i)
      const setLabelBits: string[] = [`${i + 1}세트`]
      if (sc?.label) setLabelBits.push(sc.label)
      if (d.tieBreak) setLabelBits.push("승부치기")
      if (d.decidedByBanking) setLabelBits.push("뱅킹 결정")
      if (d.winner) {
        setLabelBits.push(`승자 ${esc(d.winner === "away" ? config.away.name : config.home.name)}`)
      }
      const heading =
        setActions.length > 1
          ? `<h3>${setLabelBits.join(" · ")}</h3>`
          : ""
      return `<section class="setblock">${heading}${statsHtml(config, i, d)}${setTableHtml(config, i, d)}${playerStatsHtml(config, i, d)}</section>`
    })
    .join("")

  const now = new Date().toLocaleString("ko-KR")
  const duration =
    meta && meta.endedAt > meta.startedAt
      ? formatDuration(meta.endedAt - meta.startedAt)
      : ""

  const judges: string[] = []
  if (config.refereeMain) judges.push(`주심 ${esc(config.refereeMain)}`)
  if (config.refereeSub) judges.push(`부심 ${esc(config.refereeSub)}`)
  if (config.refereeRecorder) judges.push(`기록심 ${esc(config.refereeRecorder)}`)
  if (config.recorders?.length) judges.push(`경기원 ${esc(config.recorders.join(", "))}`)

  const firstBreakName = esc(config.firstBreak === "away" ? config.away.name : config.home.name)
  const ballSideName = esc(config.ballSide === "away" ? config.away.name : config.home.name)

  return `<!DOCTYPE html>
<html lang="ko"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>PBA 경기 기록지</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 0; padding: 24px; color: #212121; background: #fff; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  .meta { color: #555; font-size: 13px; margin-bottom: 16px; line-height: 1.7; }
  .meta span { margin-right: 12px; }
  .setblock { margin-bottom: 28px; }
  h3 { font-size: 16px; margin: 0 0 8px; }
  .stats { display: flex; gap: 16px; flex-wrap: wrap; margin-bottom: 10px; }
  .stat { border: 1px solid #ddd; border-radius: 8px; padding: 8px 12px; font-size: 13px; }
  .stat b { display: block; margin-bottom: 2px; }
  .stat-players { font-size: 11px; opacity: 0.7; margin-bottom: 4px; }
  .stat span { margin-right: 10px; }
  .pstats { display: flex; gap: 16px; flex-wrap: wrap; margin-bottom: 10px; }
  .pstat { border: 1px solid #eee; border-radius: 8px; padding: 8px 12px; font-size: 12px; }
  .pstat b { display: block; margin-bottom: 4px; }
  .pstat span { margin-right: 10px; }
  table.sheet { width: 100%; border-collapse: collapse; font-size: 13px; }
  table.sheet th, table.sheet td { border: 1px solid #e0e0e0; padding: 6px 8px; vertical-align: top; }
  table.sheet th { background: #f5f5f5; }
  .inn { width: 44px; text-align: center; color: #888; font-weight: 700; }
  .name { font-size: 11px; color: #666; }
  .line { display: flex; justify-content: space-between; }
  .pts { font-weight: 800; font-size: 16px; }
  .tot { font-weight: 700; }
  .seq { display: flex; flex-wrap: wrap; gap: 3px; margin-top: 4px; }
  .seq span { border: 1px solid #ccc; border-radius: 3px; padding: 1px 4px; font-size: 11px; font-weight: 700; min-width: 16px; text-align: center; }
  .seq span i { font-style: normal; opacity: 0.7; margin-right: 1px; font-size: 10px; }
  .seq .marker { border-color: #E53935; color: #E53935; }
  footer { margin-top: 24px; text-align: center; color: #999; font-size: 12px; }
</style></head>
<body>
  <h1>PBA 경기 기록지</h1>
  <div class="meta">
    <span>${esc(MODE_LABELS[config.mode])}</span>
    <span>${config.method === "point" ? "점수제" : "세트제"}</span>
    <span>승리점수 ${config.winningScore}</span>
    ${config.method === "set" ? `<span>승리세트 ${config.winningSets}</span>` : ""}
    ${config.maxInningsPerSet ? `<span>세트당 최대 ${config.maxInningsPerSet}이닝</span>` : ""}
    <br/>
    <span>초구 ${firstBreakName}</span>
    <span>공 ${ballSideName}</span>
    <span>타임아웃 ${config.timeouts}회 (세트당 2회)</span>
    ${duration ? `<span>소요시간 ${esc(duration)}</span>` : ""}
    ${config.round || config.roundDay ? `<br/>` : ""}
    ${config.round ? `<span>라운드 ${esc(config.round)}</span>` : ""}
    ${config.roundDay ? `<span>일차 ${esc(config.roundDay)}</span>` : ""}
    ${judges.length ? `<br/>${judges.join(" / ")}` : ""}
    <br/>
    <span>출력 ${esc(now)}</span>
    ${config.memo ? `<br/><span>메모: ${esc(config.memo)}</span>` : ""}
  </div>
  ${setsHtml}
  <footer>Made by Jmean</footer>
</body></html>`
}

export function formatDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  const parts: string[] = []
  if (h > 0) parts.push(`${h}시간`)
  parts.push(`${m}분`)
  parts.push(`${s}초`)
  return parts.join(" ")
}

function slugify(s: string): string {
  return (s || "").replace(/[\\/:*?"<>|\s]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") || "X"
}

function dateStampForFileName(d = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}${m}${day}`
}

/** Triggers a browser download of the match record as an .html file. */
export function downloadMatchHtml(
  config: MatchConfig,
  setActions: GameAction[][],
  meta?: MatchMeta,
) {
  const html = buildMatchHtml(config, setActions, meta)
  const blob = new Blob([html], { type: "text/html;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  const stamp = dateStampForFileName(meta?.endedAt ? new Date(meta.endedAt) : new Date())
  const isTeamLeague = config.mode === "doubles" || config.mode === "teamIndividual"
  let fileName: string
  if (isTeamLeague) {
    const awayTeam = slugify(config.away.name)
    const homeTeam = slugify(config.home.name)
    const awayPlayer1 = slugify((config.sets?.[0]?.awayPlayers ?? config.away.players)[0] ?? "")
    const homePlayer1 = slugify((config.sets?.[0]?.homePlayers ?? config.home.players)[0] ?? "")
    fileName = `PBA-${awayTeam}-${awayPlayer1}-${homeTeam}-${homePlayer1}-${stamp}.html`
  } else {
    const p1 = slugify(config.away.players[0] ?? config.away.name)
    const p2 = slugify(config.home.players[0] ?? config.home.name)
    fileName = `PBA-${p1}-${p2}-${stamp}.html`
  }
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
