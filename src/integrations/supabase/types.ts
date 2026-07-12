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
      ambassador_announcements: {
        Row: {
          audience: string
          audience_filter: Json
          author_id: string | null
          body: string
          created_at: string
          id: string
          published_at: string
          title: string
          updated_at: string
        }
        Insert: {
          audience?: string
          audience_filter?: Json
          author_id?: string | null
          body: string
          created_at?: string
          id?: string
          published_at?: string
          title: string
          updated_at?: string
        }
        Update: {
          audience?: string
          audience_filter?: Json
          author_id?: string | null
          body?: string
          created_at?: string
          id?: string
          published_at?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      ambassador_applications: {
        Row: {
          created_at: string
          id: string
          motivation: string
          region: string | null
          review_notes: string | null
          reviewer_id: string | null
          school_id: string | null
          scope_id: string | null
          scope_type: Database["public"]["Enums"]["ambassador_scope_type"]
          socials: Json
          status: Database["public"]["Enums"]["ambassador_app_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          motivation: string
          region?: string | null
          review_notes?: string | null
          reviewer_id?: string | null
          school_id?: string | null
          scope_id?: string | null
          scope_type?: Database["public"]["Enums"]["ambassador_scope_type"]
          socials?: Json
          status?: Database["public"]["Enums"]["ambassador_app_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          motivation?: string
          region?: string | null
          review_notes?: string | null
          reviewer_id?: string | null
          school_id?: string | null
          scope_id?: string | null
          scope_type?: Database["public"]["Enums"]["ambassador_scope_type"]
          socials?: Json
          status?: Database["public"]["Enums"]["ambassador_app_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ambassador_applications_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      ambassador_assets: {
        Row: {
          body: string | null
          created_at: string
          created_by: string | null
          external_url: string | null
          id: string
          kind: string
          storage_path: string | null
          tier_min: Database["public"]["Enums"]["ambassador_tier"]
          title: string
          updated_at: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          created_by?: string | null
          external_url?: string | null
          id?: string
          kind: string
          storage_path?: string | null
          tier_min?: Database["public"]["Enums"]["ambassador_tier"]
          title: string
          updated_at?: string
        }
        Update: {
          body?: string | null
          created_at?: string
          created_by?: string | null
          external_url?: string | null
          id?: string
          kind?: string
          storage_path?: string | null
          tier_min?: Database["public"]["Enums"]["ambassador_tier"]
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      ambassador_campaigns: {
        Row: {
          active: boolean
          ambassador_id: string
          code: string
          created_at: string
          id: string
          landing_path: string
          name: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          ambassador_id: string
          code: string
          created_at?: string
          id?: string
          landing_path?: string
          name: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          ambassador_id?: string
          code?: string
          created_at?: string
          id?: string
          landing_path?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ambassador_campaigns_ambassador_id_fkey"
            columns: ["ambassador_id"]
            isOneToOne: false
            referencedRelation: "ambassadors"
            referencedColumns: ["user_id"]
          },
        ]
      }
      ambassador_invitations: {
        Row: {
          accepted_at: string | null
          created_at: string
          expires_at: string
          id: string
          invitee_email: string | null
          invitee_user_id: string | null
          inviter_id: string
          message: string | null
          region: string | null
          school_id: string
          scope_id: string | null
          scope_type: Database["public"]["Enums"]["ambassador_scope_type"]
          status: string
          token: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          invitee_email?: string | null
          invitee_user_id?: string | null
          inviter_id: string
          message?: string | null
          region?: string | null
          school_id: string
          scope_id?: string | null
          scope_type: Database["public"]["Enums"]["ambassador_scope_type"]
          status?: string
          token?: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          invitee_email?: string | null
          invitee_user_id?: string | null
          inviter_id?: string
          message?: string | null
          region?: string | null
          school_id?: string
          scope_id?: string | null
          scope_type?: Database["public"]["Enums"]["ambassador_scope_type"]
          status?: string
          token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ambassador_invitations_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      ambassador_task_completions: {
        Row: {
          ambassador_id: string
          created_at: string
          evidence_url: string | null
          id: string
          notes: string | null
          reviewed_at: string | null
          reviewer_id: string | null
          status: Database["public"]["Enums"]["ambassador_task_status"]
          task_id: string
          updated_at: string
        }
        Insert: {
          ambassador_id: string
          created_at?: string
          evidence_url?: string | null
          id?: string
          notes?: string | null
          reviewed_at?: string | null
          reviewer_id?: string | null
          status?: Database["public"]["Enums"]["ambassador_task_status"]
          task_id: string
          updated_at?: string
        }
        Update: {
          ambassador_id?: string
          created_at?: string
          evidence_url?: string | null
          id?: string
          notes?: string | null
          reviewed_at?: string | null
          reviewer_id?: string | null
          status?: Database["public"]["Enums"]["ambassador_task_status"]
          task_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ambassador_task_completions_ambassador_id_fkey"
            columns: ["ambassador_id"]
            isOneToOne: false
            referencedRelation: "ambassadors"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "ambassador_task_completions_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "ambassador_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      ambassador_tasks: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          description: string
          ends_at: string | null
          id: string
          reward_points: number
          scope: Json
          starts_at: string | null
          title: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          description: string
          ends_at?: string | null
          id?: string
          reward_points?: number
          scope?: Json
          starts_at?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          description?: string
          ends_at?: string | null
          id?: string
          reward_points?: number
          scope?: Json
          starts_at?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      ambassadors: {
        Row: {
          approved_at: string
          approved_by: string | null
          created_at: string
          region: string | null
          school_id: string | null
          scope_id: string | null
          scope_type: Database["public"]["Enums"]["ambassador_scope_type"]
          status: Database["public"]["Enums"]["ambassador_status"]
          suspend_reason: string | null
          suspended_at: string | null
          tier: Database["public"]["Enums"]["ambassador_tier"]
          updated_at: string
          user_id: string
        }
        Insert: {
          approved_at?: string
          approved_by?: string | null
          created_at?: string
          region?: string | null
          school_id?: string | null
          scope_id?: string | null
          scope_type: Database["public"]["Enums"]["ambassador_scope_type"]
          status?: Database["public"]["Enums"]["ambassador_status"]
          suspend_reason?: string | null
          suspended_at?: string | null
          tier?: Database["public"]["Enums"]["ambassador_tier"]
          updated_at?: string
          user_id: string
        }
        Update: {
          approved_at?: string
          approved_by?: string | null
          created_at?: string
          region?: string | null
          school_id?: string | null
          scope_id?: string | null
          scope_type?: Database["public"]["Enums"]["ambassador_scope_type"]
          status?: Database["public"]["Enums"]["ambassador_status"]
          suspend_reason?: string | null
          suspended_at?: string | null
          tier?: Database["public"]["Enums"]["ambassador_tier"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ambassadors_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      campoints_balances: {
        Row: {
          balance: number
          lifetime_earned: number
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          lifetime_earned?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          lifetime_earned?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campoints_balances_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      campoints_ledger: {
        Row: {
          created_at: string
          delta: number
          id: string
          meta: Json
          reason: Database["public"]["Enums"]["campoint_reason"]
          ref_id: string | null
          ref_type: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          delta: number
          id?: string
          meta?: Json
          reason: Database["public"]["Enums"]["campoint_reason"]
          ref_id?: string | null
          ref_type?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          delta?: number
          id?: string
          meta?: Json
          reason?: Database["public"]["Enums"]["campoint_reason"]
          ref_id?: string | null
          ref_type?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campoints_ledger_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      comments: {
        Row: {
          author_id: string
          body: string
          created_at: string
          id: string
          parent_id: string | null
          post_id: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          id?: string
          parent_id?: string | null
          post_id: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          parent_id?: string | null
          post_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_author_id_profiles_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      communities: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          kind: Database["public"]["Enums"]["community_kind"]
          name: string
          school_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          kind: Database["public"]["Enums"]["community_kind"]
          name: string
          school_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["community_kind"]
          name?: string
          school_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "communities_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      connections: {
        Row: {
          addressee_id: string
          created_at: string
          id: string
          requester_id: string
          status: Database["public"]["Enums"]["connection_status"]
          updated_at: string
        }
        Insert: {
          addressee_id: string
          created_at?: string
          id?: string
          requester_id: string
          status?: Database["public"]["Enums"]["connection_status"]
          updated_at?: string
        }
        Update: {
          addressee_id?: string
          created_at?: string
          id?: string
          requester_id?: string
          status?: Database["public"]["Enums"]["connection_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "connections_addressee_id_profiles_fkey"
            columns: ["addressee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "connections_requester_id_profiles_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          id: string
          last_message_at: string
          user_a: string
          user_b: string
        }
        Insert: {
          id?: string
          last_message_at?: string
          user_a: string
          user_b: string
        }
        Update: {
          id?: string
          last_message_at?: string
          user_a?: string
          user_b?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_user_a_profiles_fkey"
            columns: ["user_a"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_user_b_profiles_fkey"
            columns: ["user_b"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_checkins: {
        Row: {
          awarded: number
          created_at: string
          day: string
          streak: number
          user_id: string
        }
        Insert: {
          awarded?: number
          created_at?: string
          day: string
          streak?: number
          user_id: string
        }
        Update: {
          awarded?: number
          created_at?: string
          day?: string
          streak?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_checkins_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      departments: {
        Row: {
          faculty_id: string
          id: string
          name: string
        }
        Insert: {
          faculty_id: string
          id?: string
          name: string
        }
        Update: {
          faculty_id?: string
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "departments_faculty_id_fkey"
            columns: ["faculty_id"]
            isOneToOne: false
            referencedRelation: "faculties"
            referencedColumns: ["id"]
          },
        ]
      }
      event_rsvps: {
        Row: {
          created_at: string
          event_id: string
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          event_id?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_rsvps_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_rsvps_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          community_id: string | null
          cover_url: string | null
          created_at: string
          description: string | null
          ends_at: string | null
          host_id: string
          id: string
          location: string | null
          rsvp_count: number
          school_id: string | null
          starts_at: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          community_id?: string | null
          cover_url?: string | null
          created_at?: string
          description?: string | null
          ends_at?: string | null
          host_id: string
          id?: string
          location?: string | null
          rsvp_count?: number
          school_id?: string | null
          starts_at: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          community_id?: string | null
          cover_url?: string | null
          created_at?: string
          description?: string | null
          ends_at?: string | null
          host_id?: string
          id?: string
          location?: string | null
          rsvp_count?: number
          school_id?: string | null
          starts_at?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_host_id_fkey"
            columns: ["host_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      faculties: {
        Row: {
          id: string
          name: string
          school_id: string
        }
        Insert: {
          id?: string
          name: string
          school_id: string
        }
        Update: {
          id?: string
          name?: string
          school_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "faculties_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      likes: {
        Row: {
          created_at: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "likes_user_id_profiles_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_items: {
        Row: {
          category: string
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          price_naira: number
          school_id: string | null
          seller_id: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          price_naira?: number
          school_id?: string | null
          seller_id: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          price_naira?: number
          school_id?: string | null
          seller_id?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_items_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_items_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      memberships: {
        Row: {
          community_id: string
          joined_at: string
          role: string
          user_id: string
        }
        Insert: {
          community_id: string
          joined_at?: string
          role?: string
          user_id: string
        }
        Update: {
          community_id?: string
          joined_at?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "memberships_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memberships_user_id_profiles_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          body: string
          conversation_id: string
          created_at: string
          id: string
          sender_id: string
        }
        Insert: {
          body: string
          conversation_id: string
          created_at?: string
          id?: string
          sender_id: string
        }
        Update: {
          body?: string
          conversation_id?: string
          created_at?: string
          id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_profiles_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          author_id: string
          body: string
          comment_count: number
          community_id: string | null
          created_at: string
          hashtags: string[] | null
          hidden: boolean
          id: string
          like_count: number
          media: Json
          school_id: string | null
        }
        Insert: {
          author_id: string
          body: string
          comment_count?: number
          community_id?: string | null
          created_at?: string
          hashtags?: string[] | null
          hidden?: boolean
          id?: string
          like_count?: number
          media?: Json
          school_id?: string | null
        }
        Update: {
          author_id?: string
          body?: string
          comment_count?: number
          community_id?: string | null
          created_at?: string
          hashtags?: string[] | null
          hidden?: boolean
          id?: string
          like_count?: number
          media?: Json
          school_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "posts_author_id_profiles_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          department_id: string | null
          display_name: string | null
          faculty_id: string | null
          handle: string | null
          hostel: string | null
          id: string
          level: string | null
          onboarded: boolean
          phone: string | null
          primary_school_id: string | null
          referral_code: string | null
          referred_by: string | null
          verified: boolean
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          department_id?: string | null
          display_name?: string | null
          faculty_id?: string | null
          handle?: string | null
          hostel?: string | null
          id: string
          level?: string | null
          onboarded?: boolean
          phone?: string | null
          primary_school_id?: string | null
          referral_code?: string | null
          referred_by?: string | null
          verified?: boolean
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          department_id?: string | null
          display_name?: string | null
          faculty_id?: string | null
          handle?: string | null
          hostel?: string | null
          id?: string
          level?: string | null
          onboarded?: boolean
          phone?: string | null
          primary_school_id?: string | null
          referral_code?: string | null
          referred_by?: string | null
          verified?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "profiles_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_faculty_id_fkey"
            columns: ["faculty_id"]
            isOneToOne: false
            referencedRelation: "faculties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_primary_school_id_fkey"
            columns: ["primary_school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_referred_by_fkey"
            columns: ["referred_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      redemptions: {
        Row: {
          admin_notes: string | null
          amount_naira: number
          amount_points: number
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["redemption_kind"]
          payload: Json
          provider_ref: string | null
          status: Database["public"]["Enums"]["redemption_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          amount_naira: number
          amount_points: number
          created_at?: string
          id?: string
          kind: Database["public"]["Enums"]["redemption_kind"]
          payload?: Json
          provider_ref?: string | null
          status?: Database["public"]["Enums"]["redemption_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          amount_naira?: number
          amount_points?: number
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["redemption_kind"]
          payload?: Json
          provider_ref?: string | null
          status?: Database["public"]["Enums"]["redemption_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "redemptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          created_at: string
          id: string
          reason: string
          reporter_id: string
          status: Database["public"]["Enums"]["report_status"]
          target_id: string
          target_kind: Database["public"]["Enums"]["report_target"]
        }
        Insert: {
          created_at?: string
          id?: string
          reason: string
          reporter_id: string
          status?: Database["public"]["Enums"]["report_status"]
          target_id: string
          target_kind: Database["public"]["Enums"]["report_target"]
        }
        Update: {
          created_at?: string
          id?: string
          reason?: string
          reporter_id?: string
          status?: Database["public"]["Enums"]["report_status"]
          target_id?: string
          target_kind?: Database["public"]["Enums"]["report_target"]
        }
        Relationships: [
          {
            foreignKeyName: "reports_reporter_id_profiles_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      schools: {
        Row: {
          banner_color: string | null
          city: string | null
          country: string | null
          created_at: string
          id: string
          name: string
          short_name: string
        }
        Insert: {
          banner_color?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          id?: string
          name: string
          short_name: string
        }
        Update: {
          banner_color?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          id?: string
          name?: string
          short_name?: string
        }
        Relationships: []
      }
      share_clicks: {
        Row: {
          channel: string | null
          created_at: string
          id: string
          post_id: string
          sharer_id: string
        }
        Insert: {
          channel?: string | null
          created_at?: string
          id?: string
          post_id: string
          sharer_id: string
        }
        Update: {
          channel?: string | null
          created_at?: string
          id?: string
          post_id?: string
          sharer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "share_clicks_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "share_clicks_sharer_id_fkey"
            columns: ["sharer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      signup_attributions: {
        Row: {
          campaign_code: string | null
          campaign_id: string | null
          created_at: string
          id: string
          referrer_id: string | null
          school_id: string | null
          source: string | null
          user_id: string
        }
        Insert: {
          campaign_code?: string | null
          campaign_id?: string | null
          created_at?: string
          id?: string
          referrer_id?: string | null
          school_id?: string | null
          source?: string | null
          user_id: string
        }
        Update: {
          campaign_code?: string | null
          campaign_id?: string | null
          created_at?: string
          id?: string
          referrer_id?: string | null
          school_id?: string | null
          source?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "signup_attributions_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "ambassador_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "signup_attributions_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      are_connected: { Args: { _a: string; _b: string }; Returns: boolean }
      award_campoints: {
        Args: {
          _delta: number
          _meta?: Json
          _reason: Database["public"]["Enums"]["campoint_reason"]
          _ref_id?: string
          _ref_type?: string
          _user: string
        }
        Returns: number
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_active_ambassador: { Args: { _user_id: string }; Returns: boolean }
      is_campus_ambassador_of: {
        Args: { _school_id: string; _user: string }
        Returns: boolean
      }
      resolve_school_id: {
        Args: {
          _scope_id: string
          _scope_type: Database["public"]["Enums"]["ambassador_scope_type"]
        }
        Returns: string
      }
    }
    Enums: {
      ambassador_app_status: "pending" | "approved" | "rejected" | "withdrawn"
      ambassador_scope_type:
        | "school"
        | "faculty"
        | "department"
        | "hostel"
        | "region"
      ambassador_status: "active" | "suspended"
      ambassador_task_status: "submitted" | "approved" | "rejected"
      ambassador_tier: "ambassador" | "senior" | "regional_lead"
      app_role: "admin" | "moderator" | "user"
      campoint_reason:
        | "daily_checkin"
        | "streak_bonus"
        | "post"
        | "comment"
        | "like_received"
        | "comment_received"
        | "referral_qualified"
        | "referral_first_post"
        | "share_click"
        | "profile_complete"
        | "quest"
        | "redemption_debit"
        | "redemption_refund"
        | "admin_adjust"
        | "event_created"
        | "listing_created"
        | "ambassador_task_reward"
        | "ambassador_bonus"
      community_kind:
        | "faculty"
        | "department"
        | "level"
        | "hostel"
        | "club"
        | "sug"
        | "marketplace"
        | "events"
      connection_status: "pending" | "accepted" | "declined" | "blocked"
      redemption_kind: "airtime" | "data" | "cash"
      redemption_status: "pending" | "approved" | "paid" | "failed" | "rejected"
      report_status: "open" | "resolved" | "dismissed"
      report_target: "post" | "comment" | "user" | "event" | "listing"
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
      ambassador_app_status: ["pending", "approved", "rejected", "withdrawn"],
      ambassador_scope_type: [
        "school",
        "faculty",
        "department",
        "hostel",
        "region",
      ],
      ambassador_status: ["active", "suspended"],
      ambassador_task_status: ["submitted", "approved", "rejected"],
      ambassador_tier: ["ambassador", "senior", "regional_lead"],
      app_role: ["admin", "moderator", "user"],
      campoint_reason: [
        "daily_checkin",
        "streak_bonus",
        "post",
        "comment",
        "like_received",
        "comment_received",
        "referral_qualified",
        "referral_first_post",
        "share_click",
        "profile_complete",
        "quest",
        "redemption_debit",
        "redemption_refund",
        "admin_adjust",
        "event_created",
        "listing_created",
        "ambassador_task_reward",
        "ambassador_bonus",
      ],
      community_kind: [
        "faculty",
        "department",
        "level",
        "hostel",
        "club",
        "sug",
        "marketplace",
        "events",
      ],
      connection_status: ["pending", "accepted", "declined", "blocked"],
      redemption_kind: ["airtime", "data", "cash"],
      redemption_status: ["pending", "approved", "paid", "failed", "rejected"],
      report_status: ["open", "resolved", "dismissed"],
      report_target: ["post", "comment", "user", "event", "listing"],
    },
  },
} as const
