"use client"

import React, { useState, useEffect, useRef } from "react"
import type { GameAction, MatchConfig, Side } from "@/lib/pba/types"
import {
  calcSetStats,
  calcMatchStats,
  calcMatchWinner,
  calcInningAvg,
  getMatchScores,
  getSetWinner,
  isSetOver,
} from "@/lib/pba/game"
import { downloadMatchHtml, type MatchMeta } from "@/lib/pba/export"
import { withAlpha } from "@/lib/pba/colors"
import { useTheme } from "@/components/pba/theme-context"

// 📌 tour/ 폴더 내부
import { Scoreboard } from "./scoreboard"

// 📌 pba/ 공통 폴더 (절대 경로)
import { useLongPress } from "@/components/pba/use-long-press"
import { PreviewDialog } from "@/components/pba/preview-dialog"
import { ReviewScreen } from "@/components/pba/review-screen"

import type { MatchDraft } from "@/lib/pba/draft"

interface ScoringScreenProps {
  config: MatchConfig
  initialSets?: GameAction[][]
  resumeData?: MatchDraft | null
  tieBreak?: boolean
  tieBreakFirstBreak?: Side
  onDraftChange?: (draft: MatchDraft) => void
  onClearDraft?: () => void
  onExit: () => void
  onFinish: (setActions: GameAction[][], meta: MatchMeta) => void
}

