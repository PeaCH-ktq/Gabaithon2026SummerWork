"use client";

import { useCallback, useEffect, useState } from "react";

import { CreateQuizModal } from "./components/modals/CreateQuizModal";
import { MaterialModal } from "./components/modals/MaterialModal";
import { ScheduleModal } from "./components/modals/ScheduleModal";
import { ShelfModal } from "./components/modals/ShelfModal";
import { Sidebar } from "./components/Sidebar";
import { Toast } from "./components/Toast";
import { CourseView } from "./components/views/CourseView";
import { AccountView } from "./components/views/AccountView";
import { GroupView } from "./components/views/GroupView";
import { HomeView } from "./components/views/HomeView";
import { QuizView } from "./components/views/QuizView";
import { TasksView } from "./components/views/TasksView";
import type { LoadState, MaterialRow, Shelf, ShelfFormValues, View } from "./types";
import { createClient } from "@/lib/supabase/client";
import { createShelf, listShelves, updateShelf } from "@/lib/data/shelves";
import { listMaterialsByShelf } from "@/lib/data/materials";
import { pickShelfColor } from "@/lib/format/schedule";
import type { QuestionSet } from "@/lib/gemini/schema";

export default function Home() {
  const [supabase] = useState(() => createClient());
  // 現在の画面、モーダル、タブなど、UIの表示状態を管理する。
  const [view, setView] = useState<View>("home");
  const [modal, setModal] = useState<"none" | "create" | "schedule" | "shelf" | "material">("none");
  const [shelves, setShelves] = useState<Shelf[]>([]);
  const [shelvesState, setShelvesState] = useState<LoadState>("loading");
  const [selectedShelfId, setSelectedShelfId] = useState<string | null>(null);
  const [savingShelf, setSavingShelf] = useState(false);
  const [courseMaterials, setCourseMaterials] = useState<Record<string, MaterialRow[]>>({});
  const [materialsState, setMaterialsState] = useState<LoadState>("loading");
  const [step, setStep] = useState(1);
  const [toast, setToast] = useState("");
  const [activeTab, setActiveTab] = useState<"material" | "quiz">("material");
  const [generating, setGenerating] = useState(false);
  const [generatedQuiz, setGeneratedQuiz] = useState<QuestionSet | null>(null);
  // 操作結果を画面下部のトースト通知に渡す。
  const notify = (message: string) => setToast(message);

  // トーストは表示から2.6秒後に自動で閉じる。
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 2600);
    return () => clearTimeout(timer);
  }, [toast]);

  const loadShelves = useCallback(async () => {
    setShelvesState("loading");
    try {
      const rows = await listShelves(supabase);
      setShelves(rows);
      setShelvesState("ready");
      return rows;
    } catch (err) {
      console.error(err);
      setShelvesState("error");
      return [];
    }
  }, [supabase]);

  useEffect(() => {
    void loadShelves();
  }, [loadShelves]);

  const loadMaterials = useCallback(
    async (shelfId: string) => {
      setMaterialsState("loading");
      try {
        const rows = await listMaterialsByShelf(supabase, shelfId);
        setCourseMaterials((current) => ({ ...current, [shelfId]: rows }));
        setMaterialsState("ready");
      } catch (err) {
        console.error(err);
        setMaterialsState("error");
      }
    },
    [supabase],
  );

  // このデモではルーティングを使わず、viewの値で表示画面を切り替える。
  function navigate(next: View) {
    setView(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const selectedShelf = shelves.find((shelf) => shelf.id === selectedShelfId) ?? null;

  function openCourse(id: string) {
    setSelectedShelfId(id);
    void loadMaterials(id);
    navigate("course");
  }

  async function saveShelf(values: ShelfFormValues, id?: string) {
    setSavingShelf(true);
    try {
      const row = id
        ? await updateShelf(supabase, id, values)
        : await createShelf(supabase, { ...values, color: pickShelfColor(shelves.length) });
      await loadShelves();
      setSelectedShelfId(row.id);
      setModal("none");
      notify(id ? "棚を更新しました" : "棚を作成しました");
    } catch (err) {
      notify(err instanceof Error ? err.message : "棚の保存に失敗しました");
    } finally {
      setSavingShelf(false);
    }
  }

  // 問題作成フローを最初のステップから開く。
  function startCreate() {
    setStep(1);
    setGenerating(false);
    setModal("create");
  }
  function finishGeneration(questionSet: QuestionSet) {
    setGeneratedQuiz(questionSet);
    setModal("none");
    setGenerating(false);
    navigate("quiz");
    notify(`${questionSet.questions.length}問の問題集を作成しました`);
  }

  return (
    <div className="app-shell">
      {/* 全画面で共通するサイドバーとメインナビゲーション。 */}
      <Sidebar view={view} navigate={navigate} groupName="情報工学3年" />
      <main className="main">
        {/* ホーム：今日の学習、講義棚、直近の締切。 */}
        {view === "home" && (
          <HomeView
            shelves={shelves}
            shelvesState={shelvesState}
            openCourse={openCourse}
            openShelf={() => { setView("home"); setSelectedShelfId(null); setModal("shelf"); }}
            navigate={navigate}
            startCreate={startCreate}
            notify={notify}
          />
        )}
        {/* 講義詳細：資料と作成済み問題集をタブで切り替える。 */}
        {view === "course" && selectedShelf && (
          <CourseView
            shelf={selectedShelf}
            materials={courseMaterials[selectedShelf.id] ?? []}
            materialsState={materialsState}
            openMaterial={() => setModal("material")}
            editCourse={() => setModal("shelf")}
            toggleShare={() => notify("共有はグループ画面から設定できます")}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            navigate={navigate}
            startCreate={startCreate}
          />
        )}
        {view === "course" && !selectedShelf && (
          <p className="muted">棚が見つかりません。<button className="text-link" onClick={() => navigate("home")}>棚の一覧へ戻る</button></p>
        )}
        {/* 問題集：印刷やPDF保存に対応した問題用紙。 */}
        {view === "quiz" && (
          <QuizView navigate={navigate} notify={notify} questionSet={generatedQuiz} />
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
        {view === "account" && <AccountView navigate={navigate} notify={notify} />}
      </main>
      {/* 資料と出題条件を選択する、2段階の問題作成モーダル。 */}
      {modal === "create" && (
        <CreateQuizModal
          step={step}
          generating={generating}
          setStep={setStep}
          setGenerating={setGenerating}
          onGenerated={finishGeneration}
          onClose={() => setModal("none")}
        />
      )}
      {/* 新しい勉強会の日付・時刻・場所を入力するモーダル。 */}
      {modal === "schedule" && (
        <ScheduleModal onClose={() => setModal("none")} notify={notify} />
      )}
      {modal === "shelf" && (
        <ShelfModal
          initial={view === "course" ? selectedShelf ?? undefined : undefined}
          saving={savingShelf}
          onClose={() => setModal("none")}
          onSave={saveShelf}
        />
      )}
      {modal === "material" && selectedShelf && (
        <MaterialModal
          onClose={() => setModal("none")}
          onAdd={(name) => {
            setModal("none");
            notify(`「${name}」は資料アップロード実装後に保存されます`);
          }}
        />
      )}
      {/* 保存や共有などの操作結果を一時的に知らせる。 */}
      <Toast message={toast} />
    </div>
  );
}
