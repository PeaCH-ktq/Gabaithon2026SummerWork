import type { QuestionSet } from "@/lib/gemini/schema";

/**
 * `supabase gen types typescript` の生成物に差し替える暫定の型。
 * `question_sets.content` は `QuestionSet`（`lib/gemini/schema.ts`）をそのまま使う。
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
          created_at: string;
        };
        Insert: {
          owner_id: string;
          course_name: string;
          year?: number | null;
          term?: string | null;
          day_of_week?: number | null;
          period?: number | null;
        };
        Update: Partial<{
          course_name: string;
          year: number | null;
          term: string | null;
          day_of_week: number | null;
          period: number | null;
        }>;
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
      };
    };
  };
}
