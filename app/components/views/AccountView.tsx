"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { AccountProfile, LoadState, Navigate } from "../../types";
import { fetchGoogleStatus } from "@/lib/api/account";
import { signInWithGoogle } from "@/lib/supabase/auth";
import { Button, Icon, ProfileIcon } from "../ui";

export function AccountView({ navigate, profile, profileState }: { navigate: Navigate; profile: AccountProfile | null; profileState: LoadState }) {
  const [google, setGoogle] = useState<{ state: LoadState; connected: boolean }>({ state: "loading", connected: false });

  useEffect(() => {
    let cancelled = false;
    fetchGoogleStatus()
      .then((status) => { if (!cancelled) setGoogle({ state: "ready", connected: status.connected }); })
      .catch((err) => { console.error(err); if (!cancelled) setGoogle({ state: "error", connected: false }); });
    return () => { cancelled = true; };
  }, []);

  return <>
    <button className="back-link" onClick={() => navigate("home")}>← ホーム</button>
    <header className="page-head"><div><p className="eyebrow">ACCOUNT</p><h1>アカウント</h1><p>プロフィールと連携サービスを確認できます。</p></div></header>
    <section className="content-card account-card">
      {profileState === "loading" && <p className="muted">読み込み中…</p>}
      {profileState === "error" && <p className="muted">プロフィールの取得に失敗しました。</p>}
      {profileState === "ready" && profile && (
        <div className="account-profile">
          <ProfileIcon name={profile.displayName} url={profile.avatarUrl} />
          <div><h2>{profile.displayName}</h2></div>
          <Button onClick={() => navigate("profile-edit")}>表示名を編集</Button>
        </div>
      )}
      <div className="settings-list">
        <div>
          <Icon name="calendar" />
          <span><b>Google カレンダー</b><small>{google.state === "loading" ? "確認中…" : google.connected ? "連携済み" : "未連携"}</small></span>
          <Button onClick={() => signInWithGoogle("/")}>{google.connected ? "再連携" : "連携する"}</Button>
        </div>
        <div>
          <Icon name="users" />
          <span><b>ログイン中のアカウント</b><small>{profile?.email ?? ""}</small></span>
          <Link href="/logout" className="button subtle"><span>ログアウト</span></Link>
        </div>
      </div>
    </section>
  </>;
}
