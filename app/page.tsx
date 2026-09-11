"use client"

import { useState } from "react"
import type { GameAction, GameMode, MatchConfig, Side } from "@/lib/pba/types"
import type { MatchMeta } from "@/lib/pba/export"
import { ThemeProvider, useTheme } from "@/components/pba/theme-context"
import { MainScreen } from "@/components/pba/main-screen"
import { Footer } from "@/components/pba/footer"
import { clearDraft, loadDraft, type MatchDraft } from "@/lib/pba/draft"

// 📌 [1부투어 전용 모듈 불러오기]
import { SetupScreen as TourSetupScreen } from "@/components/pba/tour/setup-screen"
import { ScoringScreen as TourScoringScreen } from "@/components/pba/tour/scoring-screen"
import { ResultScreen } from "@/components/pba/result-screen"

type Screen = "main" | "setup" | "scoring" | "result" | "team"

function App() {
  const { theme } = useTheme()
  const [screen, setScreen] = useState<Screen>("main")
  const [mode, setMode] = useState<GameMode>("single")
  const [config, setConfig] = useState<MatchConfig | null>(null)
  const [result, setResult] = useState<GameAction[][]>([])
  const [meta, setMeta] = useState<MatchMeta | undefined>()
  const [editing, setEditing] = useState(false)
  const [tieBreak, setTieBreak] = useState(false)
  const [tieBreakFirstBreak, setTieBreakFirstBreak] = useState<Side | undefined>(undefined)
  const [forcedWinner, setForcedWinner] = useState<Side | null>(null)
  const [draft, setDraft] = useState<MatchDraft | null>(() => loadDraft())
  const [resumeData, setResumeData] = useState<MatchDraft | null>(null)

  const startScoring = (c: MatchConfig, d?: MatchDraft) => {
    setEditing(false)
    setConfig(c)
    setForcedWinner(null)
    if (d) {
      setResumeData(d)
      setTieBreak(d.tieBreak)
      setTieBreakFirstBreak(d.tieBreakFirstBreak)
    } else {
      setResumeData(null)
      setTieBreak(false)
      setTieBreakFirstBreak(undefined)
    }
    setScreen("scoring")
  }

  const handleResume = () => {
    if (!draft) return
    startScoring(draft.config, draft)
  }

  const handleDiscardDraft = () => {
    clearDraft()
    setDraft(null)
  }

  return (
    <div className="flex h-svh flex-col transition-colors" style={{ backgroundColor: theme.bg, color: theme.fg }}>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {/* 메인 화면: 1부투어 / 팀리그 선택 */}
        {screen === "main" && (
          <MainScreen
            draft={draft}
            onResume={handleResume}
            onDiscardDraft={handleDiscardDraft}
            onSelect={(m) => {
              setMode(m)
              if (m === "team") {
                setScreen("team")
              } else {
                setScreen("setup")
              }
            }}
          />
        )}

        {/* ================= 1부투어(개인전) 테스트 흐름 ================= */}
        {screen === "setup" && mode === "single" && (
          <TourSetupScreen mode={mode} onBack={() => setScreen("main")} onStart={(c) => startScoring(c)} />
        )}

        {screen === "scoring" && config && mode === "single" && (
          <TourScoringScreen
            config={config}
            initialSets={editing ? result : undefined}
            resumeData={resumeData}
            tieBreak={tieBreak}
            tieBreakFirstBreak={tieBreakFirstBreak}
            onDraftChange={(d) => setDraft(d)}
            onClear={handleDiscardDraft}
            onExit={() => setScreen("main")}
            onFinish={(setActions, m) => {
              setResult(setActions)
              setMeta(m)
              setScreen("result")
            }}
          />
        )}

        {/* ================= 팀리그 모드 (임시 안내 화면) ================= */}
        {screen === "team" && (
          <div className="max-w-md mx-auto my-16 p-6 bg-white dark:bg-slate-900 rounded-2xl shadow-lg text-center space-y-4 border border-slate-200 dark:border-slate-800">
            <h2 className="text-xl font-black text-indigo-600 dark:text-indigo-400">팀리그 모드</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              1부투어 모드 테스트 완료 후 팀리그 전용 모듈이 연결됩니다.
            </p>
            <button
              onClick={() => setScreen("main")}
              className="px-6 py-2 bg-slate-900 text-white font-bold rounded-xl text-sm"
            >
              메인으로 돌아가기
            </button>
          </div>
        )}

        {/* 경기 결과 공통 모듈 */}
        {screen === "result" && config && (
          <ResultScreen
            config={config}
            setActions={result}
            meta={meta}
            forcedWinner={forcedWinner}
            onEdit={() => setScreen("scoring")}
            onHome={() => setScreen("main")}
            onTieBreak={(firstBreak) => {
              setTieBreak(true)
              setTieBreakFirstBreak(firstBreak)
              setScreen("scoring")
            }}
            onForceWinner={(side) => setForcedWinner(side)}
          />
        )}
      </div>
      <Footer />
    </div>
  )
}

export default function Page() {
  return (
    <ThemeProvider>
      <App />
    </ThemeProvider>
  )
}
