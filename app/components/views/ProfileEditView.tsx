"use client";
import { useState } from "react";
import type { Navigate, Profile } from "../../types";
import { Button } from "../ui";

export function ProfileEditView({ navigate, profile, onSave }: { navigate: Navigate; profile: Profile; onSave: (profile: Profile) => void }) {
  const [draft, setDraft] = useState(profile);
  const update = (key: keyof Profile, value: string) => setDraft((current) => ({ ...current, [key]: value }));
  const valid = draft.displayName.trim() && draft.email.trim();
  return <>
    <button className="back-link" onClick={() => navigate("account")}>← アカウント</button>
    <header className="page-head"><div><p className="eyebrow">EDIT PROFILE</p><h1>プロフィールを編集</h1><p>アプリ内で表示される名前と所属情報を変更できます。</p></div></header>
    <section className="content-card profile-form">
      <div className="profile-avatar-preview"><span className="avatar indigo">{draft.displayName.slice(0, 1) || "?"}</span><div><b>プロフィール画像</b><small>画像の変更はバックエンド接続後に利用できます。</small></div></div>
      <label className="text-field">表示名<input autoFocus value={draft.displayName} maxLength={40} onChange={(e) => update("displayName", e.target.value)} /></label>
      <div className="field-pair"><label className="text-field">学部<input value={draft.faculty} maxLength={60} onChange={(e) => update("faculty", e.target.value)} /></label><label className="text-field">学科<input value={draft.department} maxLength={60} onChange={(e) => update("department", e.target.value)} /></label></div>
      <label className="text-field">メールアドレス<input type="email" value={draft.email} onChange={(e) => update("email", e.target.value)} /></label>
      <div className="form-actions"><Button subtle onClick={() => navigate("account")}>キャンセル</Button><Button primary onClick={() => valid && onSave({ ...draft, displayName: draft.displayName.trim(), email: draft.email.trim() })}>変更を保存</Button></div>
    </section>
  </>;
}
