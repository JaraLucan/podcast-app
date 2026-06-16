/**
 * Hand-authored to mirror the SQL in `supabase/migrations`. Once a live
 * Supabase project exists, regenerate with:
 *
 *   supabase gen types typescript --linked > src/lib/types/database.ts
 *
 * and keep this shape (Row / Insert / Update) so the rest of the app is stable.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

// ── Domain shapes stored inside jsonb columns ──────────────────────────────
export type TranscriptSegment = {
  start: number;
  end: number;
  speaker?: string;
  text: string;
};

export type KeyMoment = { ts_seconds: number; label: string };

export type BriefNumber = { label: string; value: string; context?: string };

export type QualityFlags = {
  passed: boolean;
  issues: string[];
  word_count?: number;
  quote_count?: number;
};

export type ShowCategory = "tech" | "finance" | "ai" | "crypto" | "business";
export type IngestSource = "taddy" | "rss" | "blocked";
export type TakedownStatus = "open" | "resolved";
export type EpisodeStatus =
  | "discovered"
  | "transcribing"
  | "summarizing"
  | "published"
  | "failed"
  | "skipped";
export type TranscriptSource = "taddy" | "groq" | "deepgram";
export type JobStatus = "pending" | "running" | "done" | "failed";
export type UserRole = "user" | "admin";

export type Database = {
  public: {
    Tables: {
      shows: {
        Row: {
          id: string;
          slug: string;
          title: string;
          publisher: string | null;
          rss_url: string | null;
          taddy_uuid: string | null;
          image_url: string | null;
          category: ShowCategory | null;
          description: string | null;
          website_url: string | null;
          is_active: boolean;
          ingest_source: IngestSource;
          dmca_hold: boolean;
          featured: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          title: string;
          publisher?: string | null;
          rss_url?: string | null;
          taddy_uuid?: string | null;
          image_url?: string | null;
          category?: ShowCategory | null;
          description?: string | null;
          website_url?: string | null;
          is_active?: boolean;
          ingest_source?: IngestSource;
          dmca_hold?: boolean;
          featured?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["shows"]["Insert"]>;
        Relationships: [];
      };
      episodes: {
        Row: {
          id: string;
          show_id: string;
          guid: string;
          slug: string | null;
          title: string;
          description: string | null;
          audio_url: string | null;
          published_at: string | null;
          duration_seconds: number | null;
          youtube_url: string | null;
          status: EpisodeStatus;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          show_id: string;
          guid: string;
          slug?: string | null;
          title: string;
          description?: string | null;
          audio_url?: string | null;
          published_at?: string | null;
          duration_seconds?: number | null;
          youtube_url?: string | null;
          status?: EpisodeStatus;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["episodes"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "episodes_show_id_fkey";
            columns: ["show_id"];
            referencedRelation: "shows";
            referencedColumns: ["id"];
          },
        ];
      };
      transcripts: {
        Row: {
          episode_id: string;
          source: TranscriptSource;
          segments: TranscriptSegment[] | null;
          full_text: string | null;
          word_count: number | null;
          cost_usd: number | null;
          created_at: string;
        };
        Insert: {
          episode_id: string;
          source: TranscriptSource;
          segments?: TranscriptSegment[] | null;
          full_text?: string | null;
          word_count?: number | null;
          cost_usd?: number | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["transcripts"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "transcripts_episode_id_fkey";
            columns: ["episode_id"];
            referencedRelation: "episodes";
            referencedColumns: ["id"];
          },
        ];
      };
      briefs: {
        Row: {
          id: string;
          episode_id: string;
          tldr: string | null;
          takeaways: string[] | null;
          key_moments: KeyMoment[] | null;
          numbers: BriefNumber[] | null;
          why_it_matters: string | null;
          model_used: string | null;
          tokens_in: number | null;
          tokens_out: number | null;
          cost_usd: number | null;
          quality_flags: QualityFlags | null;
          published_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          episode_id: string;
          tldr?: string | null;
          takeaways?: string[] | null;
          key_moments?: KeyMoment[] | null;
          numbers?: BriefNumber[] | null;
          why_it_matters?: string | null;
          model_used?: string | null;
          tokens_in?: number | null;
          tokens_out?: number | null;
          cost_usd?: number | null;
          quality_flags?: QualityFlags | null;
          published_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["briefs"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "briefs_episode_id_fkey";
            columns: ["episode_id"];
            referencedRelation: "episodes";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          user_id: string;
          display_name: string | null;
          onboarded: boolean;
          role: UserRole;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          display_name?: string | null;
          onboarded?: boolean;
          role?: UserRole;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
        Relationships: [];
      };
      follows: {
        Row: { user_id: string; show_id: string; created_at: string };
        Insert: { user_id: string; show_id: string; created_at?: string };
        Update: Partial<Database["public"]["Tables"]["follows"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "follows_show_id_fkey";
            columns: ["show_id"];
            referencedRelation: "shows";
            referencedColumns: ["id"];
          },
        ];
      };
      reads: {
        Row: { user_id: string; brief_id: string; read_at: string };
        Insert: { user_id: string; brief_id: string; read_at?: string };
        Update: Partial<Database["public"]["Tables"]["reads"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "reads_brief_id_fkey";
            columns: ["brief_id"];
            referencedRelation: "briefs";
            referencedColumns: ["id"];
          },
        ];
      };
      saves: {
        Row: {
          user_id: string;
          brief_id: string;
          note: string | null;
          created_at: string;
        };
        Insert: {
          user_id: string;
          brief_id: string;
          note?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["saves"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "saves_brief_id_fkey";
            columns: ["brief_id"];
            referencedRelation: "briefs";
            referencedColumns: ["id"];
          },
        ];
      };
      jobs: {
        Row: {
          id: number;
          type: string;
          payload: Json | null;
          status: JobStatus;
          attempts: number;
          run_after: string;
          locked_at: string | null;
          error: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: number;
          type: string;
          payload?: Json | null;
          status?: JobStatus;
          attempts?: number;
          run_after?: string;
          locked_at?: string | null;
          error?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["jobs"]["Insert"]>;
        Relationships: [];
      };
      takedown_requests: {
        Row: {
          id: string;
          show_id: string | null;
          email: string | null;
          reason: string | null;
          status: TakedownStatus;
          created_at: string;
          resolved_at: string | null;
        };
        Insert: {
          id?: string;
          show_id?: string | null;
          email?: string | null;
          reason?: string | null;
          status?: TakedownStatus;
          created_at?: string;
          resolved_at?: string | null;
        };
        Update: Partial<
          Database["public"]["Tables"]["takedown_requests"]["Insert"]
        >;
        Relationships: [
          {
            foreignKeyName: "takedown_requests_show_id_fkey";
            columns: ["show_id"];
            referencedRelation: "shows";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      daily_costs: {
        Row: {
          day: string;
          transcript_cost: number;
          brief_cost: number;
          total_cost: number;
          transcripts: number;
          briefs: number;
        };
        Relationships: [];
      };
    };
    Functions: {
      is_admin: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      claim_job: {
        Args: Record<string, never>;
        Returns: Database["public"]["Tables"]["jobs"]["Row"] | null;
      };
    };
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
};

// ── Convenience row aliases ────────────────────────────────────────────────
export type Show = Database["public"]["Tables"]["shows"]["Row"];
export type Episode = Database["public"]["Tables"]["episodes"]["Row"];
export type Transcript = Database["public"]["Tables"]["transcripts"]["Row"];
export type Brief = Database["public"]["Tables"]["briefs"]["Row"];
export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Job = Database["public"]["Tables"]["jobs"]["Row"];
export type TakedownRequest =
  Database["public"]["Tables"]["takedown_requests"]["Row"];
