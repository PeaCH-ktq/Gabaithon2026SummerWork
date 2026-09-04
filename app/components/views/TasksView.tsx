"use client";

import { useState } from "react";
import type { GroupRow, LoadState, Notify, Shelf } from "../../types";
import { formatMinutes, type AssignmentView } from "@/lib/format/assignments";
import { shareableGroupIds } from "@/lib/data/assignments";
import {
  AssignmentReportModal,
  type AssignmentReport,
} from "../modals/AssignmentReportModal";
import { AssignmentDetailModal } from "../modals/AssignmentDetailModal";
import { Button, Icon } from "../ui";

type CompletedTask = AssignmentView & { report: AssignmentReport };

type Props = {
  notify: Notify;
  upcoming: AssignmentView[];
  completed: CompletedTask[];
  assignmentsState: LoadState;
  shelves: Shelf[];
  groups: GroupRow[];
  userId: string | null;
  saving: boolean;
  savingReport: boolean;
  deleting: boolean;
  // 保存系は成否を返す。失敗しているのに成功トーストを出さないため
  // （トーストは単一 state なので後勝ちで上書きされてしまう）。
  onAddTask: (values: {
    title: string;
    shelfId: string;
    dueAt: string;
    groupIds: string[];
  }) => Promise<boolean>;
  onRestore: (assignmentId: string) => Promise<boolean>;
  onSaveReport: (
    assignmentId: string,
    report: AssignmentReport,
  ) => Promise<boolean>;
  onDelete: (assignmentId: string) => Promise<void>;
  openCourse: (shelfId: string) => void;
};

