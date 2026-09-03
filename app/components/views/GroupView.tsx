"use client";
import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { listGroupMembers, leaveGroup } from "@/lib/data/groups";
import { setShelfVisible } from "@/lib/data/shares";
import { deleteStudySession } from "@/lib/data/studySessions";
import { needsReauth, summarizeSync, syncSessionToCalendar, unsyncSessionFromCalendar } from "@/lib/api/calendar";
import { signInWithGoogle } from "@/lib/supabase/auth";
import { formatSessionDate, formatSessionRange } from "@/lib/format/datetime";
import type { GroupMember, GroupRow, LoadState, Notify, Shelf, StudySessionRow } from "../../types";
import { Button, Icon } from "../ui";

type Props = {
  supabase: SupabaseClient<Database>;
  group: GroupRow | null;
  groupsState: LoadState;
  userId: string | null;
  shelves: Shelf[];
  sessions: StudySessionRow[];
  sessionsState: LoadState;
  openCourse: (shelfId: string) => void;
  notify: Notify;
  openSchedule: () => void;
  openGroupModal: () => void;
  onLeft: () => void;
  onSharesChanged: () => void;
  onSessionsChanged: () => void;
};

export function GroupView({ supabase, group, groupsState, userId, shelves, sessions, sessionsState, openCourse, notify, openSchedule, openGroupModal, onLeft, onSharesChanged, onSessionsChanged }: Props) {
  const [inviteOpen, setInviteOpen] = useState(false);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [membersState, setMembersState] = useState<LoadState>("loading");
  const [leaving, setLeaving] = useState(false);
  const [togglingShelfId, setTogglingShelfId] = useState<string | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [cancelingId, setCancelingId] = useState<string | null>(null);
  const [reauthNeeded, setReauthNeeded] = useState(false);

  useEffect(() => {
    if (!group) return;
    let active = true;
    void (async () => {
      await Promise.resolve();
      if (!active) return;
      setMembersState("loading");
      try {
        const rows = await listGroupMembers(supabase, group.id);
        if (active) { setMembers(rows); setMembersState("ready"); }
      } catch (err) {
        console.error(err);
        if (active) setMembersState("error");
      }
    })();
    return () => { active = false; };
  }, [supabase, group]);

  if (!group) {
    if (groupsState === "loading") {
      return <p className="muted">グループを読み込んでいます…</p>;
    }
    return (
      <div className="empty-state">
        <b>グループに参加していません</b>
        <p>
          グループを作成するか、招待コードで参加してください。
          <button className="text-link" onClick={openGroupModal}>グループを作成 / 参加する</button>
        </p>
      </div>
    );
  }

  const sharedShelves = shelves.filter((shelf) => shelf.shares.some((s) => s.group_id === group.id));

  async function toggleVisible(shelf: Shelf, visible: boolean) {
    setTogglingShelfId(shelf.id);
    try {
      await setShelfVisible(supabase, shelf.id, group!.id, visible);
      onSharesChanged();
    } catch (err) {
      notify(err instanceof Error ? err.message : "表示設定の更新に失敗しました");
    } finally {
      setTogglingShelfId(null);
    }
  }

  async function handleLeave() {
    if (leaving) return;
    setLeaving(true);
    try {
      await leaveGroup(supabase, group!.id);
      notify("グループを抜けました");
      onLeft();
    } catch (err) {
      notify(err instanceof Error ? err.message : "グループの脱退に失敗しました");
    } finally {
      setLeaving(false);
    }
  }

  async function handleSync(session: StudySessionRow) {
    setSyncingId(session.id);
    try {
      const result = await syncSessionToCalendar(session.id);
      if (needsReauth(result, userId)) setReauthNeeded(true);
      notify(summarizeSync(result));
    } catch (err) {
      notify(err instanceof Error ? err.message : "カレンダー連携に失敗しました");
    } finally {
      setSyncingId(null);
    }
  }

  async function handleCancel(session: StudySessionRow) {
    if (!window.confirm(`「${session.title}」を取り消します。参加者のカレンダーからも削除されます。`)) return;
    setCancelingId(session.id);
    try {
      await unsyncSessionFromCalendar(session.id);
      await deleteStudySession(supabase, session.id);
      notify("勉強会を取り消しました");
      onSessionsChanged();
    } catch (err) {
      notify(err instanceof Error ? err.message : "勉強会の取り消しに失敗しました");
    } finally {
      setCancelingId(null);
    }
  }

  return (
    <>
      <header className="group-hero">
        <div className="avatar-stack">
          {members.slice(0, 4).map((m) => (
            <span key={m.user_id}>{m.display_name.charAt(0) || "?"}</span>
          ))}
          {members.length > 4 && <span>+{members.length - 4}</span>}
        </div>
        <p className="eyebrow">STUDY GROUP ・ {membersState === "ready" ? `${members.length} MEMBERS` : "…"}</p>
        <h1>{group.name}</h1>
        <Button icon="share" onClick={() => setInviteOpen((value) => !value)}>
          招待する
        </Button>
        <Button subtle onClick={() => void handleLeave()} disabled={leaving}>
          {leaving ? "脱退中…" : "グループを抜ける"}
        </Button>
      </header>
      {inviteOpen && (
        <section className="content-card invite-panel">
          <div>
            <p className="eyebrow">INVITE CODE</p>
            <h2>{group.invite_code}</h2>
            <p>このコードを友だちに共有してください。</p>
          </div>
          <Button
            primary
            onClick={() => {
              void navigator.clipboard?.writeText(group.invite_code);
              notify("招待コードをコピーしました");
            }}
          >
            コードをコピー
          </Button>
        </section>
      )}
      <div className="group-grid">
        <section className="content-card meetings">
          <div className="card-head">
            <div>
              <p className="eyebrow">NEXT SESSIONS</p>
              <h2>つぎの勉強会</h2>
            </div>
            <Button primary icon="plus" onClick={() => openSchedule()}>
              予定を決める
            </Button>
          </div>
          {sessionsState === "loading" && <p className="muted">読み込んでいます…</p>}
          {sessionsState === "error" && <p className="muted">勉強会の取得に失敗しました</p>}
          {sessionsState === "ready" && sessions.length === 0 && (
            <div className="empty-state"><b>予定はまだありません</b><p>「予定を決める」から勉強会をつくりましょう。</p></div>
          )}
          {reauthNeeded && (
            <p className="muted">
              <button className="text-link" onClick={() => void signInWithGoogle()}>Google を再連携する</button>
            </p>
          )}
          {sessions.map((s, i) => (
            <article className="meeting" key={s.id}>
              <div className="meeting-date">
                <strong>{formatSessionDate(s.starts_at)}</strong>
                <span>{formatSessionRange(s.starts_at, s.ends_at)}</span>
              </div>
              <div className="meeting-info">
                <h3>{s.title}</h3>
                <p>{s.location ?? "場所未定"}</p>
              </div>
              <Button
                primary={i === 0}
                icon="calendar"
                disabled={syncingId === s.id}
                onClick={() => void handleSync(s)}
              >
                {syncingId === s.id ? "連携中…" : "カレンダーへ"}
              </Button>
              {s.created_by === userId && (
                <button
                  className="text-link"
                  disabled={cancelingId === s.id}
                  onClick={() => void handleCancel(s)}
                >
                  {cancelingId === s.id ? "取り消し中…" : "キャンセル"}
                </button>
              )}
            </article>
          ))}
        </section>
        <aside className="content-card shared-card">
          <p className="eyebrow">SHARED LIBRARY</p>
          <h2>共有中の棚</h2>
          <div className="copyright-note">
            講義資料そのものは共有されません。過去問などを共有する前に、再配布が許可されているか確認してください。
          </div>
          {sharedShelves.length === 0 && (
            <div className="empty-state"><b>共有されている棚はまだありません</b><p>講義の棚から「グループに共有」を選んでください。</p></div>
          )}
          {sharedShelves.map((shelf) => {
            const share = shelf.shares.find((s) => s.group_id === group.id)!;
            const isOwner = shelf.owner_id === userId;
            return (
              <div className={`shared-shelf ${!share.visible ? "is-hidden" : ""}`} key={shelf.id}>
                <span style={{ background: shelf.color }} />
                <div>
                  <b>{shelf.course_name}</b>
                  <small>
                    問題集 {shelf.questionSetCount} ・ {share.visible ? "共有中" : "非表示"}
                  </small>
                </div>
                <button aria-label={`${shelf.course_name}を開く`} onClick={() => openCourse(shelf.id)}>
                  <Icon name="arrow" />
                </button>
                {isOwner && (
                  <button
                    className="visibility-toggle"
                    disabled={togglingShelfId === shelf.id}
                    onClick={() => void toggleVisible(shelf, !share.visible)}
                  >
                    {share.visible ? "非表示" : "表示"}
                  </button>
                )}
              </div>
            );
          })}
        </aside>
        <section className="content-card activity">
          <p className="eyebrow">ACTIVITY</p>
          <h2>みんなの学習記録</h2>
          {[
            {
              who: "あかり",
              initial: "あ",
              color: "coral",
              task: "正規化レポート",
              time: "4時間10分",
              note: "第3正規形の具体例で時間がかかったので、先に例を決めてから書くのがおすすめ。",
            },
            {
              who: "けんた",
              initial: "け",
              color: "green",
              task: "デッドロック演習",
              time: "2時間30分",
              note: "第6回の資料スライド18を読むと進めやすかった。",
            },
          ].map((p) => (
            <article className="activity-row" key={p.who}>
              <span className={`avatar ${p.color}`}>{p.initial}</span>
              <div>
                <p>
                  <b>{p.who}</b>
                  <small>3時間前</small>
                </p>
                <h3>{p.task}</h3>
                <span className="spent">{p.time}</span>
                <p className="note">{p.note}</p>
              </div>
            </article>
          ))}
        </section>
      </div>
    </>
  );
}
