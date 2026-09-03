"use client";

import { useState } from "react";
import type { LoadState, Notify, Shelf } from "../../types";
import type { AssignmentView } from "@/lib/format/assignments";
import {
  AssignmentReportModal,
  type AssignmentReport,
} from "../modals/AssignmentReportModal";
import { Button, Icon } from "../ui";

type CompletedTask = AssignmentView & { report: AssignmentReport };

type Props = {
  notify: Notify;
  upcoming: AssignmentView[];
  completed: CompletedTask[];
  assignmentsState: LoadState;
  shelves: Shelf[];
  saving: boolean;
  savingReport: boolean;
  onAddTask: (values: {
    title: string;
    shelfId: string;
    dueAt: string;
  }) => Promise<void>;
  onRestore: (assignmentId: string) => Promise<void>;
  onSaveReport: (
    assignmentId: string,
    report: AssignmentReport,
  ) => Promise<void>;
  openCourse: (shelfId: string) => void;
};

export function TasksView({
  notify,
  upcoming,
  completed,
  assignmentsState,
  shelves,
  saving,
  savingReport,
  onAddTask,
  onRestore,
  onSaveReport,
  openCourse,
}: Props) {
  const [reportTarget, setReportTarget] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [shelfId, setShelfId] = useState(shelves[0]?.id ?? "");
  const [date, setDate] = useState("");

  function openReport(assignmentId: string) {
    setReportTarget(assignmentId);
  }

  async function restoreTask(task: CompletedTask) {
    await onRestore(task.id);
    notify("未完了に戻しました");
  }

  async function saveReport(report: AssignmentReport) {
    if (!reportTarget) return;
    await onSaveReport(reportTarget, report);
    setReportTarget(null);
    notify("課題の結果を投稿しました");
  }

  async function addTask() {
    if (!title.trim() || !shelfId || !date) return;
    await onAddTask({
      title: title.trim(),
      shelfId,
      dueAt: new Date(date).toISOString(),
    });
    setTitle("");
    setDate("");
    setShowForm(false);
    notify("課題を追加しました");
  }

  const upcomingTarget = upcoming.find((task) => task.id === reportTarget);
  const completedTarget = completed.find((task) => task.id === reportTarget);
  const target = upcomingTarget ?? completedTarget;
  const targetInitial = completedTarget?.report;
  const targetSharedWithGroup = target ? target.groupId !== null : false;

  return (
    <>
      <header className="page-head">
        <div>
          <p className="eyebrow">DEADLINES</p>
          <h1>課題</h1>
        </div>
        <Button
          primary
          icon="plus"
          onClick={() => setShowForm(true)}
          disabled={shelves.length === 0}
        >
          課題を追加
        </Button>
      </header>

      {shelves.length === 0 && (
        <p className="muted">
          先に講義棚を作成すると、課題を追加できるようになります。
        </p>
      )}

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
              <select
                value={shelfId}
                onChange={(event) => setShelfId(event.target.value)}
              >
                {shelves.map((shelf) => (
                  <option key={shelf.id} value={shelf.id}>
                    {shelf.course_name}
                  </option>
                ))}
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
            <Button subtle onClick={() => setShowForm(false)} disabled={saving}>
              キャンセル
            </Button>
            <Button primary onClick={addTask} disabled={saving}>
              追加する
            </Button>
          </div>
        </section>
      )}

      <div className="task-board">
        <section>
          <h2>
            これから <span>{upcoming.length}</span>
          </h2>
          {upcoming.length === 0 && assignmentsState === "loading" && (
            <p className="muted">読み込み中…</p>
          )}
          {upcoming.length === 0 && assignmentsState !== "loading" && (
            <div className="empty-state">
              <b>未完了の課題はありません</b>
              <p>すべて完了しました。おつかれさまでした。</p>
            </div>
          )}
          {upcoming.map((item, index) => (
            <article className="task-card" key={item.id}>
              <button
                aria-label={`${item.title}を完了`}
                title="完了にする"
                className={`task-check ${index === 0 ? "urgent" : ""}`}
                onClick={() => openReport(item.id)}
              />
              <div>
                <button
                  className="task-course"
                  onClick={() => openCourse(item.shelfId)}
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
            <article className="task-card done" key={task.id}>
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
                  onClick={() => openCourse(task.shelfId)}
                >
                  {task.course}
                </button>
                <h3>{task.title}</h3>
                <p>
                  かかった時間 {formatMinutes(task.report.minutesSpent)} ・
                  コメント投稿済み
                </p>
              </div>
              <span className="complete-tag">完了</span>
              <Button icon="clock" onClick={() => openReport(task.id)}>
                結果を編集
              </Button>
            </article>
          ))}
        </section>
      </div>

      {target && (
        <AssignmentReportModal
          taskTitle={target.title}
          initial={targetInitial}
          sharedWithGroup={targetSharedWithGroup}
          saving={savingReport}
          onClose={() => setReportTarget(null)}
          onSave={(report) => void saveReport(report)}
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
