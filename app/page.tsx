"use client";

import { useEffect, useState } from "react";

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
import type { View } from "./types";
import type { Assignment, Course, Profile } from "./types";
import { courses as initialCourses, deadlines, materials as initialMaterials } from "./demo-data";
import type { QuestionSet } from "@/lib/gemini/schema";

export default function Home() {
  // 現在の画面、モーダル、タブなど、UIの表示状態を管理する。
  const [view, setView] = useState<View>("home");
  const [modal, setModal] = useState<"none" | "create" | "schedule" | "shelf" | "material">("none");
  const [courses, setCourses] = useState<Course[]>(initialCourses);
  const [assignments, setAssignments] = useState<Assignment[]>(deadlines);
  const [profile, setProfile] = useState<Profile>({ displayName: "ゆうた", faculty: "工学部", department: "情報工学科", email: "yuta@example.jp" });
  const [selectedCode, setSelectedCode] = useState(initialCourses[0].code);
  const [courseMaterials, setCourseMaterials] = useState<Record<string, string[]>>({ [initialCourses[0].code]: initialMaterials });
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
  // このデモではルーティングを使わず、viewの値で表示画面を切り替える。
  function navigate(next: View) {
    setView(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  const selectedCourse = courses.find((course) => course.code === selectedCode) ?? courses[0];
  function openCourse(code: string) { setSelectedCode(code); navigate("course"); }
  function openShelves() {
    setView("home");
    window.setTimeout(() => document.getElementById("course-shelves")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  }
  function saveCourse(course: Course) {
    const previousName = selectedCourse.name;
    setCourses((current) => current.some((item) => item.code === selectedCode && modal === "shelf" && view === "course") ? current.map((item) => item.code === selectedCode ? course : item) : [...current, course]);
    setSelectedCode(course.code); setModal("none"); notify("棚を保存しました");
    if (view === "course" && previousName !== course.name) setAssignments((items) => items.map((item) => item.course === previousName ? { ...item, course: course.name } : item));
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
      <Sidebar view={view} navigate={navigate} openShelves={openShelves} groupName="情報工学3年" displayName={profile.displayName} profileLabel={`${profile.faculty} ${profile.department}`} />
      <main className="main">
        {/* ホーム：今日の学習、講義棚、直近の締切。 */}
        {view === "home" && (
          <HomeView
            courses={courses}
            assignments={assignments}
            openCourse={openCourse}
            openShelf={() => { setView("home"); setModal("shelf"); }}
            navigate={navigate}
            startCreate={startCreate}
          />
        )}
        {/* 講義詳細：資料と作成済み問題集をタブで切り替える。 */}
        {view === "course" && (
          <CourseView
            course={selectedCourse}
            assignments={assignments.filter((assignment) => assignment.course === selectedCourse.name)}
            openShelves={openShelves}
            materials={courseMaterials[selectedCourse.code] ?? []}
            openMaterial={() => setModal("material")}
            editCourse={() => setModal("shelf")}
            toggleShare={() => { setCourses((items) => items.map((item) => item.code === selectedCourse.code ? { ...item, shared: !item.shared } : item)); notify(selectedCourse.shared ? "共有を解除しました" : "グループに共有しました"); }}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            navigate={navigate}
            startCreate={startCreate}
          />
        )}
        {/* 問題集：印刷やPDF保存に対応した問題用紙。 */}
        {view === "quiz" && (
          <QuizView navigate={navigate} notify={notify} questionSet={generatedQuiz} />
        )}
        {/* 課題：未完了と完了済みのタスクを一覧表示する。 */}
        {view === "tasks" && <TasksView notify={notify} items={assignments} setItems={setAssignments} courseNames={courses.map((course) => course.name)} openCourse={(courseName) => { const course = courses.find((item) => item.name === courseName); if (course) openCourse(course.code); }} />}
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
      {modal === "shelf" && <ShelfModal initial={view === "course" ? selectedCourse : undefined} onClose={() => setModal("none")} onSave={saveCourse} />}
      {modal === "material" && <MaterialModal onClose={() => setModal("none")} onAdd={(name) => { setCourseMaterials((current) => ({ ...current, [selectedCourse.code]: [...(current[selectedCourse.code] ?? []), name.replace(/\.[^.]+$/, "")] })); setCourses((items) => items.map((item) => item.code === selectedCourse.code ? { ...item, docs: item.docs + 1 } : item)); setModal("none"); notify("資料を一覧に追加しました"); }} />}
      {/* 保存や共有などの操作結果を一時的に知らせる。 */}
      <Toast message={toast} />
    </div>
  );
}
