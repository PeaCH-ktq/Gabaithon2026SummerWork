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
}: {
  initial?: Shelf;
  saving?: boolean;
  onClose: () => void;
  onSave: (values: ShelfFormValues, id?: string) => void;
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

  return (
    <div className="modal-scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <section className="modal small-modal" role="dialog" aria-modal="true">
        <button className="modal-close" onClick={onClose} aria-label="閉じる"><Icon name="close" /></button>
        <p className="eyebrow">COURSE SHELF</p>
        <h2>{initial ? "棚を編集する" : "新しい棚をつくる"}</h2>
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
          <Button subtle onClick={onClose}>キャンセル</Button>
          <Button primary onClick={submit}>{saving ? "保存中…" : initial ? "変更を保存" : "棚を追加"}</Button>
        </div>
      </section>
    </div>
  );
}
