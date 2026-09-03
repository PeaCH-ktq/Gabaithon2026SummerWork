import { useState } from "react";
import type React from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type {
  LoadState,
  MaterialRow,
  Navigate,
  QuestionSetRow,
  Shelf,
} from "../../types";
import type { AssignmentView } from "@/lib/format/assignments";
import { Button, Icon } from "../ui";
import { CourseView } from "./CourseView";

const BOOK_TITLE_MAX_LENGTH = 18;

// 縦書きの背表紙に収まるよう、18文字を超える講義名は17文字＋三点リーダーで省略する。
function truncateBookTitle(title: string): string {
  if (title.length <= BOOK_TITLE_MAX_LENGTH) return title;
  return `${title.slice(0, BOOK_TITLE_MAX_LENGTH - 1)}…`;
}

type Props = {
  supabase: SupabaseClient<Database>;
  shelves: Shelf[];
  shelvesState: LoadState;
  assignments: AssignmentView[];
  navigate: Navigate;
  startCreate: () => void;
  openShelf: () => void;
  selectShelf: (id: string) => void;
  materialsByShelf: Record<string, MaterialRow[]>;
  materialsState: LoadState;
  questionSetsByShelf: Record<string, QuestionSetRow[]>;
  questionSetsState: LoadState;
  activeTab: "material" | "misc" | "quiz";
  setActiveTab: (tab: "material" | "misc" | "quiz") => void;
  openMaterial: () => void;
  openMisc: () => void;
  openQuiz: (id: string) => void;
  // 編集対象の棚IDを受け取り、page.tsx側のselectedShelfIdをその棚に同期させる。
  editShelf: (id: string) => void;
  openShare: (id: string) => void;
  userId: string | null;
};

