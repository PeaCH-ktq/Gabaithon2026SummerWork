import type { Database } from "@/lib/supabase/types";

export type View = "home" | "course" | "quiz" | "tasks" | "group" | "account";
export type Navigate = (view: View) => void;
export type Notify = (message: string) => void;

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

/** @deprecated タスク3で `Shelf` に置換して削除する。デモデータ用の旧型。 */
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
