"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/types";

type Group = Database["public"]["Tables"]["groups"]["Row"];
type StudySession = Database["public"]["Tables"]["study_sessions"]["Row"];

/**
 * 開発用の動作確認ページ（本番 UI は FE タスク）。
 * /dev/calendar で 勉強予定を作り、カレンダー連携 API を叩く。
 *
 * グループ / メンバーの用意は RLS の制約（`group_members` は直接 insert 不可、
 * 参加は `join_group_by_code` RPC のみ）でこの簡易ページの範囲外。
 * 事前に MCP で用意する（ページ下部の手順参照）。自分が所属するグループだけ表示される。
 */
export default function DevCalendarPage() {
  const supabase = createClient();

  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [sessions, setSessions] = useState<StudySession[]>([]);
  const [log, setLog] = useState<string>("");

  const say = useCallback((label: string, data: unknown) => {
    setLog(
      (prev) =>
        `[${new Date().toLocaleTimeString()}] ${label}\n` +
        JSON.stringify(data, null, 2) +
        "\n\n" +
        prev,
    );
  }, []);

  const refresh = useCallback(async () => {
    // RLS: 自分がメンバーのグループだけ返る。
    const { data: gs } = await supabase
      .from("groups")
      .select("*")
      .order("created_at", { ascending: false });
    setGroups(gs ?? []);

    const { data: ss } = await supabase
      .from("study_sessions")
      .select("*")
      .order("starts_at", { ascending: true });
    setSessions(ss ?? []);
  }, [supabase]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      setUserId(data.user?.id ?? null);
      setEmail(data.user?.email ?? null);
      await refresh();
    })();
  }, [supabase, refresh]);

  async function createSession(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!userId) return;
    const f = new FormData(e.currentTarget);
    const starts = new Date(f.get("starts_at") as string).toISOString();
    const ends = new Date(f.get("ends_at") as string).toISOString();
    const { data, error } = await supabase
      .from("study_sessions")
      .insert({
        group_id: f.get("group_id") as string,
        created_by: userId,
        title: f.get("title") as string,
        location: (f.get("location") as string) || null,
        starts_at: starts,
        ends_at: ends,
      })
      .select()
      .single();
    say("勉強予定 作成", { data, error });
    await refresh();
  }

  async function calendarPost(sessionId: string) {
    const res = await fetch("/api/calendar/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ study_session_id: sessionId }),
    });
    say(`POST /api/calendar/events (${res.status})`, await res.json());
  }

  async function calendarDelete(sessionId: string) {
    const res = await fetch(`/api/calendar/events/${sessionId}`, {
      method: "DELETE",
    });
    say(
      `DELETE /api/calendar/events/${sessionId} (${res.status})`,
      await res.json(),
    );
  }

  if (!userId) {
    return (
      <main className="mx-auto max-w-3xl p-8 font-sans">
        <h1 className="text-xl font-semibold">カレンダー連携 動作確認</h1>
        <p className="mt-4 text-sm text-red-700">
          未ログインです。
          <a className="underline" href="/login?next=/dev/calendar">
            ログイン
          </a>
          してください。
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto grid max-w-5xl gap-8 p-8 font-sans md:grid-cols-2">
      <div className="flex flex-col gap-8">
        <section>
          <h1 className="text-xl font-semibold">カレンダー連携 動作確認</h1>
          <p className="mt-1 text-sm text-zinc-500">
            ログイン中: {email}{" "}
            <code className="text-xs">({userId.slice(0, 8)})</code>
          </p>
        </section>

        <section>
          <h2 className="font-semibold">1. 勉強予定を作成</h2>
          {groups.length === 0 ? (
            <p className="mt-2 text-sm text-amber-700">
              所属グループがありません。下の手順で MCP から用意してください。
            </p>
          ) : (
            <form
              onSubmit={createSession}
              className="mt-2 flex flex-col gap-2 text-sm"
            >
              <select
                name="group_id"
                required
                className="rounded border px-2 py-1"
              >
                <option value="">グループを選択…</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
              <input
                name="title"
                required
                placeholder="タイトル（例: 期末対策）"
                className="rounded border px-2 py-1"
              />
              <input
                name="location"
                placeholder="場所（例: 図書館3F）"
                className="rounded border px-2 py-1"
              />
              <label className="flex items-center gap-2">
                開始
                <input
                  type="datetime-local"
                  name="starts_at"
                  required
                  className="rounded border px-2 py-1"
                />
              </label>
              <label className="flex items-center gap-2">
                終了
                <input
                  type="datetime-local"
                  name="ends_at"
                  required
                  className="rounded border px-2 py-1"
                />
              </label>
              <button className="w-32 rounded bg-black px-3 py-1 text-white dark:bg-white dark:text-black">
                作成
              </button>
            </form>
          )}
        </section>

        <section>
          <h2 className="font-semibold">2. 予定 → カレンダー連携</h2>
          <ul className="mt-2 flex flex-col gap-3">
            {sessions.map((s) => (
              <li key={s.id} className="rounded border p-3 text-sm">
                <p className="font-medium">{s.title}</p>
                <p className="text-xs text-zinc-500">
                  {s.location ?? "場所なし"} ·{" "}
                  {new Date(s.starts_at).toLocaleString()} –{" "}
                  {new Date(s.ends_at).toLocaleString()}
                </p>
                <p className="text-xs text-zinc-500">session: {s.id}</p>
                <div className="mt-2 flex gap-2">
                  <button
                    onClick={() => calendarPost(s.id)}
                    className="rounded border px-3 py-1 text-xs"
                  >
                    カレンダーへ追加 (POST)
                  </button>
                  <button
                    onClick={() => calendarDelete(s.id)}
                    className="rounded border px-3 py-1 text-xs"
                  >
                    反映取り消し (DELETE)
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="text-xs text-zinc-500">
          <h2 className="font-semibold text-zinc-700 dark:text-zinc-300">
            事前準備（MCP で 1 回だけ）
          </h2>
          <pre className="mt-2 overflow-auto rounded border bg-zinc-50 p-3 whitespace-pre-wrap dark:bg-zinc-900">
            {`-- 1. 自分の user_id を確認
select id, display_name from profiles;

-- 2. グループ作成 + 自分を owner で参加
with g as (
  insert into groups (name, invite_code, created_by)
  values ('dev group', 'dev-0001', '<自分のuuid>')
  returning id
)
insert into group_members (group_id, user_id, role)
select id, '<自分のuuid>', 'owner' from g;

-- （任意）B もテストするなら B の uuid も足す
-- insert into group_members (group_id, user_id, role)
-- values ('<group_id>', '<Bのuuid>', 'member');`}
          </pre>
        </section>
      </div>

      <div>
        <div className="sticky top-8">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">レスポンスログ</h2>
            <button
              onClick={() => setLog("")}
              className="rounded border px-2 py-1 text-xs"
            >
              クリア
            </button>
          </div>
          <pre className="mt-2 h-[80vh] overflow-auto rounded border bg-zinc-50 p-3 text-xs whitespace-pre-wrap dark:bg-zinc-900">
            {log || "（まだ何も実行していません）"}
          </pre>
        </div>
      </div>
    </main>
  );
}
