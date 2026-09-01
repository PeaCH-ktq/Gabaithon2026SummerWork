"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/types";
import type { Shelf } from "@/app/types";
import {
  createShelf,
  deleteShelf,
  listShelves,
} from "@/lib/data/shelves";
import {
  createGroup,
  joinGroupByCode,
  listGroupMembers,
  listMyGroups,
} from "@/lib/data/groups";
import {
  DAY_LABELS,
  PERIOD_OPTIONS,
  formatSchedule,
  pickShelfColor,
} from "@/lib/format/schedule";

type Group = Database["public"]["Tables"]["groups"]["Row"];

/**
 * 開発用ハーネス（本番 UI はタスク3以降）。
 * lib/data/* と lib/format/schedule.ts を実データで叩いて確認する。
 */
export default function DevShelvesPage() {
  const [supabase] = useState(() => createClient());
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [shelves, setShelves] = useState<Shelf[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [members, setMembers] = useState<
    Record<string, Awaited<ReturnType<typeof listGroupMembers>>>
  >({});
  const [log, setLog] = useState("");

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
    try {
      const [s, g] = await Promise.all([
        listShelves(supabase),
        listMyGroups(supabase),
      ]);
      setShelves(s);
      setGroups(g);
      const entries = await Promise.all(
        g.map(async (grp) => [grp.id, await listGroupMembers(supabase, grp.id)] as const),
      );
      setMembers(Object.fromEntries(entries));
    } catch (err) {
      say("refresh エラー", err instanceof Error ? err.message : String(err));
    }
  }, [supabase, say]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      setUserId(data.user?.id ?? null);
      setEmail(data.user?.email ?? null);
      await refresh();
    })();
  }, [supabase, refresh]);

  async function onCreateShelf(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    try {
      const row = await createShelf(supabase, {
        course_name: f.get("course_name") as string,
        course_code: (f.get("course_code") as string) || null,
        professor: (f.get("professor") as string) || null,
        room: (f.get("room") as string) || null,
        day_of_week: numOrNull(f.get("day_of_week")),
        period: numOrNull(f.get("period")),
        color: pickShelfColor(shelves.length),
      });
      say("棚 作成", row);
      (e.target as HTMLFormElement).reset();
      await refresh();
    } catch (err) {
      say("棚 作成エラー", err instanceof Error ? err.message : String(err));
    }
  }

  async function onDeleteShelf(id: string) {
    try {
      await deleteShelf(supabase, id);
      say("棚 削除", { id });
      await refresh();
    } catch (err) {
      say("棚 削除エラー", err instanceof Error ? err.message : String(err));
    }
  }

  async function onCreateGroup(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    try {
      const row = await createGroup(supabase, f.get("name") as string);
      say("グループ 作成（直後に一覧へ出れば owner トリガー成功）", row);
      (e.target as HTMLFormElement).reset();
      await refresh();
    } catch (err) {
      say("グループ 作成エラー", err instanceof Error ? err.message : String(err));
    }
  }

  async function onJoin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    try {
      const gid = await joinGroupByCode(supabase, f.get("code") as string);
      say("グループ 参加", { group_id: gid });
      (e.target as HTMLFormElement).reset();
      await refresh();
    } catch (err) {
      say("グループ 参加エラー", err instanceof Error ? err.message : String(err));
    }
  }

  if (!userId) {
    return (
      <main className="mx-auto max-w-3xl p-8 font-sans">
        <h1 className="text-xl font-semibold">棚・グループ 動作確認</h1>
        <p className="mt-4 text-sm text-red-700">
          未ログインです。
          <a className="underline" href="/login?next=/dev/shelves">
            ログイン
          </a>
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto grid max-w-5xl gap-8 p-8 font-sans md:grid-cols-2">
      <div className="flex flex-col gap-8">
        <section>
          <h1 className="text-xl font-semibold">棚・グループ 動作確認</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {email} <code className="text-xs">({userId.slice(0, 8)})</code>
          </p>
        </section>

        <section>
          <h2 className="font-semibold">棚を作成</h2>
          <form onSubmit={onCreateShelf} className="mt-2 flex flex-col gap-2 text-sm">
            <input name="course_name" required placeholder="講義名（必須）" className="rounded border px-2 py-1" />
            <input name="course_code" placeholder="講義コード（例: CS-302）" className="rounded border px-2 py-1" />
            <input name="professor" placeholder="担当教員" className="rounded border px-2 py-1" />
            <input name="room" placeholder="教室" className="rounded border px-2 py-1" />
            <div className="flex gap-2">
              <select name="day_of_week" className="rounded border px-2 py-1">
                <option value="">曜日</option>
                {DAY_LABELS.map((label, i) => (
                  <option key={i} value={i}>{label}曜</option>
                ))}
              </select>
              <select name="period" className="rounded border px-2 py-1">
                <option value="">時限</option>
                {PERIOD_OPTIONS.map((p) => (
                  <option key={p} value={p}>{p}限</option>
                ))}
              </select>
            </div>
            <button className="w-32 rounded bg-black px-3 py-1 text-white dark:bg-white dark:text-black">
              作成
            </button>
          </form>
        </section>

        <section>
          <h2 className="font-semibold">棚一覧（{shelves.length}）</h2>
          <ul className="mt-2 flex flex-col gap-2">
            {shelves.map((s) => (
              <li key={s.id} className="rounded border p-3 text-sm">
                <div className="flex items-center gap-2">
                  <span
                    className="inline-block h-4 w-4 rounded"
                    style={{ background: s.color }}
                  />
                  <b>{s.course_name}</b>
                  <span className="text-xs text-zinc-500">{s.course_code ?? "コードなし"}</span>
                </div>
                <p className="text-xs text-zinc-500">
                  {formatSchedule(s.day_of_week, s.period)} ・ {s.professor ?? "教員未設定"} ・{" "}
                  {s.room ?? "教室未設定"}
                </p>
                <p className="text-xs text-zinc-500">
                  資料 {s.materialCount} ・ 問題集 {s.questionSetCount} ・ 共有 {s.sharedGroupIds.length} グループ
                </p>
                <button
                  onClick={() => onDeleteShelf(s.id)}
                  className="mt-1 rounded border px-2 py-0.5 text-xs"
                >
                  削除
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="font-semibold">グループを作成（owner トリガー検証）</h2>
          <form onSubmit={onCreateGroup} className="mt-2 flex gap-2 text-sm">
            <input name="name" required placeholder="グループ名" className="flex-1 rounded border px-2 py-1" />
            <button className="rounded bg-black px-3 py-1 text-white dark:bg-white dark:text-black">
              作成
            </button>
          </form>
          <form onSubmit={onJoin} className="mt-2 flex gap-2 text-sm">
            <input name="code" required placeholder="招待コード（TANE-XXXX）" className="flex-1 rounded border px-2 py-1" />
            <button className="rounded border px-3 py-1">参加</button>
          </form>
        </section>

        <section>
          <h2 className="font-semibold">所属グループ（{groups.length}）</h2>
          <ul className="mt-2 flex flex-col gap-2">
            {groups.map((g) => (
              <li key={g.id} className="rounded border p-3 text-sm">
                <b>{g.name}</b>{" "}
                <code className="text-xs">{g.invite_code}</code>
                <p className="text-xs text-zinc-500">
                  {(members[g.id] ?? [])
                    .map((m) => `${m.display_name}(${m.role})`)
                    .join(", ") || "メンバー取得中…"}
                </p>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div>
        <div className="sticky top-8">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">ログ</h2>
            <button onClick={() => setLog("")} className="rounded border px-2 py-1 text-xs">
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

function numOrNull(v: FormDataEntryValue | null): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}
