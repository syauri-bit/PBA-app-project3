"use client"

import React, { useState } from "react"
import type { GameMode, MatchConfig, Side } from "@/lib/pba/types"

interface SetupScreenProps {
  mode: GameMode
  onBack: () => void
  onStart: (config: MatchConfig) => void
}

export function SetupScreen({ onBack, onStart }: SetupScreenProps) {
  const [matchMode, setMatchMode] = useState<"single" | "set">("single")
  const [targetScore, setTargetScore] = useState<number>(15)
  const [targetSets, setTargetSets] = useState<number>(3)
  
  // 초구 선택 (p1: 왼쪽 선수, p2: 오른쪽 선수) -> 초구 선택 시 해당 선수가 흰공(⚪)
  const [firstBreak, setFirstBreak] = useState<Side>("p1")

  // 타임아웃 (1부투어 기본값 1, 0 또는 1 선택)
  const [timeouts, setTimeouts] = useState<number>(1)

  // 선수 및 임원 정보
  const [p1Name, setP1Name] = useState("")
  const [p1Club, setP1Club] = useState("")
  const [p2Name, setP2Name] = useState("")
  const [p2Club, setP2Club] = useState("")

  const [referee, setReferee] = useState("")
  const [assistantReferee, setAssistantReferee] = useState("")
  const [scorer, setScorer] = useState("")
  const [official1, setOfficial1] = useState("")
  const [official2, setOfficial2] = useState("")
  const [memo, setMemo] = useState("")

  const handleStart = () => {
    const config: MatchConfig = {
      mode: matchMode,
      targetScore: matchMode === "single" ? targetScore : 15,
      targetSets: matchMode === "set" ? targetSets : 1,
      firstBreak,
      whiteBallSide: firstBreak, // 1부투어 규칙: 초구 선택한 측이 흰색 공
      p1Timeouts: timeouts,
      p2Timeouts: timeouts,
      player1: { name: p1Name || "선수 1", club: p1Club },
      player2: { name: p2Name || "선수 2", club: p2Club },
      referee,
      assistantReferee,
      scorer,
      official1,
      official2,
      memo,
    }
    onStart(config)
  }

  return (
    <div className="w-full max-w-2xl mx-auto p-4 md:p-6 space-y-6 select-none font-sans">
      {/* 헤더 */}
      <div className="flex justify-between items-center pb-2 border-b border-slate-200 dark:border-slate-800">
        <button
          onClick={onBack}
          className="px-3 py-1.5 text-xs font-bold rounded-lg bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 hover:opacity-80"
        >
          &lt; 메인
        </button>
        <h1 className="text-base md:text-lg font-black text-slate-900 dark:text-white">1부투어 (개인전) 경기 설정</h1>
        <div className="w-12" />
      </div>

      <div className="space-y-5">
        {/* 경기 방식 선택 */}
        <div>
          <label className="block text-xs font-bold text-slate-500 mb-1.5">경기 방식</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => {
                setMatchMode("single")
                setTargetScore(15)
              }}
              className={`py-2.5 rounded-xl font-extrabold text-sm border-2 transition-all ${
                matchMode === "single"
                  ? "bg-slate-900 text-white border-slate-900 shadow-sm"
                  : "bg-white text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700"
              }`}
            >
              점수제
            </button>
            <button
              onClick={() => {
                setMatchMode("set")
                setTargetScore(15)
              }}
              className={`py-2.5 rounded-xl font-extrabold text-sm border-2 transition-all ${
                matchMode === "set"
                  ? "bg-slate-900 text-white border-slate-900 shadow-sm"
                  : "bg-white text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700"
              }`}
            >
              세트제
            </button>
          </div>
        </div>

        {/* 승리 조건 (점수 / 세트 수) */}
        {matchMode === "single" ? (
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1.5">승리 점수</label>
            <input
              type="number"
              value={targetScore}
              onChange={(e) => setTargetScore(Number(e.target.value))}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>
        ) : (
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1.5">선승 세트 수 (예: 3세트 선승)</label>
            <input
              type="number"
              value={targetSets}
              onChange={(e) => setTargetSets(Number(e.target.value))}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>
        )}

        {/* 타임아웃 입력 */}
        <div>
          <label className="block text-xs font-bold text-slate-500 mb-1.5">
            {matchMode === "set" ? "타임아웃 (세트당 사용 가능 횟수)" : "타임아웃 (0 또는 1)"}
          </label>
          <select
            value={timeouts}
            onChange={(e) => setTimeouts(Number(e.target.value))}
            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
          >
            <option value={1}>1회 (기본값)</option>
            <option value={0}>0회 (없음)</option>
          </select>
        </div>

        {/* 선수 정보 입력 및 초구/공 선택 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          {/* 선수 1 (왼쪽) */}
          <div className="p-4 rounded-2xl border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-xs font-black text-slate-700 dark:text-slate-300 flex items-center gap-1">
                선수 1 (왼쪽) {firstBreak === "p1" ? "⚪ (흰공)" : "🟡 (노란공)"}
              </span>
              <label className="flex items-center space-x-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="firstBreak"
                  checked={firstBreak === "p1"}
                  onChange={() => setFirstBreak("p1")}
                  className="w-4 h-4 text-slate-900 focus:ring-slate-900"
                />
                <span className="text-xs font-bold text-slate-600 dark:text-slate-400">초구 선택</span>
              </label>
            </div>
            <input
              type="text"
              placeholder="선수명 입력"
              value={p1Name}
              onChange={(e) => setP1Name(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-bold focus:outline-none"
            />
            <input
              type="text"
              placeholder="소속/클럽 (선택)"
              value={p1Club}
              onChange={(e) => setP1Club(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-500 focus:outline-none"
            />
          </div>

          {/* 선수 2 (오른쪽) */}
          <div className="p-4 rounded-2xl border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-xs font-black text-slate-700 dark:text-slate-300 flex items-center gap-1">
                선수 2 (오른쪽) {firstBreak === "p2" ? "⚪ (흰공)" : "🟡 (노란공)"}
              </span>
              <label className="flex items-center space-x-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="firstBreak"
                  checked={firstBreak === "p2"}
                  onChange={() => setFirstBreak("p2")}
                  className="w-4 h-4 text-slate-900 focus:ring-slate-900"
                />
                <span className="text-xs font-bold text-slate-600 dark:text-slate-400">초구 선택</span>
              </label>
            </div>
            <input
              type="text"
              placeholder="선수명 입력"
              value={p2Name}
              onChange={(e) => setP2Name(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-bold focus:outline-none"
            />
            <input
              type="text"
              placeholder="소속/클럽 (선택)"
              value={p2Club}
              onChange={(e) => setP2Club(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-500 focus:outline-none"
            />
          </div>
        </div>

        {/* 임원 및 기록 심판 */}
        <div className="grid grid-cols-3 gap-2 pt-2">
          <input
            type="text"
            placeholder="주심"
            value={referee}
            onChange={(e) => setReferee(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs bg-white dark:bg-slate-800"
          />
          <input
            type="text"
            placeholder="부심"
            value={assistantReferee}
            onChange={(e) => setAssistantReferee(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs bg-white dark:bg-slate-800"
          />
          <input
            type="text"
            placeholder="기록심"
            value={scorer}
            onChange={(e) => setScorer(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs bg-white dark:bg-slate-800"
          />
        </div>

        {/* 하단 버튼 */}
        <div className="flex gap-3 pt-4">
          <button
            onClick={onBack}
            className="flex-1 py-3 rounded-xl font-extrabold text-sm border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300"
          >
            &lt; 뒤로
          </button>
          <button
            onClick={handleStart}
            className="flex-1 py-3 rounded-xl font-extrabold text-sm bg-slate-900 text-white shadow-lg hover:bg-slate-800"
          >
            경기 시작
          </button>
        </div>
      </div>
    </div>
  )
}
