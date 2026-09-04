"use client";
import { useState } from "react";
import type { Shelf, ShelfFormValues } from "../../types";
import { DAY_LABELS, PERIOD_OPTIONS } from "@/lib/format/schedule";
import { Button, Icon } from "../ui";

export function ShelfModal({
  initial,
  saving,
  onClose,
  onSave,
  onDelete,
}: {
  initial?: Shelf;
  saving?: boolean;
  onClose: () => void;
  onSave: (values: ShelfFormValues, id?: string) => void;
  /** 自分が所有する棚を編集しているときだけ渡される。 */
  onDelete?: () => void;
}) {
  const [name, setName] = useState(initial?.course_name ?? "");
  const [code, setCode] = useState(initial?.course_code ?? "");
  const [professor, setProfessor] = useState(initial?.professor ?? "");
  const [room, setRoom] = useState(initial?.room ?? "");
  const [day, setDay] = useState<string>(initial?.day_of_week?.toString() ?? "");
  const [period, setPeriod] = useState<string>(initial?.period?.toString() ?? "");
  const valid = name.trim().length > 0;

  function submit() {
    if (!valid || saving) return;
    onSave(
      {
        course_name: name.trim(),
        course_code: code.trim() || null,
        professor: professor.trim() || null,
        room: room.trim() || null,
        day_of_week: day === "" ? null : Number(day),
        period: period === "" ? null : Number(period),
      },
      initial?.id,
    );
  }

  /**
   * 棚を消すと資料・問題集・課題・共有設定まで cascade で消える。
   * 資料の実ファイルも Storage から消える（`lib/data/shelves.deleteShelf`）ので、
   * 何が失われるかを件数で示してから確認する。
   */
  function confirmDelete() {
    if (!initial || !onDelete || saving) return;
    const losses = [
      initial.materialCount > 0 ? `講義資料 ${initial.materialCount}件` : null,
      initial.miscCount > 0 ? `雑資料 ${initial.miscCount}件` : null,
      initial.questionSetCount > 0 ? `問題集 ${initial.questionSetCount}件` : null,
      initial.shares.length > 0 ? `${initial.shares.length}グループへの共有` : null,
    ].filter((item): item is string => item !== null);
    const detail =
      losses.length > 0
        ? `\n\n${losses.join("・")}も削除されます。この操作は取り消せません。`
        : "\n\nこの操作は取り消せません。";
    if (!window.confirm(`「${initial.course_name}」を削除します。${detail}`)) return;
    onDelete();
  }

  return (
    <div className="modal-scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <section className="modal small-modal" role="dialog" aria-modal="true">
        <button className="modal-close" onClick={onClose} aria-label="閉じる"><Icon name="close" /></button>
        <p className="eyebrow">COURSE SHELF</p>
        <h2>{initial ? "講義を編集する" : "新しい講義を登録する"}</h2>
        <div className="field-pair">
          <label className="text-field">講義コード<input value={code} onChange={(e) => setCode(e.target.value)} placeholder="CS-302" /></label>
          <div className="field-pair">
            <label className="text-field">曜日
              <select value={day} onChange={(e) => setDay(e.target.value)}>
                <option value="">未設定</option>
                {DAY_LABELS.map((label, i) => <option key={i} value={i}>{label}曜</option>)}
              </select>
            </label>
            <label className="text-field">時限
              <select value={period} onChange={(e) => setPeriod(e.target.value)}>
                <option value="">未設定</option>
                {PERIOD_OPTIONS.map((p) => <option key={p} value={p}>{p}限</option>)}
              </select>
            </label>
          </div>
        </div>
        <label className="text-field">講義名<input autoFocus value={name} onChange={(e) => setName(e.target.value)} /></label>
        <label className="text-field">担当教員<input value={professor} onChange={(e) => setProfessor(e.target.value)} /></label>
        <label className="text-field">教室<input value={room} onChange={(e) => setRoom(e.target.value)} /></label>
        <div className="modal-actions">
          {initial && onDelete ? (
            <Button danger disabled={saving} onClick={confirmDelete}>講義を削除</Button>
          ) : (
            <Button subtle onClick={onClose}>キャンセル</Button>
          )}
          <Button primary disabled={saving} onClick={submit}>{saving ? "保存中…" : initial ? "変更を保存" : "講義の追加"}</Button>
        </div>
      </section>
    </div>
  );
}
