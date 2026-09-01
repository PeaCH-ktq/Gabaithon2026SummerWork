import type React from "react";
import type { Assignment, Course, Navigate } from "../../types";
import { Button, Icon } from "../ui";

type Props = { courses: Course[]; assignments: Assignment[]; navigate: Navigate; openCourse: (code: string) => void; startCreate: () => void; openShelf: () => void };

export function HomeView({ courses, assignments, navigate, openCourse, startCreate, openShelf }: Props) {
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
        <div className="shelf-grid">
          {courses.map((course) => (
            <button
              key={course.code}
              className="shelf"
              style={{ "--tab": course.tab } as React.CSSProperties}
              onClick={() => openCourse(course.code)}
            >
              <div className="shelf-top">
                <span>{course.code}</span>
                {course.shared && (
                  <span className="shared">
                    <Icon name="users" size={12} />
                    共有中
                  </span>
                )}
              </div>
              <h3>{course.name}</h3>
              <p>{course.professor}</p>
              <div className="shelf-meta">
                <span>
                  <b>{course.docs}</b> 資料
                </span>
                <span>
                  <b>{course.quizzes}</b> 問題集
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
