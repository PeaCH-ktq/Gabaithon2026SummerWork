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
import { LogoutView } from "./components/views/LogoutView";
import { ProfileEditView } from "./components/views/ProfileEditView";
import { GroupView } from "./components/views/GroupView";
import { HomeView } from "./components/views/HomeView";
import { QuizView } from "./components/views/QuizView";
import { TasksView } from "./components/views/TasksView";
import type { Assignment, LoadState, MaterialRow, Profile, QuestionSetRow, Shelf, ShelfFormValues, View } from "./types";
import { createClient } from "@/lib/supabase/client";
import { createShelf, listShelves, updateShelf } from "@/lib/data/shelves";
import { listMaterialsByShelf, uploadMaterial } from "@/lib/data/materials";
import { listQuestionSetsByShelf } from "@/lib/data/questionSets";
import { pickShelfColor } from "@/lib/format/schedule";
import { deadlines } from "./demo-data";
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
  const [courseQuestionSets, setCourseQuestionSets] = useState<Record<string, QuestionSetRow[]>>({});
  const [questionSetsState, setQuestionSetsState] = useState<LoadState>("loading");
  const [assignments, setAssignments] = useState<Assignment[]>(deadlines);
  const [profile, setProfile] = useState<Profile>({ displayName: "ゆうた", faculty: "工学部", department: "情報工学科", email: "yuta@example.jp" });
  const [step, setStep] = useState(1);
  const [toast, setToast] = useState("");
  const [activeTab, setActiveTab] = useState<"material" | "quiz">("material");
  const [generating, setGenerating] = useState(false);
  const [selectedQuestionSetId, setSelectedQuestionSetId] = useState<string | null>(null);
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

  const loadQuestionSets = useCallback(
    async (shelfId: string) => {
      setQuestionSetsState("loading");
      try {
        const rows = await listQuestionSetsByShelf(supabase, shelfId);
        setCourseQuestionSets((current) => ({ ...current, [shelfId]: rows }));
        setQuestionSetsState("ready");
      } catch (err) {
        console.error(err);
        setQuestionSetsState("error");
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
    void loadQuestionSets(id);
    navigate("course");
  }

  function openQuiz(id: string) {
    setSelectedQuestionSetId(id);
  }

  function openShelves() {
    setView("home");
    window.setTimeout(() => document.getElementById("course-shelves")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
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

  // 問題作成フローを最初のステップから開く。講義未選択なら棚選択を促す。
  function startCreate() {
    if (!selectedShelf) {
      openShelves();
      notify("講義を選んでから問題をつくれます");
      return;
    }
    setStep(1);
    setGenerating(false);
    setModal("create");
  }
  function finishGeneration(questionSetId: string | null, questionSet: QuestionSet) {
    setSelectedQuestionSetId(questionSetId);
    setModal("none");
    setGenerating(false);
    navigate("quiz");
    if (selectedShelf) void loadQuestionSets(selectedShelf.id);
    void loadShelves();
    if (questionSetId) {
      notify(`${questionSet.questions.length}問の問題集を作成しました`);
    } else {
      notify(`${questionSet.questions.length}問の問題集を作成しましたが、保存に失敗しました`);
    }
  }

  return (
    <div className="app-shell">
      {/* 全画面で共通するサイドバーとメインナビゲーション。 */}
      <Sidebar view={view} navigate={navigate} openShelves={openShelves} groupName="情報工学3年" displayName={profile.displayName} profileLabel={`${profile.faculty} ${profile.department}`} />
      <main className="main">
        {/* ホーム：今日の学習、講義棚、直近の締切。 */}
        {view === "home" && (
          <HomeView
            shelves={shelves}
            shelvesState={shelvesState}
            assignments={assignments}
            notify={notify}
            openCourse={openCourse}
            openShelf={() => { setView("home"); setSelectedShelfId(null); setModal("shelf"); }}
            navigate={navigate}
            startCreate={startCreate}
          />
        )}
        {/* 講義詳細：資料と作成済み問題集をタブで切り替える。 */}
        {view === "course" && selectedShelf && (
          <CourseView
            shelf={selectedShelf}
            materials={courseMaterials[selectedShelf.id] ?? []}
            materialsState={materialsState}
            questionSets={courseQuestionSets[selectedShelf.id] ?? []}
            questionSetsState={questionSetsState}
            assignments={assignments.filter((assignment) => assignment.course === selectedShelf.course_name)}
            openShelves={openShelves}
            openMaterial={() => setModal("material")}
            openQuiz={openQuiz}
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
          <QuizView
            supabase={supabase}
            navigate={navigate}
            notify={notify}
            questionSetId={selectedQuestionSetId}
            shelfName={selectedShelf?.course_name}
            backToCourse={() => navigate("course")}
          />
        )}
        {/* 課題：未完了と完了済みのタスクを一覧表示する。 */}
        {view === "tasks" && <TasksView notify={notify} items={assignments} setItems={setAssignments} courseNames={shelves.map((shelf) => shelf.course_name)} openCourse={(courseName) => { const shelf = shelves.find((item) => item.course_name === courseName); if (shelf) openCourse(shelf.id); }} />}
        {/* グループ：勉強会、共有棚、メンバーの活動記録。 */}
        {view === "group" && (
          <GroupView
            navigate={navigate}
            notify={notify}
            openSchedule={() => setModal("schedule")}
          />
        )}
        {view === "account" && <AccountView navigate={navigate} notify={notify} profile={profile} />}
        {view === "profile-edit" && <ProfileEditView navigate={navigate} profile={profile} onSave={(next) => { setProfile(next); navigate("account"); notify("プロフィールを更新しました"); }} />}
        {view === "logout" && <LogoutView navigate={navigate} />}
      </main>
      {/* 資料と出題条件を選択する、2段階の問題作成モーダル。 */}
      {modal === "create" && selectedShelf && (
        <CreateQuizModal
          supabase={supabase}
          shelfId={selectedShelf.id}
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
          onUpload={async (file) => {
            const material = await uploadMaterial(supabase, selectedShelf.id, file);
            await loadMaterials(selectedShelf.id);
            await loadShelves();
            setModal("none");
            notify(`「${material.file_name}」を追加しました`);
          }}
        />
      )}
      {/* 保存や共有などの操作結果を一時的に知らせる。 */}
      <Toast message={toast} />
    </div>
  );
}
