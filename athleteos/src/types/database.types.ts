export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      alerts: {
        Row: {
          athlete_id: number | null
          club_id: number | null
          created_at: string | null
          description: string | null
          id: number
          is_read: boolean | null
          severity: string | null
          title: string | null
          type: string | null
        }
        Insert: {
          athlete_id?: number | null
          club_id?: number | null
          created_at?: string | null
          description?: string | null
          id?: number
          is_read?: boolean | null
          severity?: string | null
          title?: string | null
          type?: string | null
        }
        Update: {
          athlete_id?: number | null
          club_id?: number | null
          created_at?: string | null
          description?: string | null
          id?: number
          is_read?: boolean | null
          severity?: string | null
          title?: string | null
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "alerts_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athletes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alerts_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      athlete_goals: {
        Row: {
          achieved: boolean | null
          achieved_at: string | null
          athlete_id: number
          club_id: number
          created_at: string | null
          deadline: string | null
          description: string | null
          discipline: string
          id: number
          target_value: string
        }
        Insert: {
          achieved?: boolean | null
          achieved_at?: string | null
          athlete_id: number
          club_id: number
          created_at?: string | null
          deadline?: string | null
          description?: string | null
          discipline: string
          id?: number
          target_value: string
        }
        Update: {
          achieved?: boolean | null
          achieved_at?: string | null
          athlete_id?: number
          club_id?: number
          created_at?: string | null
          deadline?: string | null
          description?: string | null
          discipline?: string
          id?: number
          target_value?: string
        }
        Relationships: [
          {
            foreignKeyName: "athlete_goals_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athletes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "athlete_goals_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      athlete_notifications: {
        Row: {
          athlete_id: number
          club_id: number
          created_at: string | null
          description: string | null
          id: number
          is_read: boolean | null
          title: string
          type: string
        }
        Insert: {
          athlete_id: number
          club_id: number
          created_at?: string | null
          description?: string | null
          id?: number
          is_read?: boolean | null
          title: string
          type: string
        }
        Update: {
          athlete_id?: number
          club_id?: number
          created_at?: string | null
          description?: string | null
          id?: number
          is_read?: boolean | null
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "athlete_notifications_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athletes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "athlete_notifications_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      athlete_performances: {
        Row: {
          athlete_id: number
          breakdown: Json | null
          club_id: number
          competition_id: number | null
          context: string | null
          created_at: string | null
          discipline: string
          discipline_type: string
          discipline_id: string | null
          id: number
          hurdle_height_m: number | null
          implement_weight_kg: number | null
          measurement_type: string | null
          metadata_version: string
          normalized_value: number | null
          official_status: string
          performance_date: string
          performance_direction: string | null
          quality_flags: string[]
          scoring_table_version: string | null
          source: string | null
          source_external_id: string | null
          timing_method: string
          unit: string | null
          value: string
          venue_type: string
          wind_mps: number | null
        }
        Insert: {
          athlete_id: number
          breakdown?: Json | null
          club_id: number
          competition_id?: number | null
          context?: string | null
          created_at?: string | null
          discipline: string
          discipline_type: string
          discipline_id?: string | null
          id?: number
          hurdle_height_m?: number | null
          implement_weight_kg?: number | null
          measurement_type?: string | null
          metadata_version?: string
          normalized_value?: number | null
          official_status?: string
          performance_date: string
          performance_direction?: string | null
          quality_flags?: string[]
          scoring_table_version?: string | null
          source?: string | null
          source_external_id?: string | null
          timing_method?: string
          unit?: string | null
          value: string
          venue_type?: string
          wind_mps?: number | null
        }
        Update: {
          athlete_id?: number
          breakdown?: Json | null
          club_id?: number
          competition_id?: number | null
          context?: string | null
          created_at?: string | null
          discipline?: string
          discipline_type?: string
          discipline_id?: string | null
          id?: number
          hurdle_height_m?: number | null
          implement_weight_kg?: number | null
          measurement_type?: string | null
          metadata_version?: string
          normalized_value?: number | null
          official_status?: string
          performance_date?: string
          performance_direction?: string | null
          quality_flags?: string[]
          scoring_table_version?: string | null
          source?: string | null
          source_external_id?: string | null
          timing_method?: string
          unit?: string | null
          value?: string
          venue_type?: string
          wind_mps?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "athlete_performances_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athletes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "athlete_performances_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "athlete_performances_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
        ]
      }
      athlete_wellness: {
        Row: {
          athlete_id: number
          club_id: number
          created_at: string | null
          date: string
          energy: number
          id: number
          mood: number
          notes: string | null
          sleep: number
          soreness: number
          stress: number
        }
        Insert: {
          athlete_id: number
          club_id: number
          created_at?: string | null
          date?: string
          energy: number
          id?: number
          mood: number
          notes?: string | null
          sleep: number
          soreness: number
          stress: number
        }
        Update: {
          athlete_id?: number
          club_id?: number
          created_at?: string | null
          date?: string
          energy?: number
          id?: number
          mood?: number
          notes?: string | null
          sleep?: number
          soreness?: number
          stress?: number
        }
        Relationships: [
          {
            foreignKeyName: "athlete_wellness_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athletes"
            referencedColumns: ["id"]
          },
        ]
      }
      athletes: {
        Row: {
          age: number | null
          club_id: number | null
          group_name: string | null
          id: number
          main_discipline: string | null
          name: string | null
          profile_data: Json | null
          user_id: number | null
        }
        Insert: {
          age?: number | null
          club_id?: number | null
          group_name?: string | null
          id?: number
          main_discipline?: string | null
          name?: string | null
          profile_data?: Json | null
          user_id?: number | null
        }
        Update: {
          age?: number | null
          club_id?: number | null
          group_name?: string | null
          id?: number
          main_discipline?: string | null
          name?: string | null
          profile_data?: Json | null
          user_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "athletes_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "athletes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      axis_model_versions: {
        Row: {
          axis_weights: Json
          created_at: string
          created_by: string | null
          is_active: boolean
          notes: string | null
          version: string
        }
        Insert: {
          axis_weights: Json
          created_at?: string
          created_by?: string | null
          is_active?: boolean
          notes?: string | null
          version: string
        }
        Update: {
          axis_weights?: Json
          created_at?: string
          created_by?: string | null
          is_active?: boolean
          notes?: string | null
          version?: string
        }
        Relationships: []
      }
      charge_model_versions: {
        Row: {
          created_at: string
          created_by: string | null
          is_active: boolean
          load_coefficients: Json
          notes: string | null
          recovery_hours: Json
          version: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          is_active?: boolean
          load_coefficients: Json
          notes?: string | null
          recovery_hours: Json
          version: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          is_active?: boolean
          load_coefficients?: Json
          notes?: string | null
          recovery_hours?: Json
          version?: string
        }
        Relationships: []
      }
      clubs: {
        Row: {
          accent_color: string
          cover_path: string | null
          id: number
          invite_code: string | null
          logo_path: string | null
          name: string
        }
        Insert: {
          accent_color?: string
          cover_path?: string | null
          id?: number
          invite_code?: string | null
          logo_path?: string | null
          name: string
        }
        Update: {
          accent_color?: string
          cover_path?: string | null
          id?: number
          invite_code?: string | null
          logo_path?: string | null
          name?: string
        }
        Relationships: []
      }
      competition_athletes: {
        Row: {
          athlete_id: number | null
          competition_id: number | null
          id: number
          planned_event: string | null
        }
        Insert: {
          athlete_id?: number | null
          competition_id?: number | null
          id?: number
          planned_event?: string | null
        }
        Update: {
          athlete_id?: number | null
          competition_id?: number | null
          id?: number
          planned_event?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "competition_athletes_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athletes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competition_athletes_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
        ]
      }
      competition_results: {
        Row: {
          athlete_id: number | null
          competition_id: number | null
          context: string | null
          event: string | null
          discipline_id: string | null
          hurdle_height_m: number | null
          id: number
          implement_weight_kg: number | null
          measurement_type: string | null
          metadata_version: string
          official_status: string
          performance_direction: string | null
          quality_flags: string[]
          result: string | null
          result_value: number | null
          scoring_table_version: string | null
          source: string | null
          source_external_id: string | null
          timing_method: string
          unit: string | null
          venue_type: string
          wind_mps: number | null
        }
        Insert: {
          athlete_id?: number | null
          competition_id?: number | null
          context?: string | null
          event?: string | null
          discipline_id?: string | null
          hurdle_height_m?: number | null
          id?: number
          implement_weight_kg?: number | null
          measurement_type?: string | null
          metadata_version?: string
          official_status?: string
          performance_direction?: string | null
          quality_flags?: string[]
          result?: string | null
          result_value?: number | null
          scoring_table_version?: string | null
          source?: string | null
          source_external_id?: string | null
          timing_method?: string
          unit?: string | null
          venue_type?: string
          wind_mps?: number | null
        }
        Update: {
          athlete_id?: number | null
          competition_id?: number | null
          context?: string | null
          event?: string | null
          discipline_id?: string | null
          hurdle_height_m?: number | null
          id?: number
          implement_weight_kg?: number | null
          measurement_type?: string | null
          metadata_version?: string
          official_status?: string
          performance_direction?: string | null
          quality_flags?: string[]
          result?: string | null
          result_value?: number | null
          scoring_table_version?: string | null
          source?: string | null
          source_external_id?: string | null
          timing_method?: string
          unit?: string | null
          venue_type?: string
          wind_mps?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "competition_results_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athletes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competition_results_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
        ]
      }
      competitions: {
        Row: {
          club_id: number | null
          date: string | null
          id: number
          location: string | null
          name: string | null
          type: string | null
        }
        Insert: {
          club_id?: number | null
          date?: string | null
          id?: number
          location?: string | null
          name?: string | null
          type?: string | null
        }
        Update: {
          club_id?: number | null
          date?: string | null
          id?: number
          location?: string | null
          name?: string | null
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "competitions_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      injuries: {
        Row: {
          athlete_id: number | null
          id: number
          intensity: number | null
          location: string | null
          name: string | null
          notes: string | null
          start_date: string | null
          status: string | null
        }
        Insert: {
          athlete_id?: number | null
          id?: number
          intensity?: number | null
          location?: string | null
          name?: string | null
          notes?: string | null
          start_date?: string | null
          status?: string | null
        }
        Update: {
          athlete_id?: number | null
          id?: number
          intensity?: number | null
          location?: string | null
          name?: string | null
          notes?: string | null
          start_date?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "injuries_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athletes"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string | null
          created_at: string | null
          id: number
          is_read: boolean | null
          receiver_id: number | null
          sender_id: number | null
        }
        Insert: {
          content?: string | null
          created_at?: string | null
          id?: number
          is_read?: boolean | null
          receiver_id?: number | null
          sender_id?: number | null
        }
        Update: {
          content?: string | null
          created_at?: string | null
          id?: number
          is_read?: boolean | null
          receiver_id?: number | null
          sender_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_receiver_id_fkey"
            columns: ["receiver_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      performance_history: {
        Row: {
          athlete_id: number | null
          id: number
          month: string | null
          value: number | null
        }
        Insert: {
          athlete_id?: number | null
          id?: number
          month?: string | null
          value?: number | null
        }
        Update: {
          athlete_id?: number | null
          id?: number
          month?: string | null
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "performance_history_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athletes"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          athlete_id: number | null
          auth: string | null
          club_id: number
          created_at: string | null
          endpoint: string
          id: number
          p256dh: string | null
          user_agent: string | null
          user_id: number | null
        }
        Insert: {
          athlete_id?: number | null
          auth?: string | null
          club_id: number
          created_at?: string | null
          endpoint: string
          id?: number
          p256dh?: string | null
          user_agent?: string | null
          user_id?: number | null
        }
        Update: {
          athlete_id?: number | null
          auth?: string | null
          club_id?: number
          created_at?: string | null
          endpoint?: string
          id?: number
          p256dh?: string | null
          user_agent?: string | null
          user_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athletes"
            referencedColumns: ["id"]
          },
        ]
      }
      records: {
        Row: {
          athlete_id: number | null
          discipline: string | null
          discipline_id: string | null
          id: number
          measurement_type: string | null
          metadata_version: string
          performance_direction: string | null
          pr: string | null
          pr_date: string | null
          pr_value: number | null
          sb: string | null
          sb_value: number | null
          unit: string | null
        }
        Insert: {
          athlete_id?: number | null
          discipline?: string | null
          discipline_id?: string | null
          id?: number
          measurement_type?: string | null
          metadata_version?: string
          performance_direction?: string | null
          pr?: string | null
          pr_date?: string | null
          pr_value?: number | null
          sb?: string | null
          sb_value?: number | null
          unit?: string | null
        }
        Update: {
          athlete_id?: number | null
          discipline?: string | null
          discipline_id?: string | null
          id?: number
          measurement_type?: string | null
          metadata_version?: string
          performance_direction?: string | null
          pr?: string | null
          pr_date?: string | null
          pr_value?: number | null
          sb?: string | null
          sb_value?: number | null
          unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "records_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athletes"
            referencedColumns: ["id"]
          },
        ]
      }
      athlete_daily_load_days: {
        Row: {
          athlete_id: number
          created_at: string
          load_date: string
          state: string
          updated_at: string
        }
        Insert: {
          athlete_id: number
          created_at?: string
          load_date: string
          state?: string
          updated_at?: string
        }
        Update: {
          athlete_id?: number
          created_at?: string
          load_date?: string
          state?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "athlete_daily_load_days_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athletes"
            referencedColumns: ["id"]
          },
        ]
      }
      session_athletes: {
        Row: {
          actual_duration_minutes: number | null
          athlete_id: number | null
          comment: string | null
          duration_source: string | null
          fatigue: number | null
          feeling: number | null
          id: number
          model_version: string | null
          rpe: number | null
          session_id: number | null
          status: string | null
        }
        Insert: {
          actual_duration_minutes?: number | null
          athlete_id?: number | null
          comment?: string | null
          duration_source?: string | null
          fatigue?: number | null
          feeling?: number | null
          id?: number
          model_version?: string | null
          rpe?: number | null
          session_id?: number | null
          status?: string | null
        }
        Update: {
          actual_duration_minutes?: number | null
          athlete_id?: number | null
          comment?: string | null
          duration_source?: string | null
          fatigue?: number | null
          feeling?: number | null
          id?: number
          model_version?: string | null
          rpe?: number | null
          session_id?: number | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "session_athletes_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athletes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_athletes_model_version_fkey"
            columns: ["model_version"]
            isOneToOne: false
            referencedRelation: "charge_model_versions"
            referencedColumns: ["version"]
          },
          {
            foreignKeyName: "session_athletes_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions: {
        Row: {
          category: string | null
          club_id: number | null
          created_by: number | null
          day: string | null
          description: string | null
          duration_minutes: number | null
          id: number
          instructions: string | null
          load_weight: number | null
          pdf_url: string | null
          session_date: string | null
          time: string | null
          title: string | null
          type: string | null
          week: number | null
        }
        Insert: {
          category?: string | null
          club_id?: number | null
          created_by?: number | null
          day?: string | null
          description?: string | null
          duration_minutes?: number | null
          id?: number
          instructions?: string | null
          load_weight?: number | null
          pdf_url?: string | null
          session_date?: string | null
          time?: string | null
          title?: string | null
          type?: string | null
          week?: number | null
        }
        Update: {
          category?: string | null
          club_id?: number | null
          created_by?: number | null
          day?: string | null
          description?: string | null
          duration_minutes?: number | null
          id?: number
          instructions?: string | null
          load_weight?: number | null
          pdf_url?: string | null
          session_date?: string | null
          time?: string | null
          title?: string | null
          type?: string | null
          week?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sessions_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      signup_attempts: {
        Row: {
          created_at: string
          email: string | null
          id: number
          ip: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: never
          ip: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: never
          ip?: string
        }
        Relationships: []
      }
      social_comments: {
        Row: {
          athlete_id: number
          content: string
          created_at: string | null
          id: number
          post_id: number
        }
        Insert: {
          athlete_id: number
          content: string
          created_at?: string | null
          id?: number
          post_id: number
        }
        Update: {
          athlete_id?: number
          content?: string
          created_at?: string | null
          id?: number
          post_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "social_comments_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athletes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "social_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      social_posts: {
        Row: {
          athlete_id: number
          auto_type: string | null
          club_id: number
          content: string
          created_at: string | null
          id: number
          image_url: string | null
          session_id: number | null
        }
        Insert: {
          athlete_id: number
          auto_type?: string | null
          club_id: number
          content: string
          created_at?: string | null
          id?: number
          image_url?: string | null
          session_id?: number | null
        }
        Update: {
          athlete_id?: number
          auto_type?: string | null
          club_id?: number
          content?: string
          created_at?: string | null
          id?: number
          image_url?: string | null
          session_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "social_posts_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athletes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_posts_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_posts_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      social_reactions: {
        Row: {
          athlete_id: number
          created_at: string | null
          emoji: string
          id: number
          post_id: number
        }
        Insert: {
          athlete_id: number
          created_at?: string | null
          emoji?: string
          id?: number
          post_id: number
        }
        Update: {
          athlete_id?: number
          created_at?: string | null
          emoji?: string
          id?: number
          post_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "social_reactions_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athletes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_reactions_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "social_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          auth_id: string | null
          auth_uid: string | null
          club_id: number | null
          email: string | null
          id: number
          name: string | null
          role: string | null
        }
        Insert: {
          auth_id?: string | null
          auth_uid?: string | null
          club_id?: number | null
          email?: string | null
          id?: number
          name?: string | null
          role?: string | null
        }
        Update: {
          auth_id?: string | null
          auth_uid?: string | null
          club_id?: number | null
          email?: string | null
          id?: number
          name?: string | null
          role?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "users_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      daily_training_load: {
        Row: {
          assigned_session_count: number | null
          athlete_id: number | null
          is_complete: boolean | null
          is_estimated: boolean | null
          load_date: string | null
          raw_load: number | null
          unknown_session_count: number | null
          week: number | null
        }
        Relationships: []
      }
      weekly_charge: {
        Row: {
          athlete_id: number | null
          daily_loads: Json | null
          estimated_days: number | null
          known_days: number | null
          raw_load: number | null
          unknown_days: number | null
          week: number | null
        }
        Relationships: [
          {
            foreignKeyName: "session_athletes_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athletes"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      add_athlete_performance: {
        Args: {
          p_breakdown?: Json | null
          p_context?: string | null
          p_discipline: string
          p_idempotency_key?: string | null
          p_metadata?: Json
          p_performance_date: string
          p_result_value: number
          p_value: string
        }
        Returns: Json
      }
      add_competition_result_v2: {
        Args: {
          p_athlete_id: number
          p_competition_id: number
          p_context?: string | null
          p_event: string
          p_higher_is_better: boolean
          p_idempotency_key?: string | null
          p_metadata?: Json
          p_result: string
          p_result_value: number
          p_unit?: string | null
        }
        Returns: Json
      }
      create_solo_competition_result_v2: {
        Args: {
          p_breakdown?: Json | null
          p_context?: string | null
          p_date: string
          p_event: string
          p_higher_is_better: boolean
          p_idempotency_key?: string | null
          p_location: string | null
          p_metadata?: Json
          p_name: string
          p_result: string
          p_result_value: number
          p_type: string
          p_unit?: string | null
        }
        Returns: Json
      }
      create_coach_alert: {
        Args: {
          p_athlete_id: number
          p_club_id: number
          p_description: string
          p_severity?: string
          p_title: string
          p_type: string
        }
        Returns: undefined
      }
      get_my_athlete_id: { Args: never; Returns: number }
      get_my_club_id: { Args: never; Returns: number }
      get_my_role: { Args: never; Returns: string }
      get_my_user_id: { Args: never; Returns: number }
      import_club_athletes: {
        Args: { p_rows: Json }
        Returns: Json
      }
      signup_create_account: {
        Args: {
          p_auth_uid: string
          p_club_name: string
          p_email: string
          p_invite_code: string
          p_mode: string
          p_name: string
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
