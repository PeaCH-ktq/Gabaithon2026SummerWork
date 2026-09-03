/**
 * 課題（`assignments`）の表示ヘルパー。
 * DB の `due_at`（timestamptz）から、旧デモ配列 `deadlines` と同じ見た目の
 * 表示用文字列・配色を組み立てる。
 */

const DATE_FMT = new Intl.DateTimeFormat("ja-JP", {
  month: "long",
  day: "numeric",
});

/** "8月31日 23:59" のような表示用の締切日時。 */
export function formatDueDate(dueAt: string): string {
  const due = new Date(dueAt);
  const hours = String(due.getHours()).padStart(2, "0");
  const minutes = String(due.getMinutes()).padStart(2, "0");
  return `${DATE_FMT.format(due)} ${hours}:${minutes}`;
}

/** "あと 2日" / "本日締切" / "期限切れ" のような残り時間の表示。 */
export function formatTimeLeft(dueAt: string): string {
  const diffMs = new Date(dueAt).getTime() - Date.now();
  if (diffMs < 0) return "期限切れ";
  const days = Math.ceil(diffMs / (24 * 60 * 60 * 1000));
  if (days <= 0) return "本日締切";
  return `あと ${days}日`;
}

/** 残り日数から色（旧デモ配列の配色を踏襲: 3日以内=coral、7日以内=yellow、それ以降=green）。 */
export function pickDeadlineColor(dueAt: string): string {
  const diffMs = new Date(dueAt).getTime() - Date.now();
  const days = diffMs / (24 * 60 * 60 * 1000);
  if (days <= 3) return "coral";
  if (days <= 7) return "yellow";
  return "green";
}

/** "2時間30分" / "45分" のような、かかった時間の表示。 */
export function formatMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return hours ? `${hours}時間${rest ? `${rest}分` : ""}` : `${rest}分`;
}

/** 課題一覧・課題カードの表示に使う整形済みビュー。 */
export type AssignmentView = {
  id: string;
  shelfId: string;
  groupId: string | null;
  createdBy: string;
  dueAt: string;
  title: string;
  course: string;
  date: string;
  left: string;
  color: string;
};

export function buildAssignmentView(
  row: {
    id: string;
    shelf_id: string;
    group_id: string | null;
    created_by: string;
    title: string;
    due_at: string;
  },
  courseName: string,
): AssignmentView {
  return {
    id: row.id,
    shelfId: row.shelf_id,
    groupId: row.group_id,
    createdBy: row.created_by,
    dueAt: row.due_at,
    title: row.title,
    course: courseName,
    date: formatDueDate(row.due_at),
    left: formatTimeLeft(row.due_at),
    color: pickDeadlineColor(row.due_at),
  };
}
