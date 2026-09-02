"use client";

import { useCallback, useEffect, useState } from "react";

import { CreateQuizModal } from "./components/modals/CreateQuizModal";
import { GroupModal } from "./components/modals/GroupModal";
import { MaterialModal } from "./components/modals/MaterialModal";
import { ScheduleModal } from "./components/modals/ScheduleModal";
import { ShareModal } from "./components/modals/ShareModal";
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
import type {
  Assignment,
  GroupRow,
  LoadState,
  MaterialRow,
  Profile,
  QuestionSetRow,
  Shelf,
  ShelfFormValues,
  View,
} from "./types";
import { createClient } from "@/lib/supabase/client";
import { createShelf, listShelves, updateShelf } from "@/lib/data/shelves";
import { listMaterialsByShelf, uploadMaterial } from "@/lib/data/materials";
import { listQuestionSetsByShelf } from "@/lib/data/questionSets";
import { createGroup, joinGroupByCode, listMyGroups } from "@/lib/data/groups";
import { shareShelf, unshareShelf } from "@/lib/data/shares";
import { pickShelfColor } from "@/lib/format/schedule";
import { deadlines } from "./demo-data";
import type { QuestionSet } from "@/lib/gemini/schema";

export default function Home() {
  const [supabase] = useState(() => createClient());
  // 現在の画面、モーダル、タブなど、UIの表示状態を管理する。
  const [view, setView] = useState<View>("home");
  const [modal, setModal] = useState<
    "none" | "create" | "schedule" | "shelf" | "material" | "group" | "share"
  >("none");
  const [userId, setUserId] = useState<string | null>(null);
  const [shelves, setShelves] = useState<Shelf[]>([]);
  const [shelvesState, setShelvesState] = useState<LoadState>("loading");
  const [selectedShelfId, setSelectedShelfId] = useState<string | null>(null);
  const [savingShelf, setSavingShelf] = useState(false);
  const [courseMaterials, setCourseMaterials] = useState<
    Record<string, MaterialRow[]>
  >({});
  const [materialsState, setMaterialsState] = useState<LoadState>("loading");
  const [courseQuestionSets, setCourseQuestionSets] = useState<
    Record<string, QuestionSetRow[]>
  >({});
  const [questionSetsState, setQuestionSetsState] =
    useState<LoadState>("loading");
  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [groupsState, setGroupsState] = useState<LoadState>("loading");
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [joiningGroup, setJoiningGroup] = useState(false);
  const [savingShare, setSavingShare] = useState(false);
  const [shareShelfId, setShareShelfId] = useState<string | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>(deadlines);
  const [profile, setProfile] = useState<Profile>({
    displayName: "ゆうた",
    faculty: "工学部",
    department: "情報工学科",
    email: "yuta@example.jp",
  });
  const [step, setStep] = useState(1);
  const [toast, setToast] = useState("");
  const [activeTab, setActiveTab] = useState<"material" | "quiz">("material");
  const [generating, setGenerating] = useState(false);
  const [selectedQuestionSetId, setSelectedQuestionSetId] = useState<
    string | null
  >(null);
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
    void Promise.resolve().then(() => loadShelves());
  }, [loadShelves]);

  useEffect(() => {
    void supabase.auth
      .getUser()
      .then(({ data }) => setUserId(data.user?.id ?? null));
  }, [supabase]);

  const loadGroups = useCallback(async () => {
    setGroupsState("loading");
    try {
      const rows = await listMyGroups(supabase);
      setGroups(rows);
      setGroupsState("ready");
      setSelectedGroupId((current) =>
        current && rows.some((g) => g.id === current)
          ? current
          : (rows[0]?.id ?? null),
      );
      return rows;
    } catch (err) {
      console.error(err);
      setGroupsState("error");
      return [];
    }
  }, [supabase]);

  useEffect(() => {
    void Promise.resolve().then(() => loadGroups());
  }, [loadGroups]);

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

  const selectedShelf =
    shelves.find((shelf) => shelf.id === selectedShelfId) ?? null;

  function selectCourse(id: string) {
    setSelectedShelfId(id);
    void loadMaterials(id);
    void loadQuestionSets(id);
  }

  function openCourse(id: string) {
    selectCourse(id);
    navigate("course");
  }

  function openQuiz(id: string) {
    setSelectedQuestionSetId(id);
  }

  function openShelves() {
    setView("home");
    window.setTimeout(
      () =>
        document
          .getElementById("course-shelves")
          ?.scrollIntoView({ behavior: "smooth", block: "start" }),
      0,
    );
  }

  async function saveShelf(values: ShelfFormValues, id?: string) {
    setSavingShelf(true);
    try {
      const row = id
        ? await updateShelf(supabase, id, values)
        : await createShelf(supabase, {
            ...values,
            color: pickShelfColor(shelves.length),
          });
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

  async function handleCreateGroup(name: string) {
    setCreatingGroup(true);
    try {
      const group = await createGroup(supabase, name);
      await loadGroups();
      setSelectedGroupId(group.id);
      setModal("none");
      navigate("group");
      notify("グループを作成しました");
    } catch (err) {
      notify(
        err instanceof Error ? err.message : "グループの作成に失敗しました",
      );
    } finally {
      setCreatingGroup(false);
    }
  }

  async function handleJoinGroup(code: string) {
    setJoiningGroup(true);
    try {
      const groupId = await joinGroupByCode(supabase, code);
      await loadGroups();
      setSelectedGroupId(groupId);
      setModal("none");
      navigate("group");
      notify("グループに参加しました");
    } catch (err) {
      notify(
        err instanceof Error ? err.message : "グループへの参加に失敗しました",
      );
    } finally {
      setJoiningGroup(false);
    }
  }

  const shareShelfTarget =
    shelves.find((shelf) => shelf.id === shareShelfId) ?? null;

  async function saveShares(groupIds: string[]) {
    if (!shareShelfTarget) return;
    setSavingShare(true);
    try {
      const current = new Set(shareShelfTarget.shares.map((s) => s.group_id));
      const next = new Set(groupIds);
      const toAdd = groupIds.filter((id) => !current.has(id));
      const toRemove = [...current].filter((id) => !next.has(id));
      await Promise.all([
        ...toAdd.map((groupId) =>
          shareShelf(supabase, shareShelfTarget.id, groupId),
        ),
        ...toRemove.map((groupId) =>
          unshareShelf(supabase, shareShelfTarget.id, groupId),
        ),
      ]);
      await loadShelves();
      setModal("none");
      setShareShelfId(null);
      notify(
        groupIds.length > 0 ? "共有設定を保存しました" : "共有を解除しました",
      );
    } catch (err) {
      notify(
        err instanceof Error ? err.message : "共有設定の保存に失敗しました",
      );
    } finally {
      setSavingShare(false);
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
  function finishGeneration(
    questionSetId: string | null,
    questionSet: QuestionSet,
  ) {
    setSelectedQuestionSetId(questionSetId);
    setModal("none");
    setGenerating(false);
    navigate("quiz");
    if (selectedShelf) void loadQuestionSets(selectedShelf.id);
    void loadShelves();
    if (questionSetId) {
      notify(`${questionSet.questions.length}問の問題集を作成しました`);
    } else {
      notify(
        `${questionSet.questions.length}問の問題集を作成しましたが、保存に失敗しました`,
      );
    }
  }

  const isOwner = selectedShelf ? selectedShelf.owner_id === userId : false;
  const selectedGroup =
    groups.find((group) => group.id === selectedGroupId) ?? null;

  function openShare(shelfId: string) {
    setShareShelfId(shelfId);
    setModal("share");
  }

  return (
    <div className="app-shell">
      {/* 全画面で共通するサイドバーとメインナビゲーション。 */}
      <Sidebar
        view={view}
        navigate={navigate}
        openShelves={openShelves}
        groups={groups}
        selectedGroupId={selectedGroupId}
        onSelectGroup={setSelectedGroupId}
        onCreateGroup={() => setModal("group")}
        displayName={profile.displayName}
        profileLabel={`${profile.faculty} ${profile.department}`}
      />
      <main className="main">
        {/* ホーム：今日の学習、講義棚、直近の締切。 */}
        {view === "home" && (
          <HomeView
            shelves={shelves}
            shelvesState={shelvesState}
            assignments={assignments}
            selectShelf={selectCourse}
            materialsByShelf={courseMaterials}
            materialsState={materialsState}
            questionSetsByShelf={courseQuestionSets}
            questionSetsState={questionSetsState}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            openMaterial={() => setModal("material")}
            openQuiz={openQuiz}
            // 編集対象の棚IDを同期してからモーダルを開く。
            // 「棚を追加」でselectedShelfIdがnullにリセットされた後でも、
            // HomeViewが開いている棚(openedShelf)を正しく編集できるようにする。
            editShelf={(shelfId) => {
              setSelectedShelfId(shelfId);
              setModal("shelf");
            }}
            openShare={openShare}
            openShelf={() => {
              setView("home");
              setSelectedShelfId(null);
              setModal("shelf");
            }}
            navigate={navigate}
            startCreate={startCreate}
            userId={userId}
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
            assignments={assignments.filter(
              (assignment) => assignment.course === selectedShelf.course_name,
            )}
            openShelves={openShelves}
            openMaterial={() => setModal("material")}
            openQuiz={openQuiz}
            // CourseViewのshelfはselectedShelfそのものであり、
            // 講義詳細表示中はすでに同期済みなので明示的に再指定しておく。
            editCourse={() => {
              setSelectedShelfId(selectedShelf.id);
              setModal("shelf");
            }}
            openShare={() => openShare(selectedShelf.id)}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            navigate={navigate}
            startCreate={startCreate}
            isOwner={isOwner}
          />
        )}
        {view === "course" && !selectedShelf && (
          <p className="muted">
            棚が見つかりません。
            <button className="text-link" onClick={() => navigate("home")}>
              棚の一覧へ戻る
            </button>
          </p>
        )}
        {/* 問題集：印刷やPDF保存に対応した問題用紙。 */}
        {view === "quiz" && (
          <QuizView
            supabase={supabase}
            navigate={navigate}
            questionSetId={selectedQuestionSetId}
            shelf={selectedShelf}
            isOwner={isOwner}
            openShare={() => selectedShelf && openShare(selectedShelf.id)}
            backToCourse={() => navigate("course")}
          />
        )}
        {/* 課題：未完了と完了済みのタスクを一覧表示する。 */}
        {view === "tasks" && (
          <TasksView
            notify={notify}
            items={assignments}
            setItems={setAssignments}
            courseNames={shelves.map((shelf) => shelf.course_name)}
            openCourse={(courseName) => {
              const shelf = shelves.find(
                (item) => item.course_name === courseName,
              );
              if (shelf) openCourse(shelf.id);
            }}
          />
        )}
        {/* グループ：勉強会、共有棚、メンバーの活動記録。 */}
        {view === "group" && (
          <GroupView
            supabase={supabase}
            group={selectedGroup}
            groupsState={groupsState}
            userId={userId}
            shelves={shelves}
            openCourse={openCourse}
            notify={notify}
            openSchedule={() => setModal("schedule")}
            openGroupModal={() => setModal("group")}
            onLeft={() => {
              void loadGroups();
            }}
            onSharesChanged={() => {
              void loadShelves();
            }}
          />
        )}
        {view === "account" && (
          <AccountView navigate={navigate} notify={notify} profile={profile} />
        )}
        {view === "profile-edit" && (
          <ProfileEditView
            navigate={navigate}
            profile={profile}
            onSave={(next) => {
              setProfile(next);
              navigate("account");
              notify("プロフィールを更新しました");
            }}
          />
        )}
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
          initial={selectedShelf ?? undefined}
          saving={savingShelf}
          onClose={() => setModal("none")}
          onSave={saveShelf}
        />
      )}
      {modal === "material" && selectedShelf && (
        <MaterialModal
          onClose={() => setModal("none")}
          onUpload={async (file) => {
            const material = await uploadMaterial(
              supabase,
              selectedShelf.id,
              file,
            );
            await loadMaterials(selectedShelf.id);
            await loadShelves();
            setModal("none");
            notify(`「${material.file_name}」を追加しました`);
          }}
        />
      )}
      {/* グループの作成・招待コード参加。 */}
      {modal === "group" && (
        <GroupModal
          creating={creatingGroup}
          joining={joiningGroup}
          onClose={() => setModal("none")}
          onCreate={(name) => void handleCreateGroup(name)}
          onJoin={(code) => void handleJoinGroup(code)}
        />
      )}
      {/* 棚をグループへ共有する設定。 */}
      {modal === "share" && shareShelfTarget && (
        <ShareModal
          shelf={shareShelfTarget}
          groups={groups}
          saving={savingShare}
          onClose={() => {
            setModal("none");
            setShareShelfId(null);
          }}
          onSave={(groupIds) => void saveShares(groupIds)}
          onCreateGroup={() => setModal("group")}
        />
      )}
      {/* 保存や共有などの操作結果を一時的に知らせる。 */}
      <Toast message={toast} />
    </div>
  );
}
