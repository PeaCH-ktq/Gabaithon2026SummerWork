"use client";

import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { getQuestionSet } from "@/lib/data/questionSets";
import type { Navigate, Notify } from "../../types";
import { Button } from "../ui";
import { QuestionPaper } from "@/components/QuestionPaper";
import type { QuestionSet } from "@/lib/gemini/schema";

type Props = {
  supabase: SupabaseClient<Database>;
  navigate: Navigate;
  notify: Notify;
  questionSetId: string | null;
  shelfName?: string;
  backToCourse: () => void;
};

export function QuizView({ supabase, navigate, notify, questionSetId, shelfName, backToCourse }: Props) {
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
          ← {shelfName ?? "講義の棚"}
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
