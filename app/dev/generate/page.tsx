"use client";

import { useState } from "react";
import { MathText } from "@/components/MathText";
import { QuestionPaper } from "@/components/QuestionPaper";
import type { QuestionSet } from "@/lib/gemini/schema";

/**
 * 開発用の動作確認ページ（本番 UI は別タスク）。
 * /dev/generate でファイルを1つアップして問題生成 API を叩き、
 * A4 問題用紙と解答・解説を表示する。
 */
export default function DevGeneratePage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<QuestionSet | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    const form = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/questions/generate", {
        method: "POST",
        body: form,
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? `HTTP ${res.status}`);
      } else {
        setResult(json.questionSet as QuestionSet);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl p-8 font-sans">
      <h1 className="text-xl font-semibold">問題生成 API 動作確認</h1>
      <p className="mt-1 text-sm text-zinc-500">
        講義資料か過去問のファイルを1つアップロード（中身の判定は Gemini が行う）
      </p>

      <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4 print:hidden">
        <label className="flex flex-col gap-1 text-sm">
          ファイル（講義資料 または 過去問）
          <input type="file" name="file" accept=".pdf,.txt,.md,image/*" required />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          追加の指示（任意）
          <input
            type="text"
            name="extraInstruction"
            placeholder="例: 第3章の範囲だけ / 計算問題を多めに"
            className="rounded border px-2 py-1"
          />
        </label>

        <button
          type="submit"
          disabled={loading}
          className="w-40 rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-50 dark:bg-white dark:text-black"
        >
          {loading ? "生成中…" : "問題を生成"}
        </button>
      </form>

      {error && (
        <p className="mt-4 rounded bg-red-50 p-3 text-sm text-red-700 print:hidden">
          {error}
        </p>
      )}

      {result && (
        <div className="mt-8 flex flex-col gap-6">
          <button
            type="button"
            onClick={() => window.print()}
            className="w-32 self-start rounded border px-4 py-2 text-sm print:hidden"
          >
            印刷する
          </button>

          <QuestionPaper questionSet={result} />

          <section className="print:hidden">
            <h2 className="text-lg font-semibold">解答・解説</h2>
            <ol className="mt-3 flex flex-col gap-4">
              {result.questions.map((q, i) => (
                <li key={i} className="rounded border p-3 text-sm">
                  <p className="font-bold">問 {i + 1}.</p>
                  {q.answer && (
                    <p className="mt-1">
                      <span className="font-medium">解答: </span>
                      <MathText text={q.answer} />
                    </p>
                  )}
                  {q.explanation && (
                    <p className="mt-1 text-zinc-600">
                      <span className="font-medium">解説: </span>
                      <MathText text={q.explanation} />
                    </p>
                  )}
                </li>
              ))}
            </ol>
          </section>
        </div>
      )}
    </main>
  );
}
