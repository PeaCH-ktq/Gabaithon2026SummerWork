import type { Database } from "@/lib/supabase/types";

export type View = "home" | "course" | "quiz" | "tasks" | "group" | "account" | "profile-edit" | "logout";
export type Navigate = (view: View) => void;
export type Notify = (message: string) => void;

export type Assignment = {
  title: string;
  course: string;
  date: string;
  left: string;
  color: string;
};

export type Profile = {
  displayName: string;
  faculty: string;
  department: string;
  email: string;
};

/** `shelves` テーブルの行そのもの。 */
export type ShelfRow = Database["public"]["Tables"]["shelves"]["Row"];

/**
 * 一覧表示用の棚。件数と共有先はクエリ側（`lib/data/shelves.ts`）で組み立てる。
 */
export type Shelf = ShelfRow & {
  materialCount: number;
  questionSetCount: number;
  sharedGroupIds: string[];
};

/** `materials` テーブルの行そのもの。 */
export type MaterialRow = Database["public"]["Tables"]["materials"]["Row"];

/** `question_sets` テーブルの行そのもの。`content` は `QuestionSet`。 */
export type QuestionSetRow = Database["public"]["Tables"]["question_sets"]["Row"];

/** 棚の作成・編集モーダルが親へ渡す値。`owner_id` / `color` は親が補う。 */
export type ShelfFormValues = {
  course_name: string;
  course_code: string | null;
  professor: string | null;
  room: string | null;
  day_of_week: number | null;
  period: number | null;
};

/** 棚一覧の読み込み状態（空・ローディング・エラーの3状態）。 */
export type LoadState = "loading" | "error" | "ready";

/** @deprecated デモデータ（GroupView / QuizView / TasksView）専用の旧型。棚は `Shelf` を使う。 */
export type Course = {
  code: string;
  name: string;
  professor: string;
  schedule: string;
  room: string;
  docs: number;
  quizzes: number;
  tab: string;
  shared: boolean;
};
