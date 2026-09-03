"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { signOut } from "@/lib/supabase/auth";

export default function LogoutPage() {
  const [state, setState] = useState<"pending" | "done" | "error">("pending");

  useEffect(() => {
    signOut()
      .then(() => setState("done"))
      .catch(() => setState("error"));
  }, []);

  return (
    <main className="auth-screen">
      <div className="auth-card">
        {/* ロゴアイコン（Tan-E_icon.svg をそのまま表示） */}
        <img
          src="/Tan-E_icon.svg"
          alt="Tan-E"
          className="auth-mark"
          width={120}
          height={108}
        />
        {state === "pending" && (
          <>
            <h1 className="auth-title">ログアウトしています…</h1>
            <p className="auth-lead">少々お待ちください。</p>
          </>
        )}
        {state === "done" && (
          <>
            <h1 className="auth-title">ログアウトしました</h1>
            <p className="auth-lead">またのご利用をお待ちしています。</p>
            <Link href="/login" className="auth-google">
              <span>ログイン画面へ</span>
            </Link>
          </>
        )}
        {state === "error" && (
          <>
            <h1 className="auth-title">ログアウトに失敗しました</h1>
            <p className="auth-lead">時間をおいて再度お試しください。</p>
            <Link href="/" className="auth-google">
              <span>ホームへ戻る</span>
            </Link>
          </>
        )}
      </div>
    </main>
  );
}
