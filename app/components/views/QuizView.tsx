"use client";

import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { getQuestionSet } from "@/lib/data/questionSets";
import type { Navigate, Shelf } from "../../types";
import { Button } from "../ui";
import { QuestionPaper } from "@/components/QuestionPaper";
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
      {state === "ready" && questionSet && <QuestionPaper questionSet={questionSet} />}
    </>
  );
}