export function ScoringScreen({
  config,
  initialSets,
  resumeData,
  tieBreak,
  tieBreakFirstBreak,
  onDraftChange,
  onClearDraft,
  onExit,
  onFinish,
}: ScoringScreenProps) {
  const { theme } = useTheme()

  // 상태 관리
  const [sets, setSets] = useState<GameAction[][]>(() => {
    if (resumeData?.sets) return resumeData.sets
    if (initialSets && initialSets.length > 0) return initialSets
    return [[]]
  })

  const [currentSetIdx, setCurrentSetIdx] = useState<number>(() => {
    if (resumeData?.currentSetIdx !== undefined) return resumeData.currentSetIdx
    if (initialSets && initialSets.length > 0) return initialSets.length - 1
    return 0
  })

  const [currentInningHits, setCurrentInningHits] = useState<number>(
    resumeData?.currentInningHits ?? 0
  )
  const [activeSide, setActiveSide] = useState<Side>(
    resumeData?.activeSide ?? config.firstBreak
  )
  const [p1Timeouts, setP1Timeouts] = useState<number>(
    resumeData?.p1Timeouts ?? config.p1Timeouts
  )
  const [p2Timeouts, setP2Timeouts] = useState<number>(
    resumeData?.p2Timeouts ?? config.p2Timeouts
  )

  const [showExitConfirm, setShowExitConfirm] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [showReview, setShowReview] = useState(false)

  // 임시 저장 (Draft)
  useEffect(() => {
    if (onDraftChange) {
      onDraftChange({
        config,
        sets,
        currentSetIdx,
        currentInningHits,
        activeSide,
        p1Timeouts,
        p2Timeouts,
        tieBreak: !!tieBreak,
        tieBreakFirstBreak,
      })
    }
  }, [sets, currentSetIdx, currentInningHits, activeSide, p1Timeouts, p2Timeouts])

  const currentSetActions = sets[currentSetIdx] || []
  const matchScores = getMatchScores(config, sets)
  const setWinner = getSetWinner(config, currentSetActions)
  const isCurrentSetFinished = setWinner !== null
  const matchWinner = calcMatchWinner(config, sets)

  // 득점 / 이닝 입력 처리
  const handleAddHit = (val: number) => {
    if (isCurrentSetFinished || matchWinner) return
    setCurrentInningHits((prev) => Math.max(0, prev + val))
  }

  const handleEndInning = () => {
    if (isCurrentSetFinished || matchWinner) return

    const newAction: GameAction = {
      side: activeSide,
      hits: currentInningHits,
    }

    const updatedCurrentSet = [...currentSetActions, newAction]
    const updatedSets = [...sets]
    updatedSets[currentSetIdx] = updatedCurrentSet

    setSets(updatedSets)
    setCurrentInningHits(0)
    setActiveSide((prev) => (prev === "p1" ? "p2" : "p1"))

    // 세트 종료 확인
    const setW = getSetWinner(config, updatedCurrentSet)
    if (setW) {
      const nextMatchWinner = calcMatchWinner(config, updatedSets)
      if (!nextMatchWinner && config.mode === "set" && updatedSets.length < config.targetSets * 2) {
        // 다음 세트 준비
        setSets([...updatedSets, []])
        setCurrentSetIdx(updatedSets.length)
        // 세트별 초구 교대
        const nextFirstBreak = updatedSets.length % 2 === 0 ? config.firstBreak : config.firstBreak === "p1" ? "p2" : "p1"
        setActiveSide(nextFirstBreak)
        setP1Timeouts(config.p1Timeouts)
        setP2Timeouts(config.p2Timeouts)
      }
    }
  }

  const handleUndo = () => {
    if (currentInningHits > 0) {
      setCurrentInningHits(0)
      return
    }

    if (currentSetActions.length === 0) {
      if (currentSetIdx > 0) {
        const prevSetIdx = currentSetIdx - 1
        setCurrentSetIdx(prevSetIdx)
        const prevSetActions = sets[prevSetIdx]
        if (prevSetActions.length > 0) {
          const lastAction = prevSetActions[prevSetActions.length - 1]
          setActiveSide(lastAction.side)
          setCurrentInningHits(lastAction.hits)
          const updatedPrevSet = prevSetActions.slice(0, -1)
          const updatedSets = [...sets]
          updatedSets[prevSetIdx] = updatedPrevSet
          setSets(updatedSets.slice(0, prevSetIdx + 1))
        }
      }
      return
    }

    const lastAction = currentSetActions[currentSetActions.length - 1]
    setActiveSide(lastAction.side)
    setCurrentInningHits(lastAction.hits)

    const updatedCurrentSet = currentSetActions.slice(0, -1)
    const updatedSets = [...sets]
    updatedSets[currentSetIdx] = updatedCurrentSet
    setSets(updatedSets)
  }

  const handleFinishMatch = () => {
    const meta: MatchMeta = {
      date: new Date().toISOString().split("T")[0],
      durationMinutes: 45,
    }
    if (onClearDraft) onClearDraft()
    onFinish(sets, meta)
  }

  return (
    <div className="w-full max-w-4xl mx-auto p-4 md:p-6 space-y-4 select-none font-sans">
      {/* 상단 컨트롤 바 */}
      <div className="flex justify-between items-center bg-slate-100 dark:bg-slate-800 p-3 rounded-2xl">
        <button
          onClick={() => setShowExitConfirm(true)}
          className="px-3 py-1.5 text-xs font-bold rounded-xl bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 shadow-sm"
        >
          &lt; 나가기
        </button>
        <div className="text-center">
          <h2 className="text-sm font-black">{config.mode === "single" ? "점수제 경기" : `${currentSetIdx + 1}세트 진행 중`}</h2>
          <span className="text-xs text-slate-500 font-semibold">목표: {config.targetScore}점</span>
        </div>
        <button
          onClick={() => setShowReview(true)}
          className="px-3 py-1.5 text-xs font-bold rounded-xl bg-slate-900 text-white shadow-sm"
        >
          기록지 보기
        </button>
      </div>

      {/* 스코어보드 모듈 */}
      <Scoreboard
        config={config}
        sets={sets}
        currentSetIdx={currentSetIdx}
        activeSide={activeSide}
        currentInningHits={currentInningHits}
        p1Timeouts={p1Timeouts}
        p2Timeouts={p2Timeouts}
      />

      {/* 점수 및 이닝 조작 버튼 */}
      <div className="grid grid-cols-2 gap-4 pt-2">
        <div className="space-y-2">
          <div className="grid grid-cols-3 gap-2">
            {[1, 2, 3].map((val) => (
              <button
                key={val}
                onClick={() => handleAddHit(val)}
                className="py-4 rounded-2xl bg-indigo-600 text-white font-black text-xl shadow-md active:scale-95 transition-transform"
              >
                +{val}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => handleAddHit(-1)}
              className="py-3 rounded-xl bg-slate-200 dark:bg-slate-700 font-bold text-sm"
            >
              -1 득점
            </button>
            <button
              onClick={handleUndo}
              className="py-3 rounded-xl bg-amber-500 text-white font-bold text-sm shadow-sm"
            >
              되돌리기 (Undo)
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <button
            onClick={handleEndInning}
            className="flex-1 py-6 rounded-2xl bg-slate-900 dark:bg-slate-100 dark:text-slate-900 text-white font-black text-lg shadow-lg active:scale-95 transition-transform"
          >
            이닝 교대 (턴 넘기기)
          </button>
          {(isCurrentSetFinished || matchWinner) && (
            <button
              onClick={handleFinishMatch}
              className="py-3 rounded-xl bg-emerald-600 text-white font-black text-sm shadow-md animate-pulse"
            >
              경기 종료 / 결과 저장
            </button>
          )}
        </div>
      </div>

      {/* 나가기 확인 모달 */}
      {showExitConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl max-w-sm w-full space-y-4 text-center">
            <h3 className="font-black text-lg">경기를 나가시겠습니까?</h3>
            <p className="text-xs text-slate-500">현재까지의 경기 기록은 임시 저장됩니다.</p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowExitConfirm(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-300 font-bold text-xs"
              >
                취소
              </button>
              <button
                onClick={onExit}
                className="flex-1 py-2.5 rounded-xl bg-red-600 text-white font-bold text-xs"
              >
                나가기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 기록지 모달 */}
      {showReview && (
        <ReviewScreen
          config={config}
          sets={sets}
          onClose={() => setShowReview(false)}
        />
      )}
    </div>
  )
}
