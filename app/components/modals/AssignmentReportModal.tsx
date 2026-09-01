"use client";

import { useState } from "react";
import { Button, Icon } from "../ui";

export type AssignmentReport = { minutesSpent: number; comment: string };

export function AssignmentReportModal({ taskTitle, initial, onClose, onSave }: { taskTitle: string; initial?: AssignmentReport; onClose: () => void; onSave: (report: AssignmentReport) => void }) {
  const [hours, setHours] = useState(Math.floor((initial?.minutesSpent ?? 0) / 60));
  const [minutes, setMinutes] = useState((initial?.minutesSpent ?? 0) % 60);
  const [comment, setComment] = useState(initial?.comment ?? "");
  const [error, setError] = useState("");
  function submit() {
    const total = hours * 60 + minutes;
    if (total <= 0) return setError("取り組んだ時間を入力してください。");
    if (!comment.trim()) return setError("グループに共有するコメントを入力してください。");
    onSave({ minutesSpent: total, comment: comment.trim() });
  }
  return <div className="modal-scrim" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section className="modal small-modal" role="dialog" aria-modal="true" aria-label="課題の結果を投稿"><button className="modal-close" onClick={onClose} aria-label="閉じる"><Icon name="close" /></button><p className="eyebrow">ASSIGNMENT REPORT</p><h2>課題の結果を投稿</h2><p className="report-task-name">{taskTitle}</p><fieldset className="duration-fields"><legend>かかった時間</legend><label><input type="number" min="0" max="99" value={hours} onChange={(e) => setHours(Math.max(0, Number(e.target.value)))} />時間</label><label><input type="number" min="0" max="59" value={minutes} onChange={(e) => setMinutes(Math.min(59, Math.max(0, Number(e.target.value))))} />分</label></fieldset><label className="text-field">コメント<textarea autoFocus maxLength={500} rows={5} value={comment} onChange={(e) => { setComment(e.target.value); setError(""); }} placeholder="難しかった点や、進め方のコツを共有しましょう" /><small>{comment.length} / 500</small></label>{error && <p className="modal-error" role="alert">{error}</p>}<div className="share-notice"><Icon name="users" size={16} /><span><b>グループに共有されます</b><small>投稿後も内容を編集できます。</small></span></div><div className="modal-actions"><Button subtle onClick={onClose}>あとで投稿</Button><Button primary icon="share" onClick={submit}>{initial ? "変更を保存" : "結果を投稿"}</Button></div></section></div>;
}
