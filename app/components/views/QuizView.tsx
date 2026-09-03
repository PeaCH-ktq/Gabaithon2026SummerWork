"use client";

import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { getQuestionSet } from "@/lib/data/questionSets";
import type { Navigate, Shelf } from "../../types";
import { Button } from "../ui";
import { QuestionPaper } from "@/components/QuestionPaper";
import { MathText } from "@/components/MathText";
import type { QuestionSet } from "@/lib/gemini/schema";

type Props = {
  supabase: SupabaseClient<Database>;
  navigate: Navigate;
  questionSetId: string | null;
  shelf: Shelf | null;
  isOwner: boolean;
  openShare: () => void;
  backToCourse: () => void;
};

export function QuizView({ supabase, navigate, questionSetId, shelf, isOwner, openShare, backToCourse }: Props) {
  const [questionSet, setQuestionSet] = useState<QuestionSet | null>(null);
  const [loadState, setLoadState] = useState<"loading" | "error" | "ready">("loading");
  const state = questionSetId ? loadState : "error";

  useEffect(() => {
    if (!questionSetId) return;
    let active = true;
    void getQuestionSet(supabase, questionSetId)
      .then((row) => {
        if (active) {
          setQuestionSet(row.content);
          setLoadState("ready");
        }
      })
      .catch((err) => {
        console.error(err);
        if (active) setLoadState("error");
      });
    return () => {
      active = false;
      setLoadState("loading");
    };
  }, [supabase, questionSetId]);

  return (
    <>
      <div className="quiz-toolbar">
        <button className="back-link" onClick={backToCourse}>
          ← {shelf?.course_name ?? "講義の棚"}
        </button>
        <div>
          {isOwner && (
            <Button icon="share" onClick={openShare}>
              {shelf && shelf.shares.length > 0 ? "共有設定" : "共有"}
            </Button>
          )}
          <Button primary icon="file" onClick={() => window.print()}>
            印刷 / PDF保存
          </Button>
        </div>
      </div>
      {state === "loading" && <p className="muted">問題集を読み込んでいます…</p>}
      {state === "error" && (
        <p className="muted">
          問題集を表示できません。
          <button className="text-link" onClick={() => navigate("course")}>講義の棚へ戻る</button>
        </p>
      )}
      {state === "ready" && questionSet && (
        <>
          <QuestionPaper questionSet={questionSet} />
          <AnswerKey questionSet={questionSet} />
        </>
      )}
    </>
  );
}

/**
 * 解答・解説。問題用紙とは分けて画面下に置き、印刷（＝問題用紙）には含めない。
 * `QuestionPaper` が意図的に解答を載せないぶんをここで補う。
 */
function AnswerKey({ questionSet }: { questionSet: QuestionSet }) {
  const hasAny = questionSet.questions.some((q) => q.answer || q.explanation);
  if (!hasAny) return null;

  return (
    <section className="answer-key">
      <h2>解答・解説</h2>
      <ol>
        {questionSet.questions.map((q, i) => (
          <li key={i}>
            <b>問 {i + 1}.</b>
            {q.answer && (
              <p>
                <span className="answer-key-tag">解答</span>
                <MathText text={q.answer} />
              </p>
            )}
            {q.explanation && (
              <p className="answer-key-explanation">
                <span className="answer-key-tag">解説</span>
                <MathText text={q.explanation} />
              </p>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
