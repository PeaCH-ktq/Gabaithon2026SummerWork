import type { Notify } from "../../types";
import { Button, Icon } from "../ui";

type Props = { onClose: () => void; notify: Notify };

export function ScheduleModal({ onClose, notify }: Props) {
  return (
    <div
      className="modal-scrim"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <section className="modal small-modal">
        <button
          className="modal-close"
          onClick={() => onClose()}
          aria-label="閉じる"
        >
          <Icon name="close" />
        </button>
        <p className="eyebrow">NEW STUDY SESSION</p>
        <h2>勉強会を決める</h2>
        <p>グループのみんなに共有されます。</p>
        <label className="text-field">
          テーマ
          <input defaultValue="データベース論 中間対策" />
        </label>
        <div className="field-pair">
          <label className="text-field">
            日付
            <input type="date" defaultValue="2026-09-06" />
          </label>
          <label className="text-field">
            開始時刻
            <input type="time" defaultValue="14:00" />
          </label>
        </div>
        <label className="text-field">終了時刻<input type="time" defaultValue="18:00" /></label>
        <label className="text-field">
          場所
          <input defaultValue="中央図書館 グループ学習室B" />
        </label>
        <div className="modal-actions">
          <Button subtle onClick={() => onClose()}>
            キャンセル
          </Button>
          <Button
            primary
            icon="calendar"
            onClick={() => {
              onClose();
              notify("勉強会を作成し、グループに共有しました");
            }}
          >
            予定を作成
          </Button>
        </div>
      </section>
    </div>
  );
}
