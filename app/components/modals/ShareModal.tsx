"use client";
import { useState } from "react";
import type { GroupRow, Shelf } from "../../types";
import { Button, Icon } from "../ui";

export function ShareModal({
  shelf,
  groups,
  saving,
  onClose,
  onSave,
  onCreateGroup,
}: {
  shelf: Shelf;
  groups: GroupRow[];
  saving?: boolean;
  onClose: () => void;
  onSave: (groupIds: string[]) => void;
  onCreateGroup: () => void;
}) {
  const [checked, setChecked] = useState<string[]>(shelf.shares.map((s) => s.group_id));

  function toggle(groupId: string) {
    setChecked((ids) => (ids.includes(groupId) ? ids.filter((id) => id !== groupId) : [...ids, groupId]));
  }

  return (
    <div className="modal-scrim" onMouseDown={(e) => e.target === e.currentTarget && !saving && onClose()}>
      <section className="modal small-modal" role="dialog" aria-modal="true">
        <button className="modal-close" onClick={onClose} aria-label="閉じる" disabled={saving}>
          <Icon name="close" />
        </button>
        <p className="eyebrow">SHARE SHELF</p>
        <h2>{shelf.course_name}をグループに共有</h2>
        {groups.length === 0 ? (
          <div className="empty-state">
            <b>所属しているグループがありません</b>
            <p>
              先にグループを作成するか、招待コードで参加してください。
              <button className="text-link" onClick={onCreateGroup}>グループを作成 / 参加する</button>
            </p>
          </div>
        ) : (
          <div className="selection-list">
            {groups.map((group) => (
              <label key={group.id}>
                <input
                  type="checkbox"
                  checked={checked.includes(group.id)}
                  onChange={() => toggle(group.id)}
                />
                <span className="custom-check"><Icon name="check" size={13} /></span>
                <div><b>{group.name}</b></div>
              </label>
            ))}
          </div>
        )}
        <div className="modal-actions">
          <Button subtle onClick={onClose} disabled={saving}>キャンセル</Button>
          <Button primary onClick={() => onSave(checked)} disabled={saving || groups.length === 0}>
            {saving ? "保存中…" : "保存"}
          </Button>
        </div>
      </section>
    </div>
  );
}
