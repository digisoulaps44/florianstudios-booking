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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      booking_events: {
        Row: {
          actor: string
          actor_user_id: string | null
          booking_id: string
          created_at: string
          data: Json
          event: string
          id: string
        }
        Insert: {
          actor: string
          actor_user_id?: string | null
          booking_id: string
          created_at?: string
          data?: Json
          event: string
          id?: string
        }
        Update: {
          actor?: string
          actor_user_id?: string | null
          booking_id?: string
          created_at?: string
          data?: Json
          event?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_events_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_tokens: {
        Row: {
          booking_id: string
          created_at: string
          expires_at: string
          id: string
          revoked_at: string | null
          token_hash: string
        }
        Insert: {
          booking_id: string
          created_at?: string
          expires_at: string
          id?: string
          revoked_at?: string | null
          token_hash: string
        }
        Update: {
          booking_id?: string
          created_at?: string
          expires_at?: string
          id?: string
          revoked_at?: string | null
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_tokens_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          blocked_until: string
          buffer_minutes: number
          cancelled_at: string | null
          cancelled_by: string | null
          created_at: string
          customer_email: string | null
          customer_name: string
          customer_phone: string
          duration_minutes: number
          ends_at: string
          id: string
          idempotency_key: string | null
          note: string | null
          price_ore: number
          source: string
          staff_id: string
          staff_treatment_id: string | null
          starts_at: string
          status: Database["public"]["Enums"]["booking_status"]
          treatment_id: string | null
          treatment_name: string
          updated_at: string
          whatsapp_opt_in: boolean
          whatsapp_opt_in_at: string | null
        }
        Insert: {
          blocked_until: string
          buffer_minutes?: number
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string
          customer_email?: string | null
          customer_name: string
          customer_phone: string
          duration_minutes: number
          ends_at: string
          id?: string
          idempotency_key?: string | null
          note?: string | null
          price_ore: number
          source?: string
          staff_id: string
          staff_treatment_id?: string | null
          starts_at: string
          status?: Database["public"]["Enums"]["booking_status"]
          treatment_id?: string | null
          treatment_name: string
          updated_at?: string
          whatsapp_opt_in?: boolean
          whatsapp_opt_in_at?: string | null
        }
        Update: {
          blocked_until?: string
          buffer_minutes?: number
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string
          customer_email?: string | null
          customer_name?: string
          customer_phone?: string
          duration_minutes?: number
          ends_at?: string
          id?: string
          idempotency_key?: string | null
          note?: string | null
          price_ore?: number
          source?: string
          staff_id?: string
          staff_treatment_id?: string | null
          starts_at?: string
          status?: Database["public"]["Enums"]["booking_status"]
          treatment_id?: string | null
          treatment_name?: string
          updated_at?: string
          whatsapp_opt_in?: boolean
          whatsapp_opt_in_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bookings_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_staff_treatment_id_fkey"
            columns: ["staff_treatment_id"]
            isOneToOne: false
            referencedRelation: "staff_treatments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_treatment_id_fkey"
            columns: ["treatment_id"]
            isOneToOne: false
            referencedRelation: "treatments"
            referencedColumns: ["id"]
          },
        ]
      }
      message_jobs: {
        Row: {
          attempts: number
          booking_id: string | null
          channel: Database["public"]["Enums"]["message_channel"]
          created_at: string
          dedupe_key: string
          delivered_at: string | null
          failed_at: string | null
          id: string
          last_error: string | null
          locked_at: string | null
          max_attempts: number
          provider_message_id: string | null
          read_at: string | null
          recipient: string | null
          recipient_kind: string
          recipient_staff_id: string | null
          scheduled_for: string
          sent_at: string | null
          status: Database["public"]["Enums"]["message_status"]
          template: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          booking_id?: string | null
          channel: Database["public"]["Enums"]["message_channel"]
          created_at?: string
          dedupe_key: string
          delivered_at?: string | null
          failed_at?: string | null
          id?: string
          last_error?: string | null
          locked_at?: string | null
          max_attempts?: number
          provider_message_id?: string | null
          read_at?: string | null
          recipient?: string | null
          recipient_kind: string
          recipient_staff_id?: string | null
          scheduled_for?: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["message_status"]
          template: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          booking_id?: string | null
          channel?: Database["public"]["Enums"]["message_channel"]
          created_at?: string
          dedupe_key?: string
          delivered_at?: string | null
          failed_at?: string | null
          id?: string
          last_error?: string | null
          locked_at?: string | null
          max_attempts?: number
          provider_message_id?: string | null
          read_at?: string | null
          recipient?: string | null
          recipient_kind?: string
          recipient_staff_id?: string | null
          scheduled_for?: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["message_status"]
          template?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_jobs_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_jobs_recipient_staff_id_fkey"
            columns: ["recipient_staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string
          booking_id: string | null
          created_at: string
          id: string
          read_at: string | null
          staff_id: string
          title: string
          type: string
        }
        Insert: {
          body: string
          booking_id?: string | null
          created_at?: string
          id?: string
          read_at?: string | null
          staff_id: string
          title: string
          type: string
        }
        Update: {
          body?: string
          booking_id?: string | null
          created_at?: string
          id?: string
          read_at?: string | null
          staff_id?: string
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          expired_at: string | null
          id: string
          last_success_at: string | null
          p256dh: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          expired_at?: string | null
          id?: string
          last_success_at?: string | null
          p256dh: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          expired_at?: string | null
          id?: string
          last_success_at?: string | null
          p256dh?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      rate_limits: {
        Row: {
          hits: number
          key: string
          window_start: string
        }
        Insert: {
          hits?: number
          key: string
          window_start: string
        }
        Update: {
          hits?: number
          key?: string
          window_start?: string
        }
        Relationships: []
      }
      salon_settings: {
        Row: {
          address_line: string
          booking_horizon_days: number
          cancellation_cutoff_hours: number
          id: number
          min_notice_minutes: number
          name: string
          phone: string
          reminder_hours_before: number
          slot_interval_minutes: number
          timezone: string
          updated_at: string
        }
        Insert: {
          address_line?: string
          booking_horizon_days?: number
          cancellation_cutoff_hours?: number
          id?: number
          min_notice_minutes?: number
          name?: string
          phone?: string
          reminder_hours_before?: number
          slot_interval_minutes?: number
          timezone?: string
          updated_at?: string
        }
        Update: {
          address_line?: string
          booking_horizon_days?: number
          cancellation_cutoff_hours?: number
          id?: number
          min_notice_minutes?: number
          name?: string
          phone?: string
          reminder_hours_before?: number
          slot_interval_minutes?: number
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      schedule_exceptions: {
        Row: {
          created_at: string
          created_by: string | null
          ends_at: string
          id: string
          kind: Database["public"]["Enums"]["exception_kind"]
          note: string | null
          staff_id: string
          starts_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          ends_at: string
          id?: string
          kind: Database["public"]["Enums"]["exception_kind"]
          note?: string | null
          staff_id: string
          starts_at: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          ends_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["exception_kind"]
          note?: string | null
          staff_id?: string
          starts_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedule_exceptions_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      staff: {
        Row: {
          active: boolean
          created_at: string
          display_name: string
          email: string
          id: string
          notify_all_bookings: boolean
          notify_email: boolean
          notify_push: boolean
          phone: string | null
          sort_order: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          display_name: string
          email: string
          id?: string
          notify_all_bookings?: boolean
          notify_email?: boolean
          notify_push?: boolean
          phone?: string | null
          sort_order?: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          display_name?: string
          email?: string
          id?: string
          notify_all_bookings?: boolean
          notify_email?: boolean
          notify_push?: boolean
          phone?: string | null
          sort_order?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      staff_treatments: {
        Row: {
          active: boolean
          buffer_minutes: number
          created_at: string
          duration_minutes: number
          id: string
          price_ore: number
          staff_id: string
          treatment_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          buffer_minutes?: number
          created_at?: string
          duration_minutes: number
          id?: string
          price_ore: number
          staff_id: string
          treatment_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          buffer_minutes?: number
          created_at?: string
          duration_minutes?: number
          id?: string
          price_ore?: number
          staff_id?: string
          treatment_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_treatments_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_treatments_treatment_id_fkey"
            columns: ["treatment_id"]
            isOneToOne: false
            referencedRelation: "treatments"
            referencedColumns: ["id"]
          },
        ]
      }
      treatments: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          id: string
          name: string
          sort_order: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          name: string
          sort_order?: number
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      weekly_schedule: {
        Row: {
          end_time: string
          id: string
          kind: Database["public"]["Enums"]["schedule_kind"]
          staff_id: string
          start_time: string
          weekday: number
        }
        Insert: {
          end_time: string
          id?: string
          kind?: Database["public"]["Enums"]["schedule_kind"]
          staff_id: string
          start_time: string
          weekday: number
        }
        Update: {
          end_time?: string
          id?: string
          kind?: Database["public"]["Enums"]["schedule_kind"]
          staff_id?: string
          start_time?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "weekly_schedule_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cancel_booking: {
        Args: {
          p_actor: string
          p_actor_user_id: string
          p_booking_id: string
          p_reason: string
        }
        Returns: undefined
      }
      claim_message_jobs: {
        Args: { p_limit: number }
        Returns: {
          attempts: number
          booking_id: string | null
          channel: Database["public"]["Enums"]["message_channel"]
          created_at: string
          dedupe_key: string
          delivered_at: string | null
          failed_at: string | null
          id: string
          last_error: string | null
          locked_at: string | null
          max_attempts: number
          provider_message_id: string | null
          read_at: string | null
          recipient: string | null
          recipient_kind: string
          recipient_staff_id: string | null
          scheduled_for: string
          sent_at: string | null
          status: Database["public"]["Enums"]["message_status"]
          template: string
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "message_jobs"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      create_booking: {
        Args: {
          p_actor: string
          p_actor_user_id: string
          p_customer_email: string
          p_customer_name: string
          p_customer_phone: string
          p_idempotency_key: string
          p_note: string
          p_source: string
          p_staff_treatment_id: string
          p_starts_at: string
          p_token_expires_at: string
          p_token_hash: string
          p_whatsapp_opt_in: boolean
        }
        Returns: {
          booking_id: string
          created: boolean
        }[]
      }
      current_staff_id: { Args: never; Returns: string }
      enqueue_booking_messages: {
        Args: {
          p_actor: string
          p_booking_id: string
          p_event: string
          p_event_id: string
        }
        Returns: undefined
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      hit_rate_limit: {
        Args: { p_key: string; p_limit: number; p_window_seconds: number }
        Returns: boolean
      }
      is_owner: { Args: never; Returns: boolean }
      reschedule_booking: {
        Args: {
          p_actor: string
          p_actor_user_id: string
          p_booking_id: string
          p_new_staff_treatment_id: string
          p_new_starts_at: string
        }
        Returns: undefined
      }
      set_booking_status: {
        Args: {
          p_actor: string
          p_actor_user_id: string
          p_booking_id: string
          p_status: Database["public"]["Enums"]["booking_status"]
        }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "owner" | "staff"
      booking_status: "confirmed" | "completed" | "cancelled" | "no_show"
      exception_kind: "vacation" | "absence" | "block" | "extra_work"
      message_channel: "email" | "whatsapp" | "push" | "sms"
      message_status:
        | "pending"
        | "processing"
        | "sent"
        | "delivered"
        | "read"
        | "failed"
        | "cancelled"
      schedule_kind: "work" | "break"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["owner", "staff"],
      booking_status: ["confirmed", "completed", "cancelled", "no_show"],
      exception_kind: ["vacation", "absence", "block", "extra_work"],
      message_channel: ["email", "whatsapp", "push", "sms"],
      message_status: [
        "pending",
        "processing",
        "sent",
        "delivered",
        "read",
        "failed",
        "cancelled",
      ],
      schedule_kind: ["work", "break"],
    },
  },
} as const
