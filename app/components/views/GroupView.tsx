import { courses } from "../../demo-data";
import type { Navigate, Notify } from "../../types";
import { Button, Icon } from "../ui";

type Props = { navigate: Navigate; notify: Notify; openSchedule: () => void };

export function GroupView({ navigate, notify, openSchedule }: Props) {
  return (
    <>
      <header className="group-hero">
        <div className="avatar-stack">
          <span>ゆ</span>
          <span>あ</span>
          <span>け</span>
          <span>み</span>
          <span>+3</span>
        </div>
        <p className="eyebrow">STUDY GROUP ・ 7 MEMBERS</p>
        <h1>情報工学3年</h1>
        <p>一緒なら、試験までの道のりも少し軽くなる。</p>
        <Button
          icon="share"
          onClick={() => notify("招待リンクをコピーしました")}
        >
          招待する
        </Button>
      </header>
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
              <Button
                primary={i === 0}
                icon="calendar"
                onClick={() =>
                  notify("Google カレンダー用の予定を書き出しました")
                }
              >
                カレンダーへ
              </Button>
            </article>
          ))}
        </section>
        <aside className="content-card shared-card">
          <p className="eyebrow">SHARED LIBRARY</p>
          <h2>共有中の棚</h2>
          <div className="copyright-note">
            講義資料そのものは共有されません。過去問などを共有する前に、再配布が許可されているか確認してください。
          </div>
          {courses.slice(0, 3).map((c) => (
            <button
              className="shared-shelf"
              key={c.code}
              onClick={() => navigate("course")}
            >
              <span style={{ background: c.tab }} />
              <div>
                <b>{c.name}</b>
                <small>
                  問題集 {c.quizzes} ・ {c.shared ? "共有中" : "非表示"}
                </small>
              </div>
              <Icon name="arrow" />
            </button>
          ))}
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
