/**
 * 勉強会（study_sessions）の日時表示・組み立てヘルパー。
 * 曜日・時限（`shelves`）用の `lib/format/schedule.ts` とは別物。
 */
import { DAY_LABELS } from "./schedule";

/** ISO 文字列を "8月30日（日）" 形式にする。 */
export function formatSessionDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}月${d.getDate()}日（${DAY_LABELS[d.getDay()]}）`;
}

/** ISO 文字列を "14:00" 形式にする。 */
export function formatSessionTime(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** 開始・終了 ISO を "14:00 – 18:00" 形式にする。 */
export function formatSessionRange(startISO: string, endISO: string): string {
  return `${formatSessionTime(startISO)} – ${formatSessionTime(endISO)}`;
}

/**
 * "2026-09-06" + "14:00" のようなローカル日付・時刻文字列を ISO(UTC) にする。
 * 不正な組み合わせ（空・パース失敗）は null を返す。逆パーサは作らない。
 */
export function toISOFromLocal(date: string, time: string): string | null {
  if (!date || !time) return null;
  const d = new Date(`${date}T${time}`);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

/** 今日の日付を `<input type="date">` 用の "YYYY-MM-DD" にする。 */
export function todayLocalDate(): string {
  const d = new Date();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${month}-${day}`;
}
