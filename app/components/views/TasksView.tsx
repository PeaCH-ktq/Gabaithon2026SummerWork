"use client";

import { useState, type Dispatch, type SetStateAction } from "react";
import type { Assignment, Notify } from "../../types";
import {
  AssignmentReportModal,
  type AssignmentReport,
} from "../modals/AssignmentReportModal";
import { Button, Icon } from "../ui";

type CompletedTask = Assignment & { report?: AssignmentReport };

const initialCompleted: CompletedTask[] = [
  {
    title: "SQL演習課題 第2回",
    course: "データベース論",
    date: "8月24日 23:59",
    left: "完了",
    color: "green",
    report: {
      minutesSpent: 200,
      comment: "JOINの条件を図にしてから解くと整理しやすかった。",
    },
  },
  {
    title: "プロセススケジューリング演習",
    course: "オペレーティングシステム",
    date: "8月22日 17:00",
    left: "完了",
    color: "green",
    report: {
      minutesSpent: 105,
      comment: "ラウンドロビンの待ち時間計算に時間がかかった。",
    },
  },
];

type Props = {
  notify: Notify;
  items: Assignment[];
  setItems: Dispatch<SetStateAction<Assignment[]>>;
  courseNames: string[];
  openCourse: (courseName: string) => void;
};

export function TasksView({
  notify,
  items,
  setItems,
  courseNames,
  openCourse,
}: Props) {
  const [completed, setCompleted] = useState<CompletedTask[]>(initialCompleted);
  const [reportTarget, setReportTarget] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [course, setCourse] = useState("データベース論");
  const [date, setDate] = useState("2026-09-08T23:59");

  function completeTask(task: Assignment) {
    setItems((current) =>
      current.filter((item) => item.title !== task.title),
    );
    setCompleted((current) => [{ ...task }, ...current]);
    setReportTarget(task.title);
    notify("課題を完了にしました");
  }

  function restoreTask(task: CompletedTask) {
    setCompleted((current) =>
      current.filter((item) => item.title !== task.title),
    );
    setItems((current) => [{ ...task, left: "期限を確認" }, ...current]);
    notify("未完了に戻しました");
  }

  function saveReport(report: AssignmentReport) {
    setCompleted((current) =>
      current.map((task) =>
        task.title === reportTarget ? { ...task, report } : task,
      ),
    );
    setReportTarget(null);
    notify("課題の結果を投稿しました");
  }

  function addTask() {
    if (!title.trim()) return;
    const due = new Date(date);
    const monthAndDay = `${due.getMonth() + 1}月${due.getDate()}日`;
    const hours = String(due.getHours()).padStart(2, "0");
    const minutes = String(due.getMinutes()).padStart(2, "0");
    const formattedDate = `${monthAndDay} ${hours}:${minutes}`;
    setItems((current) => [
      ...current,
      {
        title: title.trim(),
        course,
        date: formattedDate,
        left: "期限を確認",
        color: "green",
      },
    ]);
    setTitle("");
    setShowForm(false);
    notify("課題を追加しました");
  }

  const target = completed.find((task) => task.title === reportTarget);

  return (
    <>
      <header className="page-head">
        <div>
          <p className="eyebrow">DEADLINES</p>
          <h1>課題</h1>
        </div>
        <Button primary icon="plus" onClick={() => setShowForm(true)}>
          課題を追加
        </Button>
      </header>

      {showForm && (
        <section className="content-card inline-form">
          <p className="eyebrow">NEW ASSIGNMENT</p>
          <h2>課題を追加</h2>
          <div className="field-pair">
            <label className="text-field">
              課題名
              <input
                autoFocus
                value={title}
                onChange={(event) => setTitle(event.target.value)}
              />
            </label>
            <label className="text-field">
              講義
              <select value={course} onChange={(event) => setCourse(event.target.value)}>
                {courseNames.map((name) => <option key={name}>{name}</option>)}
              </select>
            </label>
          </div>
          <label className="text-field">
            期限
            <input
              type="datetime-local"
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
          </label>
          <div className="modal-actions">
            <Button subtle onClick={() => setShowForm(false)}>
              キャンセル
            </Button>
            <Button primary onClick={addTask}>
              追加する
            </Button>
          </div>
        </section>
      )}

      <div className="task-board">
        <section>
          <h2>
            これから <span>{items.length}</span>
          </h2>
          {items.length === 0 && (
            <div className="empty-state">
              <b>未完了の課題はありません</b>
              <p>すべて完了しました。おつかれさまでした。</p>
            </div>
          )}
          {items.map((item, index) => (
            <article className="task-card" key={item.title}>
              <button
                aria-label={`${item.title}を完了`}
                title="完了にする"
                className={`task-check ${index === 0 ? "urgent" : ""}`}
                onClick={() => completeTask(item)}
              />
              <div>
                <button
                  className="task-course"
                  onClick={() => openCourse(item.course)}
                >
                  {item.course}
                </button>
                <h3>{item.title}</h3>
                <p>
                  <Icon name="calendar" size={14} />
                  {item.date}
                </p>
              </div>
              <span className={`due-tag ${index === 0 ? "urgent" : ""}`}>
                {item.left}
              </span>
            </article>
          ))}
        </section>

        <section>
          <h2>
            終わった課題 <span>{completed.length}</span>
          </h2>
          {completed.map((task) => (
            <article className="task-card done" key={task.title}>
              <button
                className="task-check"
                aria-label={`${task.title}を未完了に戻す`}
                title="未完了に戻す"
                onClick={() => restoreTask(task)}
              >
                <Icon name="check" size={15} />
              </button>
              <div>
                <button
                  className="task-course"
                  onClick={() => openCourse(task.course)}
                >
                  {task.course}
                </button>
                <h3>{task.title}</h3>
                {task.report ? (
                  <p>
                    かかった時間 {formatMinutes(task.report.minutesSpent)} ・
                    コメント投稿済み
                  </p>
                ) : (
                  <p>結果はまだ投稿されていません</p>
                )}
              </div>
              <span className="complete-tag">完了</span>
              <Button
                primary={!task.report}
                icon="clock"
                onClick={() => setReportTarget(task.title)}
              >
                {task.report ? "結果を編集" : "結果を投稿"}
              </Button>
            </article>
          ))}
        </section>
      </div>

      {target && (
        <AssignmentReportModal
          taskTitle={target.title}
          initial={target.report}
          onClose={() => setReportTarget(null)}
          onSave={saveReport}
        />
      )}
    </>
  );
}

function formatMinutes(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return hours ? `${hours}時間${rest ? `${rest}分` : ""}` : `${rest}分`;
}
