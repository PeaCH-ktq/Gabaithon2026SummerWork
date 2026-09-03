import type { Database } from "@/lib/supabase/types";

export type View = "home" | "course" | "quiz" | "tasks" | "group" | "account" | "profile-edit";
export type Navigate = (view: View) => void;
export type Notify = (message: string) => void;

export type Assignment = {
  title: string;
  course: string;
  date: string;
  left: string;
  color: string;
};

/** `profiles` テーブルの行そのもの。 */
export type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

/** アカウント画面向けの自分のプロフィール（`profiles` ＋ `auth.users.email`）。 */
export type AccountProfile = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  email: string;
};

/** `shelves` テーブルの行そのもの。 */
export type ShelfRow = Database["public"]["Tables"]["shelves"]["Row"];

/** 棚の共有先グループ 1 件（`shelf_shares` から）。 */
export type ShelfShare = { group_id: string; visible: boolean };

/**
 * 一覧表示用の棚。件数と共有先はクエリ側（`lib/data/shelves.ts`）で組み立てる。
 */
export type Shelf = ShelfRow & {
  materialCount: number;
  miscCount: number;
  questionSetCount: number;
  shares: ShelfShare[];
  /** @deprecated `shares.map(s => s.group_id)` を使う。 */
  sharedGroupIds: string[];
};

/** `materials` テーブルの行そのもの。 */
export type MaterialRow = Database["public"]["Tables"]["materials"]["Row"];

/** `question_sets` テーブルの行そのもの。`content` は `QuestionSet`。 */
export type QuestionSetRow = Database["public"]["Tables"]["question_sets"]["Row"];

/** `groups` テーブルの行そのもの。 */
export type GroupRow = Database["public"]["Tables"]["groups"]["Row"];

/** グループメンバー1件（`group_members` ＋ `profiles` の表示名）。 */
export type GroupMember = Database["public"]["Tables"]["group_members"]["Row"] & {
  display_name: string;
  avatar_url: string | null;
};

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

/** `study_sessions` テーブルの行そのもの。 */
export type StudySessionRow = Database["public"]["Tables"]["study_sessions"]["Row"];

/** 勉強会の作成モーダルが親へ渡す値。`group_id` / `created_by` は親が補う。 */
export type StudySessionFormValues = {
  title: string;
  location: string | null;
  starts_at: string;
  ends_at: string;
};
