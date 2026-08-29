import type { QuestionSet } from "@/lib/gemini/schema";
import { Figure } from "./Figure";
import { MathText } from "./MathText";

/**
 * 問題セットを A4（コピー用紙）比率の問題用紙として描画する。
 *
 * - 画面上は影付きカード。`@media print` で単独ページとして印刷される（`app/globals.css`）。
 * - 解答・解説は載せない（別セクションで表示する）。
 */
export function QuestionPaper({ questionSet }: { questionSet: QuestionSet }) {
  return (
    <div className="question-paper mx-auto bg-white text-black shadow-lg">
      <div className="flex h-full flex-col gap-6 p-[18mm] print:p-0">
        <header className="border-b-2 border-black pb-3">
          <h1 className="text-center text-xl font-bold">{questionSet.title}</h1>
          <div className="mt-3 flex justify-end gap-8 text-sm">
            <span>学籍番号 ______________</span>
            <span>氏名 ______________</span>
          </div>
        </header>

        <ol className="flex flex-1 flex-col gap-8">
          {questionSet.questions.map((q, i) => (
            <li key={i} className="flex flex-col gap-3 break-inside-avoid">
              <div className="flex gap-2 text-[15px] leading-relaxed">
                <span className="font-bold whitespace-nowrap">問 {i + 1}.</span>
                <MathText text={q.prompt} className="flex-1" />
              </div>
              {q.figure && <Figure figure={q.figure} index={i + 1} />}
              <div
                className="border-b border-dashed border-zinc-300"
                style={{ minHeight: "24mm" }}
                aria-hidden
              />
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
