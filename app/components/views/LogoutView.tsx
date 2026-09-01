"use client";
import { useState } from "react";
import type { Navigate } from "../../types";
import { Button } from "../ui";

export function LogoutView({ navigate }: { navigate: Navigate }) {
  const [loggedOut, setLoggedOut] = useState(false);
  return <div className="account-action-page"><section className="content-card logout-card"><span className="brand-mark"><span /></span>{loggedOut ? <><p className="eyebrow">SIGNED OUT</p><h1>ログアウトしました</h1><p>この端末でのセッションを終了しました。</p><Button primary onClick={() => navigate("home")}>もう一度ログイン</Button></> : <><p className="eyebrow">LOG OUT</p><h1>ログアウトしますか？</h1><p>保存されている問題集や課題が削除されることはありません。</p><div className="form-actions"><Button subtle onClick={() => navigate("account")}>キャンセル</Button><Button primary onClick={() => setLoggedOut(true)}>ログアウト</Button></div></>}</section></div>;
}
