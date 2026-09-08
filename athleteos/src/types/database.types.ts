export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
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
  public: {
    Tables: {
      coach_dashboard_preferences: {
        Row: { user_id: number; club_id: number; preferences: Json; updated_at: string }
        Insert: { user_id: number; club_id: number; preferences?: Json; updated_at?: string }
        Update: { user_id?: number; club_id?: number; preferences?: Json; updated_at?: string }
        Relationships: []
      }
      alert_read_states: {
        Row: {
          alert_id: number
          read_at: string
          user_id: number
        }
        Insert: {
          alert_id: number
          read_at?: string
          user_id: number
        }
        Update: {
          alert_id?: number
          read_at?: string
          user_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "alert_read_states_alert_id_fkey"
            columns: ["alert_id"]
            isOneToOne: false
            referencedRelation: "alerts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alert_read_states_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      alerts: {
        Row: {
          rule_key: string | null
          rule_version: number | null
          trigger_data: Json
          recipient_scope: string
          archived_at: string | null
          archived_by: number | null
          athlete_id: number | null
          club_id: number | null
          created_at: string | null
          dedupe_key: string | null
          description: string | null
          id: number
          is_read: boolean | null
          resolved_at: string | null
          resolved_by: number | null
          session_id: number | null
          severity: string | null
          title: string | null
          type: string | null
        }
        Insert: {
          rule_key?: string | null
          rule_version?: number | null
          trigger_data?: Json
          recipient_scope?: string
          archived_at?: string | null
          archived_by?: number | null
          athlete_id?: number | null
          club_id?: number | null
          created_at?: string | null
          dedupe_key?: string | null
          description?: string | null
          id?: number
          is_read?: boolean | null
          resolved_at?: string | null
          resolved_by?: number | null
          session_id?: number | null
          severity?: string | null
          title?: string | null
          type?: string | null
        }
        Update: {
          rule_key?: string | null
          rule_version?: number | null
          trigger_data?: Json
          recipient_scope?: string
          archived_at?: string | null
          archived_by?: number | null
          athlete_id?: number | null
          club_id?: number | null
          created_at?: string | null
          dedupe_key?: string | null
          description?: string | null
          id?: number
          is_read?: boolean | null
          resolved_at?: string | null
          resolved_by?: number | null
          session_id?: number | null
          severity?: string | null
          title?: string | null
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "alerts_archived_by_fkey"
            columns: ["archived_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
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
          {
            foreignKeyName: "alerts_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alerts_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
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
      athlete_modules: {
        Row: {
          athlete_id: number
          club_id: number
          config: Json
          created_at: string
          enabled: boolean
          id: number
          module_key: string
          updated_at: string
          updated_by: number | null
        }
        Insert: {
          athlete_id: number
          club_id: number
          config?: Json
          created_at?: string
          enabled?: boolean
          id?: number
          module_key: string
          updated_at?: string
          updated_by?: number | null
        }
        Update: {
          athlete_id?: number
          club_id?: number
          config?: Json
          created_at?: string
          enabled?: boolean
          id?: number
          module_key?: string
          updated_at?: string
          updated_by?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "athlete_modules_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athletes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "athlete_modules_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "athlete_modules_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      athlete_notifications: {
        Row: {
          athlete_id: number
          club_id: number
          created_at: string | null
          dedupe_key: string | null
          description: string | null
          id: number
          is_read: boolean | null
          session_id: number | null
          title: string
          type: string
        }
        Insert: {
          athlete_id: number
          club_id: number
          created_at?: string | null
          dedupe_key?: string | null
          description?: string | null
          id?: number
          is_read?: boolean | null
          session_id?: number | null
          title: string
          type: string
        }
        Update: {
          athlete_id?: number
          club_id?: number
          created_at?: string | null
          dedupe_key?: string | null
          description?: string | null
          id?: number
          is_read?: boolean | null
          session_id?: number | null
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
          {
            foreignKeyName: "athlete_notifications_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
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
          discipline_id: string | null
          discipline_type: string
          hurdle_height_m: number | null
          id: number
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
          discipline_id?: string | null
          discipline_type: string
          hurdle_height_m?: number | null
          id?: number
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
          discipline_id?: string | null
          discipline_type?: string
          hurdle_height_m?: number | null
          id?: number
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
          answers: Json
          athlete_id: number
          club_id: number | null
          created_at: string | null
          date: string | null
          energy: number | null
          id: number
          mood: number | null
          notes: string | null
          questionnaire_version_id: number | null
          sleep: number | null
          soreness: number | null
          stress: number | null
        }
        Insert: {
          answers?: Json
          athlete_id: number
          club_id?: number | null
          created_at?: string | null
          date?: string | null
          energy?: number | null
          id?: number
          mood?: number | null
          notes?: string | null
          questionnaire_version_id?: number | null
          sleep?: number | null
          soreness?: number | null
          stress?: number | null
        }
        Update: {
          answers?: Json
          athlete_id?: number
          club_id?: number | null
          created_at?: string | null
          date?: string | null
          energy?: number | null
          id?: number
          mood?: number | null
          notes?: string | null
          questionnaire_version_id?: number | null
          sleep?: number | null
          soreness?: number | null
          stress?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "athlete_wellness_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athletes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "athlete_wellness_questionnaire_version_id_fkey"
            columns: ["questionnaire_version_id"]
            isOneToOne: false
            referencedRelation: "wellness_questionnaire_versions"
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
      audit_logs: {
        Row: {
          action: string
          actor_club_id: number | null
          actor_user_id: number | null
          created_at: string
          error_message: string | null
          id: number
          idempotency_key: string | null
          payload: Json | null
          result: string
          target_club_id: number | null
          target_user_id: number | null
        }
        Insert: {
          action: string
          actor_club_id?: number | null
          actor_user_id?: number | null
          created_at?: string
          error_message?: string | null
          id?: number
          idempotency_key?: string | null
          payload?: Json | null
          result: string
          target_club_id?: number | null
          target_user_id?: number | null
        }
        Update: {
          action?: string
          actor_club_id?: number | null
          actor_user_id?: number | null
          created_at?: string
          error_message?: string | null
          id?: number
          idempotency_key?: string | null
          payload?: Json | null
          result?: string
          target_club_id?: number | null
          target_user_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_club_id_fkey"
            columns: ["actor_club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_target_club_id_fkey"
            columns: ["target_club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_target_user_id_fkey"
            columns: ["target_user_id"]
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
      club_invitations: {
        Row: {
          accepted_at: string | null
          accepted_user_id: number | null
          club_id: number
          code: string
          created_at: string
          created_by: number | null
          expires_at: string | null
          id: string
          opened_at: string | null
          recipient_email: string | null
          recipient_name: string | null
          reservation_token: string | null
          reserved_until: string | null
          revoked_at: string | null
          status: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_user_id?: number | null
          club_id: number
          code: string
          created_at?: string
          created_by?: number | null
          expires_at?: string | null
          id?: string
          opened_at?: string | null
          recipient_email?: string | null
          recipient_name?: string | null
          reservation_token?: string | null
          reserved_until?: string | null
          revoked_at?: string | null
          status?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_user_id?: number | null
          club_id?: number
          code?: string
          created_at?: string
          created_by?: number | null
          expires_at?: string | null
          id?: string
          opened_at?: string | null
          recipient_email?: string | null
          recipient_name?: string | null
          reservation_token?: string | null
          reserved_until?: string | null
          revoked_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "club_invitations_accepted_user_id_fkey"
            columns: ["accepted_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_invitations_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_invitations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      club_alert_rules: {
        Row: {
          club_id: number
          rule_key: string
          enabled: boolean
          parameters: Json
          target_group: string | null
          severity: string
          recipient_scope: string
          version: number
          created_at: string
          updated_at: string
        }
        Insert: {
          club_id: number
          rule_key: string
          enabled?: boolean
          parameters: Json
          target_group?: string | null
          severity?: string
          recipient_scope?: string
          version?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          enabled?: boolean
          parameters?: Json
          target_group?: string | null
          severity?: string
          recipient_scope?: string
          version?: number
          updated_at?: string
        }
        Relationships: [{
          foreignKeyName: "club_alert_rules_club_id_fkey"
          columns: ["club_id"]
          isOneToOne: false
          referencedRelation: "clubs"
          referencedColumns: ["id"]
        }]
      }
      club_modules: {
        Row: {
          club_id: number
          config: Json
          created_at: string
          enabled: boolean
          id: number
          module_key: string
          updated_at: string
          updated_by: number | null
        }
        Insert: {
          club_id: number
          config?: Json
          created_at?: string
          enabled?: boolean
          id?: number
          module_key: string
          updated_at?: string
          updated_by?: number | null
        }
        Update: {
          club_id?: number
          config?: Json
          created_at?: string
          enabled?: boolean
          id?: number
          module_key?: string
          updated_at?: string
          updated_by?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "club_modules_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_modules_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      clubs: {
        Row: {
          accent_color: string
          cover_path: string | null
          id: number
          invite_code: string | null
          invite_code_created_at: string | null
          invite_code_expires_at: string | null
          invite_code_last_used_at: string | null
          invite_code_use_count: number
          logo_path: string | null
          modules_configured_at: string | null
          name: string
        }
        Insert: {
          accent_color?: string
          cover_path?: string | null
          id?: number
          invite_code?: string | null
          invite_code_created_at?: string | null
          invite_code_expires_at?: string | null
          invite_code_last_used_at?: string | null
          invite_code_use_count?: number
          logo_path?: string | null
          modules_configured_at?: string | null
          name: string
        }
        Update: {
          accent_color?: string
          cover_path?: string | null
          id?: number
          invite_code?: string | null
          invite_code_created_at?: string | null
          invite_code_expires_at?: string | null
          invite_code_last_used_at?: string | null
          invite_code_use_count?: number
          logo_path?: string | null
          modules_configured_at?: string | null
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
          discipline_id: string | null
          event: string | null
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
          source: string
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
          discipline_id?: string | null
          event?: string | null
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
          source?: string
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
          discipline_id?: string | null
          event?: string | null
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
          source?: string
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
          notes: string | null
          type: string | null
        }
        Insert: {
          club_id?: number | null
          date?: string | null
          id?: number
          location?: string | null
          name?: string | null
          notes?: string | null
          type?: string | null
        }
        Update: {
          club_id?: number | null
          date?: string | null
          id?: number
          location?: string | null
          name?: string | null
          notes?: string | null
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
      documents: {
        Row: {
          category: string | null
          club_id: number
          created_at: string
          id: number
          mime_type: string
          name: string
          size_bytes: number
          storage_path: string
          tags: string[]
          updated_at: string
          uploaded_by: number | null
        }
        Insert: {
          category?: string | null
          club_id: number
          created_at?: string
          id?: number
          mime_type: string
          name: string
          size_bytes?: number
          storage_path: string
          tags?: string[]
          updated_at?: string
          uploaded_by?: number | null
        }
        Update: {
          category?: string | null
          club_id?: number
          created_at?: string
          id?: number
          mime_type?: string
          name?: string
          size_bytes?: number
          storage_path?: string
          tags?: string[]
          updated_at?: string
          uploaded_by?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "users"
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
      notification_outbox: {
        Row: {
          athlete_id: number | null
          club_id: number | null
          created_at: string
          event_type: string
          id: number
          payload: Json
          processed_at: string | null
          status: string
        }
        Insert: {
          athlete_id?: number | null
          club_id?: number | null
          created_at?: string
          event_type: string
          id?: number
          payload: Json
          processed_at?: string | null
          status?: string
        }
        Update: {
          athlete_id?: number | null
          club_id?: number | null
          created_at?: string
          event_type?: string
          id?: number
          payload?: Json
          processed_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_outbox_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athletes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_outbox_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
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
      planning_event_athletes: {
        Row: {
          athlete_id: number
          event_id: number
        }
        Insert: {
          athlete_id: number
          event_id: number
        }
        Update: {
          athlete_id?: number
          event_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "planning_event_athletes_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athletes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planning_event_athletes_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "planning_events"
            referencedColumns: ["id"]
          },
        ]
      }
      planning_event_documents: {
        Row: {
          document_id: number
          event_id: number
        }
        Insert: {
          document_id: number
          event_id: number
        }
        Update: {
          document_id?: number
          event_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "planning_event_documents_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planning_event_documents_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "planning_events"
            referencedColumns: ["id"]
          },
        ]
      }
      planning_events: {
        Row: {
          club_id: number
          created_at: string
          created_by: number
          custom_label: string | null
          description: string | null
          ends_on: string
          id: number
          kind: string
          location: string | null
          name: string
          notes: string | null
          starts_on: string
          target_group: string | null
          time: string | null
          updated_at: string
          updated_by: number | null
        }
        Insert: {
          club_id: number
          created_at?: string
          created_by: number
          custom_label?: string | null
          description?: string | null
          ends_on: string
          id?: number
          kind: string
          location?: string | null
          name: string
          notes?: string | null
          starts_on: string
          target_group?: string | null
          time?: string | null
          updated_at?: string
          updated_by?: number | null
        }
        Update: {
          club_id?: number
          created_at?: string
          created_by?: number
          custom_label?: string | null
          description?: string | null
          ends_on?: string
          id?: number
          kind?: string
          location?: string | null
          name?: string
          notes?: string | null
          starts_on?: string
          target_group?: string | null
          time?: string | null
          updated_at?: string
          updated_by?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "planning_events_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planning_events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planning_events_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      push_delivery_attempts: {
        Row: {
          created_at: string
          id: number
          recipient_count: number
          user_id: number
        }
        Insert: {
          created_at?: string
          id?: never
          recipient_count: number
          user_id: number
        }
        Update: {
          created_at?: string
          id?: never
          recipient_count?: number
          user_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "push_delivery_attempts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      push_event_outbox: {
        Row: {
          actor_user_id: number
          athlete_ids: number[]
          attempts: number
          claimed_at: string | null
          club_id: number
          completed_at: string | null
          created_at: string
          dedupe_key: string
          entity_id: number
          event_type: string
          id: number
          user_ids: number[]
        }
        Insert: {
          actor_user_id: number
          athlete_ids?: number[]
          attempts?: number
          claimed_at?: string | null
          club_id: number
          completed_at?: string | null
          created_at?: string
          dedupe_key: string
          entity_id: number
          event_type: string
          id?: never
          user_ids?: number[]
        }
        Update: {
          actor_user_id?: number
          athlete_ids?: number[]
          attempts?: number
          claimed_at?: string | null
          club_id?: number
          completed_at?: string | null
          created_at?: string
          dedupe_key?: string
          entity_id?: number
          event_type?: string
          id?: never
          user_ids?: number[]
        }
        Relationships: [
          {
            foreignKeyName: "push_event_outbox_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "push_event_outbox_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          athlete_id: number | null
          auth: string | null
          club_id: number | null
          created_at: string | null
          endpoint: string | null
          id: number
          p256dh: string | null
          user_agent: string | null
          user_id: number | null
        }
        Insert: {
          athlete_id?: number | null
          auth?: string | null
          club_id?: number | null
          created_at?: string | null
          endpoint?: string | null
          id?: number
          p256dh?: string | null
          user_agent?: string | null
          user_id?: number | null
        }
        Update: {
          athlete_id?: number | null
          auth?: string | null
          club_id?: number | null
          created_at?: string | null
          endpoint?: string | null
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
      rpc_idempotency: {
        Row: {
          actor_user_id: number | null
          created_at: string
          fn_name: string
          idempotency_key: string
          result: Json
        }
        Insert: {
          actor_user_id?: number | null
          created_at?: string
          fn_name: string
          idempotency_key: string
          result: Json
        }
        Update: {
          actor_user_id?: number | null
          created_at?: string
          fn_name?: string
          idempotency_key?: string
          result?: Json
        }
        Relationships: [
          {
            foreignKeyName: "rpc_idempotency_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      session_athletes: {
        Row: {
          actual_duration_minutes: number | null
          athlete_id: number | null
          attendance_marked_at: string | null
          attendance_status: string | null
          coach_note: string | null
          comment: string | null
          duration_source: string | null
          fatigue: number | null
          feedback_submitted_at: string | null
          feeling: number | null
          id: number
          model_version: string | null
          rpe: number | null
          rsvp_note: string | null
          rsvp_status: string | null
          rsvp_updated_at: string | null
          session_id: number | null
          status: string | null
        }
        Insert: {
          actual_duration_minutes?: number | null
          athlete_id?: number | null
          attendance_marked_at?: string | null
          attendance_status?: string | null
          coach_note?: string | null
          comment?: string | null
          duration_source?: string | null
          fatigue?: number | null
          feedback_submitted_at?: string | null
          feeling?: number | null
          id?: number
          model_version?: string | null
          rpe?: number | null
          rsvp_note?: string | null
          rsvp_status?: string | null
          rsvp_updated_at?: string | null
          session_id?: number | null
          status?: string | null
        }
        Update: {
          actual_duration_minutes?: number | null
          athlete_id?: number | null
          attendance_marked_at?: string | null
          attendance_status?: string | null
          coach_note?: string | null
          comment?: string | null
          duration_source?: string | null
          fatigue?: number | null
          feedback_submitted_at?: string | null
          feeling?: number | null
          id?: number
          model_version?: string | null
          rpe?: number | null
          rsvp_note?: string | null
          rsvp_status?: string | null
          rsvp_updated_at?: string | null
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
      session_document_recipients: {
        Row: {
          athlete_id: number
          created_at: string
          document_id: number
          session_id: number
        }
        Insert: {
          athlete_id: number
          created_at?: string
          document_id: number
          session_id: number
        }
        Update: {
          athlete_id?: number
          created_at?: string
          document_id?: number
          session_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "session_document_recipients_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athletes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_document_recipients_session_id_document_id_fkey"
            columns: ["session_id", "document_id"]
            isOneToOne: false
            referencedRelation: "session_documents"
            referencedColumns: ["session_id", "document_id"]
          },
        ]
      }
      session_documents: {
        Row: {
          attached_at: string
          attached_by: number | null
          document_id: number
          session_id: number
          visibility: string
        }
        Insert: {
          attached_at?: string
          attached_by?: number | null
          document_id: number
          session_id: number
          visibility?: string
        }
        Update: {
          attached_at?: string
          attached_by?: number | null
          document_id?: number
          session_id?: number
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_documents_attached_by_fkey"
            columns: ["attached_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_documents_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_documents_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      session_series: {
        Row: {
          category: string | null
          club_id: number
          created_at: string
          created_by: number
          description: string | null
          duration_minutes: number
          ends_on: string | null
          id: number
          instructions: string | null
          interval_weeks: number
          occurrence_count: number | null
          starts_on: string
          target_group: string | null
          time: string
          title: string
          training_focus: string | null
          type: string | null
          updated_at: string
          updated_by: number | null
          weekdays: number[]
        }
        Insert: {
          category?: string | null
          club_id: number
          created_at?: string
          created_by: number
          description?: string | null
          duration_minutes: number
          ends_on?: string | null
          id?: number
          instructions?: string | null
          interval_weeks?: number
          occurrence_count?: number | null
          starts_on: string
          target_group?: string | null
          time: string
          title: string
          training_focus?: string | null
          type?: string | null
          updated_at?: string
          updated_by?: number | null
          weekdays: number[]
        }
        Update: {
          category?: string | null
          club_id?: number
          created_at?: string
          created_by?: number
          description?: string | null
          duration_minutes?: number
          ends_on?: string | null
          id?: number
          instructions?: string | null
          interval_weeks?: number
          occurrence_count?: number | null
          starts_on?: string
          target_group?: string | null
          time?: string
          title?: string
          training_focus?: string | null
          type?: string | null
          updated_at?: string
          updated_by?: number | null
          weekdays?: number[]
        }
        Relationships: [
          {
            foreignKeyName: "session_series_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_series_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_series_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      session_series_documents: {
        Row: {
          document_id: number
          series_id: number
        }
        Insert: {
          document_id: number
          series_id: number
        }
        Update: {
          document_id?: number
          series_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "session_series_documents_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_series_documents_series_id_fkey"
            columns: ["series_id"]
            isOneToOne: false
            referencedRelation: "session_series"
            referencedColumns: ["id"]
          },
        ]
      }
      session_template_documents: {
        Row: {
          document_id: number
          template_id: number
        }
        Insert: {
          document_id: number
          template_id: number
        }
        Update: {
          document_id?: number
          template_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "session_template_documents_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_template_documents_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "session_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      session_templates: {
        Row: {
          category: string | null
          club_id: number
          created_at: string
          created_by: number
          description: string | null
          duration_minutes: number
          id: number
          instructions: string | null
          name: string
          scope: string
          tags: string[]
          title: string
          training_focus: string | null
          type: string | null
          updated_at: string
        }
        Insert: {
          category?: string | null
          club_id: number
          created_at?: string
          created_by: number
          description?: string | null
          duration_minutes: number
          id?: number
          instructions?: string | null
          name: string
          scope?: string
          tags?: string[]
          title: string
          training_focus?: string | null
          type?: string | null
          updated_at?: string
        }
        Update: {
          category?: string | null
          club_id?: number
          created_at?: string
          created_by?: number
          description?: string | null
          duration_minutes?: number
          id?: number
          instructions?: string | null
          name?: string
          scope?: string
          tags?: string[]
          title?: string
          training_focus?: string | null
          type?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_templates_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions: {
        Row: {
          category: string | null
          closed_at: string | null
          closed_by: number | null
          club_id: number | null
          created_by: number | null
          day: string | null
          description: string | null
          duration_minutes: number | null
          id: number
          instructions: string | null
          lifecycle_status: string
          load_weight: number | null
          parent_session_id: number | null
          pdf_url: string | null
          planning_event_id: number | null
          series_id: number | null
          series_original_date: string | null
          session_date: string | null
          source_kind: string
          started_at: string | null
          target_group: string | null
          time: string | null
          title: string | null
          training_focus: string | null
          type: string | null
          updated_at: string
          updated_by: number | null
          week: number | null
        }
        Insert: {
          category?: string | null
          closed_at?: string | null
          closed_by?: number | null
          club_id?: number | null
          created_by?: number | null
          day?: string | null
          description?: string | null
          duration_minutes?: number | null
          id?: number
          instructions?: string | null
          lifecycle_status?: string
          load_weight?: number | null
          parent_session_id?: number | null
          pdf_url?: string | null
          planning_event_id?: number | null
          series_id?: number | null
          series_original_date?: string | null
          session_date?: string | null
          source_kind?: string
          started_at?: string | null
          target_group?: string | null
          time?: string | null
          title?: string | null
          training_focus?: string | null
          type?: string | null
          updated_at?: string
          updated_by?: number | null
          week?: number | null
        }
        Update: {
          category?: string | null
          closed_at?: string | null
          closed_by?: number | null
          club_id?: number | null
          created_by?: number | null
          day?: string | null
          description?: string | null
          duration_minutes?: number | null
          id?: number
          instructions?: string | null
          lifecycle_status?: string
          load_weight?: number | null
          parent_session_id?: number | null
          pdf_url?: string | null
          planning_event_id?: number | null
          series_id?: number | null
          series_original_date?: string | null
          session_date?: string | null
          source_kind?: string
          started_at?: string | null
          target_group?: string | null
          time?: string | null
          title?: string | null
          training_focus?: string | null
          type?: string | null
          updated_at?: string
          updated_by?: number | null
          week?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sessions_closed_by_fkey"
            columns: ["closed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
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
          {
            foreignKeyName: "sessions_parent_session_id_fkey"
            columns: ["parent_session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_planning_event_id_fkey"
            columns: ["planning_event_id"]
            isOneToOne: false
            referencedRelation: "planning_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_series_id_fkey"
            columns: ["series_id"]
            isOneToOne: false
            referencedRelation: "session_series"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_updated_by_fkey"
            columns: ["updated_by"]
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
      wellness_questionnaire_versions: {
        Row: {
          active_days: number[]
          club_id: number
          created_at: string
          created_by: number
          id: number
          is_active: boolean
          questions: Json
          response_visibility: string
          version_number: number
        }
        Insert: {
          active_days?: number[]
          club_id: number
          created_at?: string
          created_by: number
          id?: number
          is_active?: boolean
          questions: Json
          response_visibility?: string
          version_number: number
        }
        Update: {
          active_days?: number[]
          club_id?: number
          created_at?: string
          created_by?: number
          id?: number
          is_active?: boolean
          questions?: Json
          response_visibility?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "wellness_questionnaire_versions_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wellness_questionnaire_versions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
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
          iso_year: number | null
          load_date: string | null
          raw_load: number | null
          unknown_session_count: number | null
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
      weekly_charge: {
        Row: {
          athlete_id: number | null
          daily_loads: Json | null
          estimated_days: number | null
          iso_year: number | null
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
      get_my_dashboard_preferences: { Args: Record<PropertyKey, never>; Returns: Json }
      configure_my_dashboard_preferences: { Args: { p_preferences: Json }; Returns: Json }
      _apply_competition_result: {
        Args: {
          p_also_log_performance: boolean
          p_athlete_id: number
          p_athlete_name: string
          p_breakdown?: Json
          p_club_id: number
          p_competition_id: number
          p_competition_name: string
          p_context: string
          p_event: string
          p_higher_is_better: boolean
          p_performance_date: string
          p_result: string
          p_result_value: number
          p_unit?: string
        }
        Returns: Json
      }
      _assert_session_write: {
        Args: {
          p_athlete_ids: number[]
          p_excluded_session_id?: number
          p_session: Json
        }
        Returns: undefined
      }
      _series_dates: {
        Args: {
          p_ends_on: string
          p_interval_weeks: number
          p_occurrence_count: number
          p_starts_on: string
          p_weekdays: number[]
        }
        Returns: {
          occurrence_date: string
        }[]
      }
      accept_existing_member_club_invitation: {
        Args: { p_email: string; p_invitation_id: string; p_user_id: number }
        Returns: Json
      }
      add_athlete_performance: {
        Args: {
          p_breakdown?: Json
          p_context?: string
          p_discipline: string
          p_idempotency_key?: string
          p_metadata?: Json
          p_performance_date: string
          p_result_value: number
          p_value: string
        }
        Returns: Json
      }
      add_competition_result: {
        Args: {
          p_athlete_id: number
          p_competition_id: number
          p_context?: string
          p_event: string
          p_higher_is_better: boolean
          p_idempotency_key?: string
          p_result: string
          p_result_value: number
          p_unit?: string
        }
        Returns: Json
      }
      add_competition_result_v2: {
        Args: {
          p_athlete_id: number
          p_competition_id: number
          p_context?: string
          p_event: string
          p_higher_is_better: boolean
          p_idempotency_key?: string
          p_metadata?: Json
          p_result: string
          p_result_value: number
          p_unit?: string
        }
        Returns: Json
      }
      can_access_planning_event_document_link: {
        Args: { p_document_id: number; p_event_id: number }
        Returns: boolean
      }
      can_access_session_document_link: {
        Args: { p_document_id: number; p_session_id: number }
        Returns: boolean
      }
      can_access_training_document: {
        Args: { p_document_id: number }
        Returns: boolean
      }
      can_access_training_document_path: {
        Args: { p_storage_path: string }
        Returns: boolean
      }
      can_manage_planning_event: {
        Args: { p_event_id: number }
        Returns: boolean
      }
      can_view_competition: {
        Args: { p_competition_id: number }
        Returns: boolean
      }
      can_view_planning_event: {
        Args: { p_event_id: number }
        Returns: boolean
      }
      claim_trusted_push_events: {
        Args: { p_actor_user_id: number }
        Returns: {
          actor_user_id: number
          athlete_ids: number[]
          attempts: number
          claimed_at: string | null
          club_id: number
          completed_at: string | null
          created_at: string
          dedupe_key: string
          entity_id: number
          event_type: string
          id: number
          user_ids: number[]
        }[]
        SetofOptions: {
          from: "*"
          to: "push_event_outbox"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      configure_athlete_modules: {
        Args: { p_athlete_ids: number[]; p_enabled_module_keys: string[] }
        Returns: Json
      }
      get_club_alert_rules: { Args: Record<PropertyKey, never>; Returns: Json }
      configure_club_alert_rules: { Args: { p_rules: Json }; Returns: Json }
      evaluate_club_alert_rules: {
        Args: { p_club_id?: number | null; p_as_of?: string; p_dry_run?: boolean }
        Returns: Json
      }
      configure_module_athletes: {
        Args: { p_enabled_athlete_ids: number[]; p_module_key: string }
        Returns: Json
      }
      configure_my_club_modules: {
        Args: { p_enabled_module_keys: string[] }
        Returns: Json
      }
      configure_wellness_questionnaire: {
        Args: {
          p_active_days: number[]
          p_questions: Json
          p_response_visibility?: string
        }
        Returns: Json
      }
      create_club_athlete: { Args: { p_payload: Json }; Returns: Json }
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
      create_competition_with_athletes: {
        Args: {
          p_athlete_entries: Json
          p_date: string
          p_idempotency_key?: string
          p_location: string
          p_name: string
          p_type: string
        }
        Returns: Json
      }
      create_session_from_template: {
        Args: {
          p_athlete_ids: number[]
          p_idempotency_key?: string
          p_schedule: Json
          p_template_id: number
        }
        Returns: Json
      }
      delete_session_template: {
        Args: { p_template_id: number }
        Returns: Json
      }
      create_session_series_with_occurrences: {
        Args: {
          p_athlete_ids: number[]
          p_idempotency_key?: string
          p_series: Json
        }
        Returns: Json
      }
      create_session_with_athletes: {
        Args: {
          p_athlete_ids: number[]
          p_idempotency_key?: string
          p_session: Json
        }
        Returns: Json
      }
      create_solo_competition_result: {
        Args: {
          p_breakdown?: Json
          p_context?: string
          p_date: string
          p_event: string
          p_higher_is_better: boolean
          p_idempotency_key?: string
          p_location: string
          p_name: string
          p_result: string
          p_result_value: number
          p_type: string
          p_unit?: string
        }
        Returns: Json
      }
      create_solo_competition_result_v2: {
        Args: {
          p_breakdown?: Json
          p_context?: string
          p_date: string
          p_event: string
          p_higher_is_better: boolean
          p_idempotency_key?: string
          p_location: string
          p_metadata?: Json
          p_name: string
          p_result: string
          p_result_value: number
          p_type: string
          p_unit?: string
        }
        Returns: Json
      }
      delete_athlete_performance: {
        Args: { p_performance_id: number }
        Returns: Json
      }
      delete_competition_transactional: {
        Args: { p_competition_id: number }
        Returns: number
      }
      delete_document_transactional: {
        Args: { p_document_id: number }
        Returns: Json
      }
      delete_planning_event: { Args: { p_event_id: number }; Returns: number }
      delete_recurring_session: {
        Args: { p_scope: string; p_session_id: number }
        Returns: Json
      }
      delete_session_transactional: {
        Args: { p_session_id: number }
        Returns: Json
      }
      delete_unlinked_club_athlete: {
        Args: { p_athlete_id: number }
        Returns: Json
      }
      detach_session_document: {
        Args: { p_document_id: number; p_session_id: number }
        Returns: Json
      }
      duplicate_session_transactional: {
        Args: {
          p_athlete_ids?: number[]
          p_session_date: string
          p_session_id: number
        }
        Returns: Json
      }
      duplicate_session_template: {
        Args: { p_name: string; p_scope?: string; p_template_id: number }
        Returns: Json
      }
      duplicate_week_transactional: {
        Args: {
          p_athlete_ids?: number[]
          p_source_monday: string
          p_target_monday: string
        }
        Returns: Json
      }
      get_my_athlete_id: { Args: never; Returns: number }
      get_my_club_id: { Args: never; Returns: number }
      get_my_role: { Args: never; Returns: string }
      get_my_user_id: { Args: never; Returns: number }
      get_wellness_questionnaire: {
        Args: { p_date?: string }
        Returns: Json
      }
      import_club_athletes: { Args: { p_rows: Json }; Returns: Json }
      inspect_club_invitation: { Args: { p_code: string }; Returns: Json }
      is_athlete_module_enabled: {
        Args: { p_athlete_id: number; p_module_key: string }
        Returns: boolean
      }
      is_club_module_enabled: {
        Args: { p_club_id: number; p_module_key: string }
        Returns: boolean
      }
      mark_alerts_read: { Args: { p_alert_ids: number[] }; Returns: number }
      mark_club_invitation_used: {
        Args: { p_invite_code: string }
        Returns: undefined
      }
      mark_notification_outbox_sent: {
        Args: { p_ids: number[] }
        Returns: undefined
      }
      module_key_for_notification_type: {
        Args: { p_type: string }
        Returns: string
      }
      preview_club_operational_reset: {
        Args: { p_club_id: number }
        Returns: Json
      }
      publish_planning_event_documents: {
        Args: {
          p_document_ids: number[]
          p_event_id: number
          p_notification_key?: string
        }
        Returns: Json
      }
      publish_series_documents: {
        Args: {
          p_document_ids: number[]
          p_from_date?: string
          p_notification_key?: string
          p_series_id: number
        }
        Returns: Json
      }
      publish_session_document_distribution: {
        Args: {
          p_distribution: Json
          p_notification_key?: string
          p_session_id: number
        }
        Returns: Json
      }
      publish_session_documents: {
        Args: {
          p_athlete_ids?: number[]
          p_document_ids: number[]
          p_notification_key?: string
          p_session_id: number
        }
        Returns: Json
      }
      queue_trusted_push_reminder: {
        Args: {
          p_actor_user_id: number
          p_entity_id: number
          p_event_type: string
        }
        Returns: undefined
      }
      refresh_series_group_members: {
        Args: { p_from_date?: string; p_series_id: number }
        Returns: Json
      }
      register_training_document: {
        Args: {
          p_category?: string
          p_mime_type: string
          p_name: string
          p_size_bytes: number
          p_storage_path: string
          p_tags?: string[]
        }
        Returns: Json
      }
      remove_club_user_transactional: {
        Args: { p_actor_user_id: number; p_target_user_id: number }
        Returns: Json
      }
      delete_own_account_transactional: {
        Args: { p_confirmation_email: string; p_user_id: number }
        Returns: Json
      }
      reset_club_operational_data: {
        Args: { p_club_id: number; p_confirmation: string }
        Returns: Json
      }
      reset_my_club_module_onboarding: { Args: never; Returns: undefined }
      save_session_template: {
        Args: { p_name: string; p_session_id: number }
        Returns: number
      }
      set_alert_resolution: {
        Args: { p_alert_id: number; p_archived?: boolean; p_resolved: boolean }
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
      signup_create_account_with_invitation: {
        Args: {
          p_auth_uid: string
          p_club_name: string
          p_email: string
          p_individual_invitation_id: string
          p_invite_code: string
          p_mode: string
          p_name: string
          p_reservation_token: string
        }
        Returns: Json
      }
      submit_wellness_response: {
        Args: { p_answers: Json; p_date?: string; p_notes?: string }
        Returns: Json
      }
      update_club_athlete: {
        Args: { p_athlete_id: number; p_payload: Json }
        Returns: Json
      }
      update_competition_with_athletes: {
        Args: {
          p_athlete_entries: Json
          p_competition_id: number
          p_date: string
          p_location: string
          p_name: string
          p_notes: string
          p_type: string
        }
        Returns: Json
      }
      upsert_session_template: {
        Args: {
          p_document_ids?: number[]
          p_template: Json
          p_template_id: number | null
        }
        Returns: Json
      }
      update_recurring_session: {
        Args: {
          p_athlete_ids: number[]
          p_patch: Json
          p_scope: string
          p_session_id: number
        }
        Returns: Json
      }
      update_session_with_athletes: {
        Args: { p_athlete_ids: number[]; p_session: Json; p_session_id: number }
        Returns: Json
      }
      upsert_planning_event_with_athletes: {
        Args: { p_athlete_ids: number[]; p_event: Json; p_event_id: number }
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
