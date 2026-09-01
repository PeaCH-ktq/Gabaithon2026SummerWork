import type React from "react";
import type { Assignment, LoadState, Navigate, Notify, Shelf } from "../../types";
import { formatSchedule } from "@/lib/format/schedule";
import { Button, Icon } from "../ui";

type Props = { shelves: Shelf[]; shelvesState: LoadState; assignments: Assignment[]; navigate: Navigate; openCourse: (id: string) => void; startCreate: () => void; openShelf: () => void; notify: Notify };

export function HomeView({ shelves, shelvesState, assignments, navigate, openCourse, startCreate, openShelf, notify }: Props) {
  const today = new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", year: "numeric", month: "long", day: "numeric", weekday: "long" }).format(new Date());
  const nextSessions = [
    { date: "9月6日（日）", time: "14:00 – 18:00", title: "データベース論 中間対策", place: "中央図書館 グループ学習室B" },
    { date: "9月9日（水）", time: "10:00 – 12:00", title: "OS 演習もくもく会", place: "情報棟3F ラウンジ" },
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
          <div className="overview-head"><span className="overview-icon"><Icon name="task" /></span><div><p className="eyebrow">UPCOMING DEADLINES</p><h2>締切の近い課題</h2></div><button className="text-link overview-action" onClick={() => navigate("tasks")}>すべて見る <Icon name="arrow" size={14} /></button></div>
          <div className="overview-list">{assignments.slice(0, 2).map((item) => <button key={item.title} onClick={() => navigate("tasks")}><span className={`date-box ${item.color}`}><b>{item.left}</b><small>{item.date}</small></span><span><b>{item.title}</b><small>{item.course}</small></span><Icon name="arrow" size={15} /></button>)}</div>
        </article>
        <article className="overview-card session-overview">
          <div className="overview-head"><span className="overview-icon"><Icon name="users" /></span><div><p className="eyebrow">NEXT SESSIONS</p><h2>直近の勉強会</h2></div><button className="text-link overview-action" onClick={() => navigate("group")}>グループへ <Icon name="arrow" size={14} /></button></div>
          <div className="overview-list">{nextSessions.map((session) => <button key={session.title} onClick={() => navigate("group")}><span className="session-date"><b>{session.date}</b><small>{session.time}</small></span><span><b>{session.title}</b><small><Icon name="home" size={11} /><span>{session.place}</span></small></span><Icon name="arrow" size={15} /></button>)}</div>
        </article>
      </section>
      <section className="section" id="course-shelves">
        <div className="section-head">
          <div>
            <p className="eyebrow">MY COURSES</p>
            <h2>講義の棚</h2>
          </div>
          <Button icon="plus" onClick={openShelf}>棚を追加</Button>
        </div>
        {shelvesState === "loading" && <p className="muted">棚を読み込んでいます…</p>}
        {shelvesState === "error" && <p className="muted">棚の読み込みに失敗しました。再読み込みしてください。</p>}
        {shelvesState === "ready" && shelves.length === 0 && (
          <div className="empty-state"><b>棚はまだありません</b><p>「棚を追加」から最初の講義を登録してください。</p></div>
        )}
        <div className="shelf-grid">
          {shelves.map((shelf) => (
            <button
              key={shelf.id}
              className="shelf"
              style={{ "--tab": shelf.color } as React.CSSProperties}
              onClick={() => openCourse(shelf.id)}
            >
              <div className="shelf-top">
                <span>{shelf.course_code ?? "コード未設定"}</span>
                {shelf.sharedGroupIds.length > 0 && (
                  <span className="shared">
                    <Icon name="users" size={12} />
                    共有中
                  </span>
                )}
              </div>
              <h3>{shelf.course_name}</h3>
              <p>{shelf.professor ?? "担当教員未設定"} ・ {formatSchedule(shelf.day_of_week, shelf.period)}</p>
              <div className="shelf-meta">
                <span>
                  <b>{shelf.materialCount}</b> 資料
                </span>
                <span>
                  <b>{shelf.questionSetCount}</b> 問題集
                </span>
                <Icon name="arrow" size={17} />
              </div>
            </button>
          ))}
        </div>
      </section>
    </>
  );
}
