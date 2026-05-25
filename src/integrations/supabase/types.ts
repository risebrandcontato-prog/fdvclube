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
      confirmations: {
        Row: {
          created_at: string
          game_id: string
          id: string
          player_id: string
          status: Database["public"]["Enums"]["confirmation_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          game_id: string
          id?: string
          player_id: string
          status?: Database["public"]["Enums"]["confirmation_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          game_id?: string
          id?: string
          player_id?: string
          status?: Database["public"]["Enums"]["confirmation_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "confirmations_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "confirmations_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      games: {
        Row: {
          contribution_amount: number
          created_at: string
          date: string
          id: string
          location_id: string | null
          max_players: number
          notes: string | null
          status: Database["public"]["Enums"]["game_status"]
          time: string
          title: string
        }
        Insert: {
          contribution_amount?: number
          created_at?: string
          date: string
          id?: string
          location_id?: string | null
          max_players?: number
          notes?: string | null
          status?: Database["public"]["Enums"]["game_status"]
          time: string
          title: string
        }
        Update: {
          contribution_amount?: number
          created_at?: string
          date?: string
          id?: string
          location_id?: string | null
          max_players?: number
          notes?: string | null
          status?: Database["public"]["Enums"]["game_status"]
          time?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "games_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      invite_codes: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          id: string
          is_admin: boolean
          status: Database["public"]["Enums"]["invite_status"]
          used_by: string | null
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_admin?: boolean
          status?: Database["public"]["Enums"]["invite_status"]
          used_by?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_admin?: boolean
          status?: Database["public"]["Enums"]["invite_status"]
          used_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invite_codes_created_by_fk"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invite_codes_used_by_fk"
            columns: ["used_by"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      locations: {
        Row: {
          address: string | null
          created_at: string
          id: string
          maps_url: string | null
          name: string
          photo_url: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string
          id?: string
          maps_url?: string | null
          name: string
          photo_url?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string
          id?: string
          maps_url?: string | null
          name?: string
          photo_url?: string | null
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          game_id: string
          id: string
          notes: string | null
          paid_at: string | null
          player_id: string
          status: Database["public"]["Enums"]["payment_status"]
          updated_at: string
        }
        Insert: {
          amount?: number
          created_at?: string
          game_id: string
          id?: string
          notes?: string | null
          paid_at?: string | null
          player_id: string
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          game_id?: string
          id?: string
          notes?: string | null
          paid_at?: string | null
          player_id?: string
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      player_sessions: {
        Row: {
          created_at: string
          id: string
          last_used_at: string
          player_id: string
          token: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_used_at?: string
          player_id: string
          token: string
        }
        Update: {
          created_at?: string
          id?: string
          last_used_at?: string
          player_id?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_sessions_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      players: {
        Row: {
          avatar_url: string | null
          created_at: string
          id: string
          invite_code_id: string | null
          is_admin: boolean
          is_blocked: boolean
          name: string
          position: Database["public"]["Enums"]["player_position"]
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          id?: string
          invite_code_id?: string | null
          is_admin?: boolean
          is_blocked?: boolean
          name: string
          position: Database["public"]["Enums"]["player_position"]
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          id?: string
          invite_code_id?: string | null
          is_admin?: boolean
          is_blocked?: boolean
          name?: string
          position?: Database["public"]["Enums"]["player_position"]
        }
        Relationships: [
          {
            foreignKeyName: "players_invite_code_id_fkey"
            columns: ["invite_code_id"]
            isOneToOne: false
            referencedRelation: "invite_codes"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      confirmation_status: "confirmed" | "cancelled"
      game_status: "scheduled" | "cancelled" | "done"
      invite_status: "pending" | "used" | "blocked" | "revoked"
      payment_status: "paid" | "pending" | "late" | "exempt"
      player_position: "goleiro" | "defensor" | "meio" | "atacante"
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
    Enums: {
      confirmation_status: ["confirmed", "cancelled"],
      game_status: ["scheduled", "cancelled", "done"],
      invite_status: ["pending", "used", "blocked", "revoked"],
      payment_status: ["paid", "pending", "late", "exempt"],
      player_position: ["goleiro", "defensor", "meio", "atacante"],
    },
  },
} as const
