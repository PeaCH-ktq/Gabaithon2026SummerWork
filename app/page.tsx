"use client";

import { useEffect, useState } from "react";

import { CreateQuizModal } from "./components/modals/CreateQuizModal";
import { ScheduleModal } from "./components/modals/ScheduleModal";
import { Sidebar } from "./components/Sidebar";
import { Toast } from "./components/Toast";
import { CourseView } from "./components/views/CourseView";
import { GroupView } from "./components/views/GroupView";
import { HomeView } from "./components/views/HomeView";
import { QuizView } from "./components/views/QuizView";
import { TasksView } from "./components/views/TasksView";
import type { View } from "./types";

export default function Home() {
  // 現在の画面、モーダル、タブなど、UIの表示状態を管理する。
  const [view, setView] = useState<View>("home");
  const [modal, setModal] = useState<"none" | "create" | "schedule">("none");
  const [step, setStep] = useState(1);
  const [toast, setToast] = useState("");
  const [activeTab, setActiveTab] = useState<"material" | "quiz">("material");
  const [generating, setGenerating] = useState(false);
  // 操作結果を画面下部のトースト通知に渡す。
  const notify = (message: string) => setToast(message);

  // トーストは表示から2.6秒後に自動で閉じる。
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 2600);
    return () => clearTimeout(timer);
  }, [toast]);
  // このデモではルーティングを使わず、viewの値で表示画面を切り替える。
  function navigate(next: View) {
    setView(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  // 問題作成フローを最初のステップから開く。
  function startCreate() {
    setStep(1);
    setGenerating(false);
    setModal("create");
  }
  // AI生成を模した待機表示の後、作成済み問題集へ移動する。
  function generate() {
    setGenerating(true);
    setTimeout(() => {
      setModal("none");
      setGenerating(false);
      navigate("quiz");
      notify("10問の問題集を作成しました");
    }, 2200);
  }

  return (
    <div className="app-shell">
      {/* 全画面で共通するサイドバーとメインナビゲーション。 */}
      <Sidebar view={view} navigate={navigate} />
      <main className="main">
        {/* ホーム：今日の学習、講義棚、直近の締切。 */}
        {view === "home" && (
          <HomeView
            navigate={navigate}
            startCreate={startCreate}
            notify={notify}
          />
        )}
        {/* 講義詳細：資料と作成済み問題集をタブで切り替える。 */}
        {view === "course" && (
          <CourseView
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            navigate={navigate}
            startCreate={startCreate}
            notify={notify}
          />
        )}
        {/* 問題集：印刷やPDF保存に対応した問題用紙。 */}
        {view === "quiz" && (
          <QuizView navigate={navigate} notify={notify} />
        )}
        {/* 課題：未完了と完了済みのタスクを一覧表示する。 */}
        {view === "tasks" && <TasksView notify={notify} />}
        {/* グループ：勉強会、共有棚、メンバーの活動記録。 */}
        {view === "group" && (
          <GroupView
            navigate={navigate}
            notify={notify}
            openSchedule={() => setModal("schedule")}
          />
        )}
      </main>
      {/* 資料と出題条件を選択する、2段階の問題作成モーダル。 */}
      {modal === "create" && (
        <CreateQuizModal
          step={step}
          generating={generating}
          setStep={setStep}
          generate={generate}
          onClose={() => setModal("none")}
        />
      )}
      {/* 新しい勉強会の日付・時刻・場所を入力するモーダル。 */}
      {modal === "schedule" && (
        <ScheduleModal onClose={() => setModal("none")} notify={notify} />
      )}
      {/* 保存や共有などの操作結果を一時的に知らせる。 */}
      <Toast message={toast} />
    </div>
  );
}
