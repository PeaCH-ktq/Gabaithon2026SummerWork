"use client";
import { useState } from "react";
import type { StudySessionFormValues } from "../../types";
import { toISOFromLocal, todayLocalDate } from "@/lib/format/datetime";
import { Button, Icon } from "../ui";

type Props = {
  groupName: string;
  saving: boolean;
  onClose: () => void;
  onSave: (values: StudySessionFormValues) => void;
};

export function ScheduleModal({ groupName, saving, onClose, onSave }: Props) {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(todayLocalDate());
  const [startTime, setStartTime] = useState("10:00");
  const [endTime, setEndTime] = useState("12:00");
  const [location, setLocation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const valid = title.trim().length > 0;

  function submit() {
    if (!valid || saving) return;
    const starts_at = toISOFromLocal(date, startTime);
    const ends_at = toISOFromLocal(date, endTime);
    if (!starts_at || !ends_at) {
      setError("日時を正しく入力してください");
      return;
    }
    if (ends_at <= starts_at) {
      setError("終了時刻は開始時刻より後にしてください");
      return;
    }
    setError(null);
    onSave({ title: title.trim(), location: location.trim() || null, starts_at, ends_at });
  }

  return (
    <div
      className="modal-scrim"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <section className="modal small-modal" role="dialog" aria-modal="true">
        <button
          className="modal-close"
          onClick={() => onClose()}
          aria-label="閉じる"
        >
          <Icon name="close" />
        </button>
        <p className="eyebrow">NEW STUDY SESSION</p>
        <h2>勉強会を決める</h2>
        <p>{groupName} のみんなに共有されます。</p>
        <label className="text-field">
          テーマ
          <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="データベース論 中間対策" />
        </label>
        <div className="field-pair">
          <label className="text-field">
            日付
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label className="text-field">
            開始時刻
            <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
          </label>
        </div>
        <label className="text-field">終了時刻<input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} /></label>
        <label className="text-field">
          場所
          <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="中央図書館 グループ学習室B" />
        </label>
        {error && <p className="modal-error" role="alert">{error}</p>}
        <div className="modal-actions">
          <Button subtle onClick={() => onClose()}>
            キャンセル
          </Button>
          <Button
            primary
            icon="calendar"
            onClick={submit}
            disabled={!valid || saving}
          >
            {saving ? "作成中…" : "予定を作成"}
          </Button>
        </div>
      </section>
    </div>
  );
}