export function TasksView({
  notify,
  upcoming,
  completed,
  assignmentsState,
  shelves,
  groups,
  userId,
  saving,
  savingReport,
  deleting,
  onAddTask,
  onRestore,
  onSaveReport,
  onDelete,
  openCourse,
}: Props) {
  const [reportTarget, setReportTarget] = useState<string | null>(null);
  const [detailTarget, setDetailTarget] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [shelfId, setShelfId] = useState(shelves[0]?.id ?? "");
  const [date, setDate] = useState("");
  const [shareGroupIds, setShareGroupIds] = useState<string[]>([]);

  // 選んだ講義が「表示中」で共有されているグループだけが共有先に選べる
  // （assignment_shares の insert ポリシーが同じ条件を要求する）。
  const selectedShelf = shelves.find((shelf) => shelf.id === shelfId) ?? null;
  const shareableIds = selectedShelf ? shareableGroupIds(selectedShelf) : [];
  const shareableGroups = groups.filter((group) => shareableIds.includes(group.id));

  /** 講義を変えたら共有先の選択肢が変わるので、既定で全部にチェックし直す。 */
  function selectShelf(nextShelfId: string) {
    setShelfId(nextShelfId);
    const shelf = shelves.find((item) => item.id === nextShelfId);
    setShareGroupIds(shelf ? shareableGroupIds(shelf) : []);
  }

  function openForm() {
    const initialShelfId = shelfId || shelves[0]?.id || "";
    selectShelf(initialShelfId);
    setShowForm(true);
  }

  function toggleShareGroup(groupId: string) {
    setShareGroupIds((ids) =>
      ids.includes(groupId) ? ids.filter((id) => id !== groupId) : [...ids, groupId],
    );
  }

  function openReport(assignmentId: string) {
    setReportTarget(assignmentId);
  }

  async function restoreTask(task: CompletedTask) {
    if (!(await onRestore(task.id))) return;
    notify("未完了に戻しました");
  }

  async function saveReport(report: AssignmentReport) {
    if (!reportTarget) return;
    if (!(await onSaveReport(reportTarget, report))) return;
    setReportTarget(null);
    notify("課題の結果を投稿しました");
  }

  async function addTask() {
    if (!title.trim() || !shelfId || !date) return;
    // 共有先の選択肢から外れたグループが残らないよう、保存直前に絞り込む。
    const groupIds = shareGroupIds.filter((id) => shareableIds.includes(id));
    const ok = await onAddTask({
      title: title.trim(),
      shelfId,
      dueAt: new Date(date).toISOString(),
      groupIds,
    });
    // 失敗時は入力を残したままフォームを開いておく（エラートーストは親が出す）。
    if (!ok) return;
    setTitle("");
    setDate("");
    setShowForm(false);
    notify(
      groupIds.length > 0
        ? `課題を追加し、${groupIds.length}つのグループに共有しました`
        : "課題を追加しました",
    );
  }

  const detail =
    [...upcoming, ...completed].find((task) => task.id === detailTarget) ?? null;

  async function removeAssignment() {
    if (!detail) return;
    if (!window.confirm(`「${detail.title}」を削除します。`)) return;
    await onDelete(detail.id);
    setDetailTarget(null);
  }

  const upcomingTarget = upcoming.find((task) => task.id === reportTarget);
  const completedTarget = completed.find((task) => task.id === reportTarget);
  const target = upcomingTarget ?? completedTarget;
  const targetInitial = completedTarget?.report;
  const targetSharedWithGroup = target ? target.groupIds.length > 0 : false;

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
          onClick={openForm}
          disabled={shelves.length === 0}
        >
          課題を追加
        </Button>
      </header>

      {shelves.length === 0 && (
        <p className="muted">
          先に講義を追加すると、課題を追加できるようになります。
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
                onChange={(event) => selectShelf(event.target.value)}
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
          <div className="text-field">
            共有先
            {shareableGroups.length === 0 ? (
              <p className="muted">
                この講義は共有されていないため、自分だけの課題になります。
              </p>
            ) : (
              <>
                <div className="selection-list">
                  {shareableGroups.map((group) => (
                    <label key={group.id}>
                      <input
                        type="checkbox"
                        checked={shareGroupIds.includes(group.id)}
                        onChange={() => toggleShareGroup(group.id)}
                      />
                      <span className="custom-check">
                        <Icon name="check" size={13} />
                      </span>
                      <div>
                        <b>{group.name}</b>
                      </div>
                    </label>
                  ))}
                </div>
                {shareGroupIds.length === 0 && (
                  <p className="muted">
                    どこにも共有しない場合、自分だけの課題になります。
                  </p>
                )}
              </>
            )}
          </div>
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
            <article
              className="task-card"
              key={item.id}
              onClick={() => setDetailTarget(item.id)}
            >
              <button
                aria-label={`${item.title}を完了`}
                title="完了にする"
                className={`task-check ${index === 0 ? "urgent" : ""}`}
                onClick={(event) => {
                  event.stopPropagation();
                  openReport(item.id);
                }}
              />
              <div>
                <button
                  className="task-course"
                  onClick={(event) => {
                    event.stopPropagation();
                    openCourse(item.shelfId);
                  }}
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
            <article
              className="task-card done"
              key={task.id}
              onClick={() => setDetailTarget(task.id)}
            >
              <button
                className="task-check"
                aria-label={`${task.title}を未完了に戻す`}
                title="未完了に戻す"
                onClick={(event) => {
                  event.stopPropagation();
                  void restoreTask(task);
                }}
              >
                <Icon name="check" size={15} />
              </button>
              <div>
                <button
                  className="task-course"
                  onClick={(event) => {
                    event.stopPropagation();
                    openCourse(task.shelfId);
                  }}
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
              <span onClick={(event) => event.stopPropagation()}>
                <Button icon="clock" onClick={() => openReport(task.id)}>
                  結果を編集
                </Button>
              </span>
            </article>
          ))}
        </section>
      </div>

      {detail && (
        <AssignmentDetailModal
          course={detail.course}
          title={detail.title}
          date={detail.date}
          canDelete={detail.createdBy === userId}
          deleting={deleting}
          onClose={() => setDetailTarget(null)}
          onReport={() => {
            setDetailTarget(null);
            openReport(detail.id);
          }}
          onDelete={() => void removeAssignment()}
        />
      )}

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
