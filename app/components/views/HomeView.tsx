import type React from "react";
import { courses, deadlines } from "../../demo-data";
import type { Navigate, Notify } from "../../types";
import { Button, Icon } from "../ui";

type Props = { navigate: Navigate; startCreate: () => void; notify: Notify };

export function HomeView({ navigate, startCreate, notify }: Props) {
  return (
    <>
      <header className="page-head">
        <div>
          <p className="eyebrow">2026 AUTUMN SEMESTER</p>
          <h1>おかえりなさい、ゆうたさん。</h1>
          <p>試験まで、あと少し。今日もひとつ進めよう。</p>
        </div>
        <Button primary icon="sparkle" onClick={startCreate}>
          問題をつくる
        </Button>
      </header>
      <section className="focus-card">
        <div className="focus-copy">
          <span className="tiny-label">TODAY&apos;S FOCUS</span>
          <h2>データベース論・中間対策</h2>
          <p>第1回〜第4回の資料から、試験レベルの問題に挑戦できます。</p>
          <div className="focus-actions">
            <Button primary onClick={() => navigate("quiz")}>
              問題集をひらく
            </Button>
            <button className="text-link" onClick={() => navigate("course")}>
              棚を見る <Icon name="arrow" size={15} />
            </button>
          </div>
        </div>
        <div className="progress-ring">
          <svg viewBox="0 0 120 120">
            <circle cx="60" cy="60" r="49" />
            <circle className="progress" cx="60" cy="60" r="49" />
          </svg>
          <strong>
            72<small>%</small>
          </strong>
          <span>学習進捗</span>
        </div>
      </section>
      <section className="section">
        <div className="section-head">
          <div>
            <p className="eyebrow">MY COURSES</p>
            <h2>講義の棚</h2>
          </div>
          <button className="text-link" onClick={() => navigate("course")}>
            すべて見る <Icon name="arrow" size={15} />
          </button>
        </div>
        <div className="shelf-grid">
          {courses.map((course) => (
            <button
              key={course.code}
              className="shelf"
              style={{ "--tab": course.tab } as React.CSSProperties}
              onClick={() => navigate("course")}
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
      <section className="section">
        <div className="section-head">
          <div>
            <p className="eyebrow">UPCOMING</p>
            <h2>もうすぐ締切</h2>
          </div>
          <button className="text-link" onClick={() => navigate("tasks")}>
            課題をすべて見る <Icon name="arrow" size={15} />
          </button>
        </div>
        <div className="deadline-list">
          {deadlines.map((item) => (
            <div className="deadline" key={item.title}>
              <span className={`date-box ${item.color}`}>
                <b>{item.left}</b>
                <small>{item.date}</small>
              </span>
              <span className="deadline-title">
                <b>{item.title}</b>
                <small>{item.course}</small>
              </span>
              <button
                onClick={() => notify("取り組み時間の記録を開始しました")}
                aria-label={`${item.title}の時間を記録`}
              >
                <Icon name="clock" />
              </button>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
