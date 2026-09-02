import type { QuestionSet } from "@/lib/gemini/schema";

/**
 * `supabase gen types typescript` の生成物に差し替える暫定の型。
 * `question_sets.content` は `QuestionSet`（`lib/gemini/schema.ts`）をそのまま使う。
 *
 * `Relationships: []` と `public.Views` は、`@supabase/postgrest-js` の
 * `GenericTable` / `GenericSchema` 制約
 * （`node_modules/@supabase/postgrest-js/src/types/common/common.ts`）を満たすために必要。
 * 無いと `.from(...)` の型推論が `never` に落ちる。
 * `public.Functions` は `supabase.rpc(...)` の型付けのため実定義している。
 */
export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          display_name: string;
          avatar_url: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          display_name: string;
          avatar_url?: string | null;
        };
        Update: Partial<{
          display_name: string;
          avatar_url: string | null;
        }>;
        Relationships: [];
      };
      shelves: {
        Row: {
          id: string;
          owner_id: string;
          course_name: string;
          year: number | null;
          term: string | null;
          day_of_week: number | null;
          period: number | null;
          course_code: string | null;
          professor: string | null;
          room: string | null;
          color: string;
          created_at: string;
        };
        Insert: {
          owner_id: string;
          course_name: string;
          year?: number | null;
          term?: string | null;
          day_of_week?: number | null;
          period?: number | null;
          course_code?: string | null;
          professor?: string | null;
          room?: string | null;
          color?: string;
        };
        Update: Partial<{
          course_name: string;
          year: number | null;
          term: string | null;
          day_of_week: number | null;
          period: number | null;
          course_code: string | null;
          professor: string | null;
          room: string | null;
          color: string;
        }>;
        Relationships: [];
      };
      materials: {
        Row: {
          id: string;
          shelf_id: string;
          owner_id: string;
          storage_path: string;
          file_name: string;
          mime_type: string;
          size_bytes: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          shelf_id: string;
          owner_id: string;
          storage_path: string;
          file_name: string;
          mime_type: string;
          size_bytes: number;
        };
        Update: Partial<{
          file_name: string;
        }>;
        Relationships: [];
      };
      question_sets: {
        Row: {
          id: string;
          shelf_id: string;
          owner_id: string;
          source_material_id: string | null;
          title: string;
          content: QuestionSet;
          created_at: string;
        };
        Insert: {
          shelf_id: string;
          owner_id: string;
          source_material_id?: string | null;
          title: string;
          content: QuestionSet;
        };
        Update: Partial<{
          title: string;
          content: QuestionSet;
        }>;
        Relationships: [];
      };
      groups: {
        Row: {
          id: string;
          name: string;
          invite_code: string;
          created_by: string;
          created_at: string;
        };
        Insert: {
          name: string;
          invite_code: string;
          created_by: string;
        };
        Update: Partial<{
          name: string;
        }>;
        Relationships: [];
      };
      group_members: {
        Row: {
          group_id: string;
          user_id: string;
          role: "owner" | "member";
          created_at: string;
        };
        Insert: {
          group_id: string;
          user_id: string;
          role?: "owner" | "member";
        };
        Update: never;
        Relationships: [];
      };
      shelf_shares: {
        Row: {
          id: string;
          shelf_id: string;
          group_id: string;
          visible: boolean;
          created_at: string;
        };
        Insert: {
          shelf_id: string;
          group_id: string;
          visible?: boolean;
        };
        Update: Partial<{
          visible: boolean;
        }>;
        Relationships: [];
      };
      question_set_shares: {
        Row: {
          id: string;
          question_set_id: string;
          group_id: string;
          created_at: string;
        };
        Insert: {
          question_set_id: string;
          group_id: string;
        };
        Update: never;
        Relationships: [];
      };
      study_sessions: {
        Row: {
          id: string;
          group_id: string;
          created_by: string;
          title: string;
          location: string | null;
          starts_at: string;
          ends_at: string;
          created_at: string;
        };
        Insert: {
          group_id: string;
          created_by: string;
          title: string;
          location?: string | null;
          starts_at: string;
          ends_at: string;
        };
        Update: Partial<{
          title: string;
          location: string | null;
          starts_at: string;
          ends_at: string;
        }>;
        Relationships: [];
      };
      assignments: {
        Row: {
          id: string;
          shelf_id: string;
          group_id: string | null;
          created_by: string;
          title: string;
          due_at: string;
          created_at: string;
        };
        Insert: {
          shelf_id: string;
          group_id?: string | null;
          created_by: string;
          title: string;
          due_at: string;
        };
        Update: Partial<{
          title: string;
          due_at: string;
        }>;
        Relationships: [];
      };
      assignment_reports: {
        Row: {
          id: string;
          assignment_id: string;
          user_id: string;
          minutes_spent: number;
          comment: string | null;
          created_at: string;
        };
        Insert: {
          assignment_id: string;
          user_id: string;
          minutes_spent: number;
          comment?: string | null;
        };
        Update: Partial<{
          minutes_spent: number;
          comment: string | null;
        }>;
        Relationships: [];
      };
      google_credentials: {
        Row: {
          user_id: string;
          refresh_token: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          refresh_token: string;
        };
        Update: Partial<{
          refresh_token: string;
        }>;
        Relationships: [];
      };
      calendar_events: {
        Row: {
          id: string;
          study_session_id: string;
          user_id: string;
          google_event_id: string;
          created_at: string;
        };
        Insert: {
          study_session_id: string;
          user_id: string;
          google_event_id: string;
        };
        Update: never;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      is_group_member: {
        Args: { gid: string };
        Returns: boolean;
      };
      join_group_by_code: {
        Args: { code: string };
        Returns: string;
      };
      is_shelf_shared: {
        Args: { sid: string };
        Returns: boolean;
      };
    };
  };
}
