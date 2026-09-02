"use client";
import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { listGroupMembers, leaveGroup } from "@/lib/data/groups";
import { setShelfVisible } from "@/lib/data/shares";
import type { GroupMember, GroupRow, LoadState, Notify, Shelf } from "../../types";
import { Button, Icon } from "../ui";

type Props = {
  supabase: SupabaseClient<Database>;
  group: GroupRow | null;
  groupsState: LoadState;
  userId: string | null;
  shelves: Shelf[];
  openCourse: (shelfId: string) => void;
  notify: Notify;
  openSchedule: () => void;
  openGroupModal: () => void;
  onLeft: () => void;
  onSharesChanged: () => void;
};

export function GroupView({ supabase, group, groupsState, userId, shelves, openCourse, notify, openSchedule, openGroupModal, onLeft, onSharesChanged }: Props) {
  const [inviteOpen, setInviteOpen] = useState(false);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [membersState, setMembersState] = useState<LoadState>("loading");
  const [leaving, setLeaving] = useState(false);
  const [togglingShelfId, setTogglingShelfId] = useState<string | null>(null);

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
          {[
            {
              date: "8月30日（日）",
              time: "14:00 – 18:00",
              title: "データベース論 中間対策",
              place: "中央図書館 グループ学習室B",
              people: "5人",
            },
            {
              date: "9月2日（水）",
              time: "10:00 – 12:00",
              title: "OS 演習もくもく会",
              place: "情報棟3F ラウンジ",
              people: "3人",
            },
          ].map((m, i) => (
            <article className="meeting" key={m.title}>
              <div className="meeting-date">
                <strong>{m.date}</strong>
                <span>{m.time}</span>
              </div>
              <div className="meeting-info">
                <h3>{m.title}</h3>
                <p>
                  {m.place} ・ 参加 {m.people}
                </p>
              </div>
              <Button primary={i === 0} icon="calendar" onClick={() => notify("カレンダー連携はバックエンド接続後に利用できます")}>カレンダーへ</Button>
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
