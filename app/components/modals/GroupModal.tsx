"use client";
import { useState } from "react";
import { Button, Icon } from "../ui";

export function GroupModal({
  creating,
  joining,
  onClose,
  onCreate,
  onJoin,
}: {
  creating?: boolean;
  joining?: boolean;
  onClose: () => void;
  onCreate: (name: string) => void;
  onJoin: (code: string) => void;
}) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const busy = creating || joining;

  function submitCreate() {
    if (!name.trim() || busy) return;
    onCreate(name.trim());
  }
  function submitJoin() {
    if (!code.trim() || busy) return;
    onJoin(code.trim());
  }

  return (
    <div className="modal-scrim" onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose()}>
      <section className="modal small-modal" role="dialog" aria-modal="true">
        <button className="modal-close" onClick={onClose} aria-label="閉じる" disabled={busy}>
          <Icon name="close" />
        </button>
        <p className="eyebrow">NEW GROUP</p>
        <h2>グループを作る</h2>
        <label className="text-field">
          グループ名
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="情報工学3年"
          />
        </label>
        <div className="modal-actions">
          <span />
          <Button primary onClick={submitCreate} disabled={!name.trim() || busy}>
            {creating ? "作成中…" : "グループを作成"}
          </Button>
        </div>
        <p className="eyebrow" style={{ marginTop: 28 }}>JOIN GROUP</p>
        <h2>招待コードで参加</h2>
        <label className="text-field">
          招待コード
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="TANE-XXXX"
          />
        </label>
        <div className="modal-actions">
          <span />
          <Button onClick={submitJoin} disabled={!code.trim() || busy}>
            {joining ? "参加中…" : "参加する"}
          </Button>
        </div>
      </section>
    </div>
  );
}
