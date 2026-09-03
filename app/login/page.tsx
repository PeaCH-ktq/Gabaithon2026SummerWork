"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

import { signInWithGoogle } from "@/lib/supabase/auth";

const ERROR_MESSAGES: Record<string, string> = {
  denied: "ログインがキャンセルされました。",
  missing_code: "認証コードを受け取れませんでした。もう一度お試しください。",
  exchange_failed: "ログイン処理に失敗しました。もう一度お試しください。",
};

export default function LoginPage() {
  return (
    <main className="auth-screen">
      <Suspense fallback={<div className="auth-card" />}>
        <LoginCard />
      </Suspense>
    </main>
  );
}

function LoginCard() {
  const params = useSearchParams();
  const next = params.get("next") ?? "/";
  const callbackError = params.get("auth_error");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const message =
    error ||
    (callbackError
      ? (ERROR_MESSAGES[callbackError] ?? "ログインに失敗しました。")
      : "");

  async function handleLogin() {
    setError("");
    setLoading(true);
    try {
      await signInWithGoogle(next);
      // 成功時は Google へリダイレクトするのでこの後は実行されない。
    } catch {
      setError(
        "ログインを開始できませんでした。時間をおいて再度お試しください。",
      );
      setLoading(false);
    }
  }

  return (
    <div className="auth-card">
      {/* ロゴアイコン（Tan-E_icon.svg をそのまま表示） */}
      <img
        src="/Tan-E_icon.svg"
        alt="Tan-E"
        className="auth-mark"
        width={120}
        height={108}
      />
      <h1 className="auth-title">Tan-E にログイン</h1>
      <p className="auth-lead">Google アカウントでログインしてください。</p>

      {message && (
        <p className="auth-error" role="alert">
          {message}
        </p>
      )}

      <button
        type="button"
        className="auth-google"
        onClick={handleLogin}
        disabled={loading}
      >
        <GoogleGlyph />
        <span>{loading ? "リダイレクト中…" : "Google でログイン"}</span>
      </button>

      <p className="auth-note">
        ログイン時に Google カレンダーへの書き込み権限を求めます
        （勉強予定の連携に使用します）。
      </p>
    </div>
  );
}

function GoogleGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.83.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.47.9 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z"
      />
    </svg>
  );
}