export function HomeView({
  supabase,
  shelves,
  shelvesState,
  assignments,
  navigate,
  startCreate,
  openShelf,
  selectShelf,
  materialsByShelf,
  materialsState,
  questionSetsByShelf,
  questionSetsState,
  activeTab,
  setActiveTab,
  openMaterial,
  openMisc,
  openQuiz,
  editShelf,
  openShare,
  userId,
}: Props) {
  const [openedShelfId, setOpenedShelfId] = useState<string | null>(null);
  const today = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  }).format(new Date());
  const openedShelf =
    shelves.find((shelf) => shelf.id === openedShelfId) ?? null;
  const nextSessions = [
    {
      date: "9月6日（日）",
      time: "14:00 – 18:00",
      title: "データベース論 中間対策",
      place: "中央図書館 グループ学習室B",
    },
    {
      date: "9月9日（水）",
      time: "10:00 – 12:00",
      title: "OS 演習もくもく会",
      place: "情報棟3F ラウンジ",
    },
  ];
  return (
    <>
      <header className="page-head">
        <div>
          <p className="today-date">{today}</p>
        </div>
        <Button primary icon="sparkle" onClick={startCreate}>
          問題をつくる
        </Button>
      </header>
      <section className="home-overview" aria-label="直近の予定">
        <article className="overview-card assignment-overview">
          <div className="overview-head">
            <span className="overview-icon">
              <Icon name="task" />
            </span>
            <div>
              <p className="eyebrow">UPCOMING DEADLINES</p>
              <h2>締切の近い課題</h2>
            </div>
            <button
              className="text-link overview-action"
              onClick={() => navigate("tasks")}
            >
              すべて見る <Icon name="arrow" size={14} />
            </button>
          </div>
          <div className="overview-list">
            {assignments.slice(0, 2).map((item) => (
              <button key={item.id} onClick={() => navigate("tasks")}>
                <span className={`date-box ${item.color}`}>
                  <b>{item.left}</b>
                  <small>{item.date}</small>
                </span>
                <span>
                  <b>{item.title}</b>
                  <small>{item.course}</small>
                </span>
                <Icon name="arrow" size={15} />
              </button>
            ))}
          </div>
        </article>
        <article className="overview-card session-overview">
          <div className="overview-head">
            <span className="overview-icon">
              <Icon name="users" />
            </span>
            <div>
              <p className="eyebrow">NEXT SESSIONS</p>
              <h2>直近の勉強会</h2>
            </div>
            <button
              className="text-link overview-action"
              onClick={() => navigate("group")}
            >
              グループへ <Icon name="arrow" size={14} />
            </button>
          </div>
          <div className="overview-list">
            {nextSessions.map((session) => (
              <button key={session.title} onClick={() => navigate("group")}>
                <span className="session-date">
                  <b>{session.date}</b>
                  <small>{session.time}</small>
                </span>
                <span>
                  <b>{session.title}</b>
                  <small>
                    <Icon name="home" size={11} />
                    <span>{session.place}</span>
                  </small>
                </span>
                <Icon name="arrow" size={15} />
              </button>
            ))}
          </div>
        </article>
      </section>
      <section className="section" id="course-shelves">
        <div className="section-head">
          <div>
            <p className="eyebrow">MY COURSES</p>
            <h2>講義の棚</h2>
          </div>
          <Button icon="plus" onClick={openShelf}>
            棚を追加
          </Button>
        </div>
        {shelvesState === "loading" && (
          <p className="muted">棚を読み込んでいます…</p>
        )}
        {shelvesState === "error" && (
          <p className="muted">
            棚の読み込みに失敗しました。再読み込みしてください。
          </p>
        )}
        {shelvesState === "ready" && shelves.length === 0 && (
          <div className="empty-state">
            <b>棚はまだありません</b>
            <p>「棚を追加」から最初の講義を登録してください。</p>
          </div>
        )}
        <div className="shelf-bookcase">
          <div className="shelf-grid" role="group" aria-label="講義の本棚">
            {shelves.map((shelf) => (
              <button
                key={shelf.id}
                type="button"
                className={`shelf book-spine ${openedShelfId === shelf.id ? "is-open" : ""}`}
                style={{ "--book-color": shelf.color } as React.CSSProperties}
                onClick={() => {
                  const isOpening = openedShelfId !== shelf.id;
                  setOpenedShelfId(isOpening ? shelf.id : null);
                  if (isOpening) selectShelf(shelf.id);
                }}
                aria-expanded={openedShelfId === shelf.id}
                aria-controls={`shelf-detail-${shelf.id}`}
              >
                <span className="book-bookmark" aria-hidden="true" />
                <span className="book-code">{shelf.course_code ?? ""}</span>
                <span className="book-title" title={shelf.course_name}>
                  {truncateBookTitle(shelf.course_name)}
                </span>
                {shelf.shares.length > 0 && (
                  <span
                    className="book-shared"
                    aria-label={
                      shelf.owner_id === userId ? "共有中" : "共有された棚"
                    }
                  >
                    <Icon name="users" size={13} />
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
        {openedShelf && (
          <div
            className="shelf-expanded-course"
            id={`shelf-detail-${openedShelf.id}`}
            key={openedShelf.id}
          >
            <CourseView
              supabase={supabase}
              shelf={openedShelf}
              materials={materialsByShelf[openedShelf.id] ?? []}
              materialsState={materialsState}
              questionSets={questionSetsByShelf[openedShelf.id] ?? []}
              questionSetsState={questionSetsState}
              assignments={assignments.filter(
                (assignment) => assignment.course === openedShelf.course_name,
              )}
              openShelves={() => setOpenedShelfId(null)}
              openMaterial={openMaterial}
              openMisc={openMisc}
              openQuiz={openQuiz}
              // 編集中の棚がpage.tsx側のselectedShelfIdと食い違わないよう、
              // 現在HomeViewで開いている棚のIDを明示的に渡す。
              editCourse={() => editShelf(openedShelf.id)}
              openShare={() => openShare(openedShelf.id)}
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              navigate={navigate}
              startCreate={startCreate}
              isOwner={openedShelf.owner_id === userId}
            />
          </div>
        )}
      </section>
    </>
  );
}
