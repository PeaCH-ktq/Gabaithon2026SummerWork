"use client";
import { useState } from "react";
import type { AccountProfile, Navigate } from "../../types";
import { Button, ProfileIcon } from "../ui";

export function ProfileEditView({ navigate, profile, saving, onSave }: { navigate: Navigate; profile: AccountProfile; saving: boolean; onSave: (displayName: string) => void }) {
  const [displayName, setDisplayName] = useState(profile.displayName);
  const valid = displayName.trim().length > 0;
  return <>
    <button className="back-link" onClick={() => navigate("account")}>← アカウント</button>
    <header className="page-head"><div><p className="eyebrow">EDIT PROFILE</p><h1>表示名を編集</h1><p>アプリ内で表示される名前を変更できます。</p></div></header>
    <section className="content-card profile-form">
      <label className="text-field">表示名<input autoFocus value={displayName} maxLength={40} onChange={(e) => setDisplayName(e.target.value)} /></label>
      <div className="form-actions">
        <Button subtle onClick={() => navigate("account")}>キャンセル</Button>
        <Button primary disabled={!valid || saving} onClick={() => valid && onSave(displayName.trim())}>{saving ? "保存中…" : "変更を保存"}</Button>
      </div>
    </section>
  </>;
}
