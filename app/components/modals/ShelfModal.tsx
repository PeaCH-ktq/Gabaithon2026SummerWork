"use client";
import { useState } from "react";
import type { Course } from "../../types";
import { Button, Icon } from "../ui";

export function ShelfModal({ initial, onClose, onSave }: { initial?: Course; onClose: () => void; onSave: (course: Course) => void }) {
  const [name, setName] = useState(initial?.name ?? "");
  const [code, setCode] = useState(initial?.code ?? "");
  const [professor, setProfessor] = useState(initial?.professor ?? "");
  const [schedule, setSchedule] = useState(initial?.schedule ?? "月曜 1限");
  const [room, setRoom] = useState(initial?.room ?? "");
  const valid = name.trim() && code.trim();
  return <div className="modal-scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}><section className="modal small-modal" role="dialog" aria-modal="true">
    <button className="modal-close" onClick={onClose} aria-label="閉じる"><Icon name="close" /></button><p className="eyebrow">COURSE SHELF</p><h2>{initial ? "棚を編集する" : "新しい棚をつくる"}</h2>
    <div className="field-pair"><label className="text-field">講義コード<input value={code} onChange={(e) => setCode(e.target.value)} placeholder="CS-302" /></label><label className="text-field">曜日・時限<input value={schedule} onChange={(e) => setSchedule(e.target.value)} /></label></div>
    <label className="text-field">講義名<input autoFocus value={name} onChange={(e) => setName(e.target.value)} /></label><label className="text-field">担当教員<input value={professor} onChange={(e) => setProfessor(e.target.value)} /></label><label className="text-field">教室<input value={room} onChange={(e) => setRoom(e.target.value)} /></label>
    <div className="modal-actions"><Button subtle onClick={onClose}>キャンセル</Button><Button primary onClick={() => valid && onSave({ code: code.trim(), name: name.trim(), professor: professor.trim() || "担当教員未設定", schedule, room: room.trim() || "教室未設定", docs: initial?.docs ?? 0, quizzes: initial?.quizzes ?? 0, shared: initial?.shared ?? false, tab: initial?.tab ?? "#5866c5" })}>{initial ? "変更を保存" : "棚を追加"}</Button></div>
  </section></div>;
}
