import { deadlines } from "../../demo-data";
import type { Notify } from "../../types";
import { Button, Icon } from "../ui";

type Props = { notify: Notify };

export function TasksView({ notify }: Props) {
  return (
    <>
      <header className="page-head">
        <div>
          <p className="eyebrow">DEADLINES</p>
          <h1>課題を、ひとつずつ。</h1>
          <p>かかった時間を記録すると、グループのみんなの目安になります。</p>
        </div>
        <Button
          primary
          icon="plus"
          onClick={() => notify("課題の追加画面を開きました（デモ）")}
        >
          課題を追加
        </Button>
      </header>
      <div className="task-board">
        <section>
          <h2>
            これから <span>3</span>
          </h2>
          {deadlines.map((item, i) => (
            <article className="task-card" key={item.title}>
              <div className={`task-check ${i === 0 ? "urgent" : ""}`} />
              <div>
                <span className="task-course">{item.course}</span>
                <h3>{item.title}</h3>
                <p>
                  <Icon name="calendar" size={14} />
                  {item.date}
                </p>
              </div>
              <span className={`due-tag ${i === 0 ? "urgent" : ""}`}>
                {item.left}
              </span>
              <Button
                subtle
                icon="clock"
                onClick={() => notify("タイマーを開始しました")}
              >
                時間を記録
              </Button>
            </article>
          ))}
        </section>
        <section>
          <h2>
            終わった課題 <span>2</span>
          </h2>
          {["SQL演習課題 第2回", "プロセススケジューリング演習"].map((t, i) => (
            <article className="task-card done" key={t}>
              <div className="task-check">
                <Icon name="check" size={15} />
              </div>
              <div>
                <span className="task-course">
                  {i ? "オペレーティングシステム" : "データベース論"}
                </span>
                <h3>{t}</h3>
                <p>かかった時間 {i ? "1時間45分" : "3時間20分"}</p>
              </div>
              <span className="complete-tag">完了</span>
            </article>
          ))}
        </section>
      </div>
    </>
  );
}
