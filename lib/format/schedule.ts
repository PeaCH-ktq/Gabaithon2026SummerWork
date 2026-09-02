/**
 * 棚（講義）の曜日・時限・色の表示ヘルパー。
 * DB の `shelves.day_of_week`（0=日〜6=土）/ `period` を UI 文字列へ変換する。
 * 逆変換（"月曜 1限" → 数値）は作らない。入力は `<select>` で数値を直接持たせる前提。
 */

/** `day_of_week` のインデックス（0=日）に対応する曜日ラベル。 */
export const DAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"] as const;

/** 時限の選択肢。`<select>` の option に使う。 */
export const PERIOD_OPTIONS = [1, 2, 3, 4, 5, 6, 7] as const;

/**
 * 曜日・時限を "火曜 3限" のような文字列にする。
 * 片方だけ設定されていれば設定済みの側だけを返し、両方 null なら "時間未設定"。
 */
export function formatSchedule(
  dayOfWeek: number | null,
  period: number | null,
): string {
  const day =
    dayOfWeek != null && dayOfWeek >= 0 && dayOfWeek < DAY_LABELS.length
      ? `${DAY_LABELS[dayOfWeek]}曜`
      : null;
  const time = period != null ? `${period}限` : null;
  if (day && time) return `${day} ${time}`;
  if (day) return day;
  if (time) return time;
  return "時間未設定";
}

/**
 * 棚のタブ色パレット（`app/demo-data.ts` の配色を流用）。
 * `shelves.color` の default は先頭の '#5866c5'。
 */
export const SHELF_COLORS = [
  "#5866c5",
  "#ea8e72",
  "#54a887",
  "#b17fb6",
] as const;

/** 棚追加時に、既存の棚数などから順番に色を割り当てる。 */
export function pickShelfColor(index: number): string {
  return SHELF_COLORS[index % SHELF_COLORS.length];
}
