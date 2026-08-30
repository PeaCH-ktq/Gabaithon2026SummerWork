import { questions } from "../../demo-data";
import type { Navigate, Notify } from "../../types";
import { Button } from "../ui";

type Props = { navigate: Navigate; notify: Notify };

export function QuizView({ navigate, notify }: Props) {
  return (
    <>
      <div className="quiz-toolbar">
        <button className="back-link" onClick={() => navigate("course")}>
          ← データベース論
        </button>
        <div>
          <Button icon="share" onClick={() => notify("グループに共有しました")}>
            共有
          </Button>
          <Button primary icon="file" onClick={() => window.print()}>
            印刷 / PDF保存
          </Button>
        </div>
      </div>
      <article className="quiz-sheet">
        <header>
          <div>
            <span>CS-302 ・ DATABASE</span>
            <h1>データベース論　確認テスト</h1>
            <p>第1回〜第4回 ／ 選択・記述 混合 ／ 全10問</p>
          </div>
          <span className="name-line">氏名</span>
        </header>
        {questions.map((q, i) => (
          <section className="question" key={q.text}>
            <div className="question-label">
              <span>QUESTION {String(i + 1).padStart(2, "0")}</span>
              <em>{q.type}</em>
            </div>
            <h2>{q.text}</h2>
            {q.options ? (
              <ol>
                {q.options.map((o, j) => (
                  <li key={o}>
                    <span>{String.fromCharCode(65 + j)}</span>
                    {o}
                  </li>
                ))}
              </ol>
            ) : (
              <div className="answer-lines">
                <i />
                <i />
              </div>
            )}
          </section>
        ))}
      </article>
    </>
  );
}
