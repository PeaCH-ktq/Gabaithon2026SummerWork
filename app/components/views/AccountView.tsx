import type { Navigate, Notify, Profile } from "../../types";
import { Button, Icon } from "../ui";

export function AccountView({ navigate, notify, profile }: { navigate: Navigate; notify: Notify; profile: Profile }) {
  return <>
    <button className="back-link" onClick={() => navigate("home")}>← ホーム</button>
    <header className="page-head"><div><p className="eyebrow">ACCOUNT</p><h1>アカウント</h1><p>プロフィールと連携サービスを確認できます。</p></div></header>
    <section className="content-card account-card">
      <div className="account-profile"><span className="avatar indigo">{profile.displayName.slice(0, 1)}</span><div><h2>{profile.displayName}</h2><p>{profile.faculty} {profile.department}</p></div><Button onClick={() => navigate("profile-edit")}>プロフィールを編集</Button></div>
      <div className="settings-list">
        <div><Icon name="calendar" /><span><b>Google カレンダー</b><small>未接続</small></span><Button onClick={() => notify("Google連携はバックエンド接続後に利用できます")}>連携する</Button></div>
        <div><Icon name="users" /><span><b>ログイン中のアカウント</b><small>{profile.email}</small></span><Button subtle onClick={() => navigate("logout")}>ログアウト</Button></div>
      </div>
    </section>
  </>;
}
