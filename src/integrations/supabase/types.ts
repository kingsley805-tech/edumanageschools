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
      academic_alerts: {
        Row: {
          alert_type: string
          created_at: string
          id: string
          message: string | null
          metadata: Json
          resolved_at: string | null
          school_id: string
          status: string
          student_id: string | null
        }
        Insert: {
          alert_type?: string
          created_at?: string
          id?: string
          message?: string | null
          metadata?: Json
          resolved_at?: string | null
          school_id: string
          status?: string
          student_id?: string | null
        }
        Update: {
          alert_type?: string
          created_at?: string
          id?: string
          message?: string | null
          metadata?: Json
          resolved_at?: string | null
          school_id?: string
          status?: string
          student_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "academic_alerts_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_school_sms_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "academic_alerts_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_tenant_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "academic_alerts_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academic_alerts_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      academic_programs: {
        Row: {
          code: string
          coordinator_name: string | null
          coordinator_teacher_id: string | null
          created_at: string
          created_by: string | null
          credits: number | null
          deleted_by: string | null
          department: string | null
          description: string | null
          duration_years: number | null
          faculty: string | null
          gallery_urls: string[]
          id: string
          image_url: string | null
          is_archived: boolean
          level: string | null
          name: string
          school_id: string
          semester_structure: string | null
          status: string
          subjects: string[] | null
          updated_at: string
          updated_by: string | null
          video_url: string | null
        }
        Insert: {
          code: string
          coordinator_name?: string | null
          coordinator_teacher_id?: string | null
          created_at?: string
          created_by?: string | null
          credits?: number | null
          deleted_by?: string | null
          department?: string | null
          description?: string | null
          duration_years?: number | null
          faculty?: string | null
          gallery_urls?: string[]
          id?: string
          image_url?: string | null
          is_archived?: boolean
          level?: string | null
          name: string
          school_id: string
          semester_structure?: string | null
          status?: string
          subjects?: string[] | null
          updated_at?: string
          updated_by?: string | null
          video_url?: string | null
        }
        Update: {
          code?: string
          coordinator_name?: string | null
          coordinator_teacher_id?: string | null
          created_at?: string
          created_by?: string | null
          credits?: number | null
          deleted_by?: string | null
          department?: string | null
          description?: string | null
          duration_years?: number | null
          faculty?: string | null
          gallery_urls?: string[]
          id?: string
          image_url?: string | null
          is_archived?: boolean
          level?: string | null
          name?: string
          school_id?: string
          semester_structure?: string | null
          status?: string
          subjects?: string[] | null
          updated_at?: string
          updated_by?: string | null
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "academic_programs_coordinator_teacher_id_fkey"
            columns: ["coordinator_teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academic_programs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academic_programs_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academic_programs_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_school_sms_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "academic_programs_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_tenant_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "academic_programs_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academic_programs_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      academic_recommendations: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          recommendation_type: string
          school_id: string
          strengths: string | null
          student_id: string
          suggestions: string
          teacher_id: string | null
          term_id: string | null
          threshold_alert: boolean
          updated_at: string
          weaknesses: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          recommendation_type?: string
          school_id: string
          strengths?: string | null
          student_id: string
          suggestions?: string
          teacher_id?: string | null
          term_id?: string | null
          threshold_alert?: boolean
          updated_at?: string
          weaknesses?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          recommendation_type?: string
          school_id?: string
          strengths?: string | null
          student_id?: string
          suggestions?: string
          teacher_id?: string | null
          term_id?: string | null
          threshold_alert?: boolean
          updated_at?: string
          weaknesses?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "academic_recommendations_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_school_sms_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "academic_recommendations_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_tenant_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "academic_recommendations_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academic_recommendations_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academic_recommendations_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academic_recommendations_term_id_fkey"
            columns: ["term_id"]
            isOneToOne: false
            referencedRelation: "terms"
            referencedColumns: ["id"]
          },
        ]
      }
      academic_years: {
        Row: {
          created_at: string
          end_date: string | null
          id: string
          is_current: boolean
          name: string
          school_id: string
          start_date: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          end_date?: string | null
          id?: string
          is_current?: boolean
          name: string
          school_id: string
          start_date?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          end_date?: string | null
          id?: string
          is_current?: boolean
          name?: string
          school_id?: string
          start_date?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "academic_years_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_school_sms_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "academic_years_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_tenant_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "academic_years_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      account_invoice_items: {
        Row: {
          amount: number
          amount_paid: number
          created_at: string
          description: string | null
          due_date: string
          fee_category_id: string
          fee_template_id: string | null
          id: string
          invoice_id: string
          student_id: string
        }
        Insert: {
          amount: number
          amount_paid?: number
          created_at?: string
          description?: string | null
          due_date: string
          fee_category_id: string
          fee_template_id?: string | null
          id?: string
          invoice_id: string
          student_id: string
        }
        Update: {
          amount?: number
          amount_paid?: number
          created_at?: string
          description?: string | null
          due_date?: string
          fee_category_id?: string
          fee_template_id?: string | null
          id?: string
          invoice_id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_invoice_items_fee_category_id_fkey"
            columns: ["fee_category_id"]
            isOneToOne: false
            referencedRelation: "fee_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_invoice_items_fee_template_id_fkey"
            columns: ["fee_template_id"]
            isOneToOne: false
            referencedRelation: "fee_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "account_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_invoice_items_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      account_invoices: {
        Row: {
          academic_term: string
          billing_account_id: string
          created_at: string
          due_date: string
          id: string
          invoice_no: string
          issued_at: string | null
          school_id: string
          status: Database["public"]["Enums"]["account_invoice_status"]
          term_id: string | null
          total_amount: number
          total_paid: number
          updated_at: string
        }
        Insert: {
          academic_term: string
          billing_account_id: string
          created_at?: string
          due_date: string
          id?: string
          invoice_no: string
          issued_at?: string | null
          school_id: string
          status?: Database["public"]["Enums"]["account_invoice_status"]
          term_id?: string | null
          total_amount?: number
          total_paid?: number
          updated_at?: string
        }
        Update: {
          academic_term?: string
          billing_account_id?: string
          created_at?: string
          due_date?: string
          id?: string
          invoice_no?: string
          issued_at?: string | null
          school_id?: string
          status?: Database["public"]["Enums"]["account_invoice_status"]
          term_id?: string | null
          total_amount?: number
          total_paid?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_invoices_billing_account_id_fkey"
            columns: ["billing_account_id"]
            isOneToOne: false
            referencedRelation: "billing_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_invoices_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_school_sms_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "account_invoices_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_tenant_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "account_invoices_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_invoices_term_id_fkey"
            columns: ["term_id"]
            isOneToOne: false
            referencedRelation: "terms"
            referencedColumns: ["id"]
          },
        ]
      }
      account_payments: {
        Row: {
          allocation_mode: string
          amount: number
          billing_account_id: string
          created_at: string
          id: string
          invoice_id: string | null
          payer_user_id: string | null
          payment_provider: string | null
          provider_reference: string | null
          school_id: string
          status: Database["public"]["Enums"]["account_payment_status"]
          unallocated_amount: number
        }
        Insert: {
          allocation_mode?: string
          amount: number
          billing_account_id: string
          created_at?: string
          id?: string
          invoice_id?: string | null
          payer_user_id?: string | null
          payment_provider?: string | null
          provider_reference?: string | null
          school_id: string
          status?: Database["public"]["Enums"]["account_payment_status"]
          unallocated_amount?: number
        }
        Update: {
          allocation_mode?: string
          amount?: number
          billing_account_id?: string
          created_at?: string
          id?: string
          invoice_id?: string | null
          payer_user_id?: string | null
          payment_provider?: string | null
          provider_reference?: string | null
          school_id?: string
          status?: Database["public"]["Enums"]["account_payment_status"]
          unallocated_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "account_payments_billing_account_id_fkey"
            columns: ["billing_account_id"]
            isOneToOne: false
            referencedRelation: "billing_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "account_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_payments_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_school_sms_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "account_payments_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_tenant_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "account_payments_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      achievement_categories: {
        Row: {
          color: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_archived: boolean
          name: string
          school_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_archived?: boolean
          name: string
          school_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_archived?: boolean
          name?: string
          school_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "achievement_categories_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "achievement_categories_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_school_sms_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "achievement_categories_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_tenant_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "achievement_categories_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "achievement_categories_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      achievement_notes: {
        Row: {
          achievement_id: string
          created_at: string
          created_by: string | null
          id: string
          note: string
          school_id: string
        }
        Insert: {
          achievement_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          note: string
          school_id: string
        }
        Update: {
          achievement_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string
          school_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "achievement_notes_achievement_id_fkey"
            columns: ["achievement_id"]
            isOneToOne: false
            referencedRelation: "achievements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "achievement_notes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "achievement_notes_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_school_sms_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "achievement_notes_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_tenant_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "achievement_notes_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      achievements: {
        Row: {
          academic_year: string | null
          achievement_type: string
          approved_at: string | null
          approved_by: string | null
          awarded_by: string | null
          awarded_on: string
          category_id: string | null
          created_at: string
          created_by: string | null
          deleted_by: string | null
          description: string | null
          document_url: string | null
          id: string
          image_url: string | null
          is_archived: boolean
          is_published: boolean
          level: string | null
          notes: string | null
          recommendation_letter: string | null
          rejection_reason: string | null
          school_id: string
          status: string
          student_id: string
          term_label: string | null
          title: string
          updated_at: string
          updated_by: string | null
          venue: string | null
        }
        Insert: {
          academic_year?: string | null
          achievement_type?: string
          approved_at?: string | null
          approved_by?: string | null
          awarded_by?: string | null
          awarded_on?: string
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_by?: string | null
          description?: string | null
          document_url?: string | null
          id?: string
          image_url?: string | null
          is_archived?: boolean
          is_published?: boolean
          level?: string | null
          notes?: string | null
          recommendation_letter?: string | null
          rejection_reason?: string | null
          school_id: string
          status?: string
          student_id: string
          term_label?: string | null
          title: string
          updated_at?: string
          updated_by?: string | null
          venue?: string | null
        }
        Update: {
          academic_year?: string | null
          achievement_type?: string
          approved_at?: string | null
          approved_by?: string | null
          awarded_by?: string | null
          awarded_on?: string
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_by?: string | null
          description?: string | null
          document_url?: string | null
          id?: string
          image_url?: string | null
          is_archived?: boolean
          is_published?: boolean
          level?: string | null
          notes?: string | null
          recommendation_letter?: string | null
          rejection_reason?: string | null
          school_id?: string
          status?: string
          student_id?: string
          term_label?: string | null
          title?: string
          updated_at?: string
          updated_by?: string | null
          venue?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "achievements_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "achievements_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "achievement_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "achievements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "achievements_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "achievements_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_school_sms_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "achievements_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_tenant_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "achievements_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "achievements_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "achievements_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_conversations: {
        Row: {
          created_at: string
          id: string
          module_context: string | null
          page_path: string | null
          school_id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          module_context?: string | null
          page_path?: string | null
          school_id: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          module_context?: string | null
          page_path?: string | null
          school_id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_conversations_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_school_sms_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "ai_conversations_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_tenant_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "ai_conversations_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_favorites: {
        Row: {
          conversation_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          conversation_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          conversation_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_favorites_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "ai_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          feedback: string | null
          id: string
          role: string
          tokens: number
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          feedback?: string | null
          id?: string
          role: string
          tokens?: number
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          feedback?: string | null
          id?: string
          role?: string
          tokens?: number
        }
        Relationships: [
          {
            foreignKeyName: "ai_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "ai_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_prompt_templates: {
        Row: {
          category: string
          created_at: string
          id: string
          is_system: boolean
          prompt: string
          school_id: string | null
          title: string
          user_id: string | null
        }
        Insert: {
          category?: string
          created_at?: string
          id?: string
          is_system?: boolean
          prompt: string
          school_id?: string | null
          title: string
          user_id?: string | null
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          is_system?: boolean
          prompt?: string
          school_id?: string | null
          title?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_prompt_templates_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_school_sms_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "ai_prompt_templates_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_tenant_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "ai_prompt_templates_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_usage_logs: {
        Row: {
          conversation_id: string | null
          created_at: string
          id: string
          module_context: string | null
          prompt_preview: string | null
          school_id: string
          tokens: number
          user_id: string
        }
        Insert: {
          conversation_id?: string | null
          created_at?: string
          id?: string
          module_context?: string | null
          prompt_preview?: string | null
          school_id: string
          tokens?: number
          user_id: string
        }
        Update: {
          conversation_id?: string | null
          created_at?: string
          id?: string
          module_context?: string | null
          prompt_preview?: string | null
          school_id?: string
          tokens?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_usage_logs_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "ai_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_usage_logs_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_school_sms_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "ai_usage_logs_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_tenant_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "ai_usage_logs_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      announcements: {
        Row: {
          body: string
          created_at: string | null
          created_by: string | null
          id: string
          priority: string | null
          school_id: string | null
          target_roles: string[] | null
          title: string
        }
        Insert: {
          body: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          priority?: string | null
          school_id?: string | null
          target_roles?: string[] | null
          title: string
        }
        Update: {
          body?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          priority?: string | null
          school_id?: string | null
          target_roles?: string[] | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcements_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_school_sms_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "announcements_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_tenant_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "announcements_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      approval_requests: {
        Row: {
          created_at: string
          id: string
          module: string
          payload: Json
          record_id: string | null
          request_type: string
          requested_by: string
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          school_id: string
          status: Database["public"]["Enums"]["approval_status"]
        }
        Insert: {
          created_at?: string
          id?: string
          module: string
          payload?: Json
          record_id?: string | null
          request_type: string
          requested_by: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          school_id: string
          status?: Database["public"]["Enums"]["approval_status"]
        }
        Update: {
          created_at?: string
          id?: string
          module?: string
          payload?: Json
          record_id?: string | null
          request_type?: string
          requested_by?: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          school_id?: string
          status?: Database["public"]["Enums"]["approval_status"]
        }
        Relationships: [
          {
            foreignKeyName: "approval_requests_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_school_sms_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "approval_requests_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_tenant_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "approval_requests_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      assignments: {
        Row: {
          class_id: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          due_date: string | null
          file_url: string | null
          id: string
          subject_id: string | null
          title: string
        }
        Insert: {
          class_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          file_url?: string | null
          id?: string
          subject_id?: string | null
          title: string
        }
        Update: {
          class_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          file_url?: string | null
          id?: string
          subject_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignments_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "school_classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance: {
        Row: {
          class_id: string | null
          date: string
          id: string
          recorded_at: string | null
          recorded_by: string | null
          status: string
          student_id: string | null
        }
        Insert: {
          class_id?: string | null
          date: string
          id?: string
          recorded_at?: string | null
          recorded_by?: string | null
          status: string
          student_id?: string | null
        }
        Update: {
          class_id?: string | null
          date?: string
          id?: string
          recorded_at?: string | null
          recorded_by?: string | null
          status?: string
          student_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "school_classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_records: {
        Row: {
          attendance_date: string
          attendance_status: string
          class_id: string
          created_at: string
          id: string
          register_id: string | null
          remark: string | null
          school_id: string
          student_id: string
          subject_id: string
          teacher_id: string
          term_id: string | null
          time_in: string | null
          updated_at: string
        }
        Insert: {
          attendance_date: string
          attendance_status: string
          class_id: string
          created_at?: string
          id?: string
          register_id?: string | null
          remark?: string | null
          school_id: string
          student_id: string
          subject_id: string
          teacher_id: string
          term_id?: string | null
          time_in?: string | null
          updated_at?: string
        }
        Update: {
          attendance_date?: string
          attendance_status?: string
          class_id?: string
          created_at?: string
          id?: string
          register_id?: string | null
          remark?: string | null
          school_id?: string
          student_id?: string
          subject_id?: string
          teacher_id?: string
          term_id?: string | null
          time_in?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_records_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "school_classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_register_id_fkey"
            columns: ["register_id"]
            isOneToOne: false
            referencedRelation: "class_registers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_school_sms_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "attendance_records_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_tenant_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "attendance_records_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_term_id_fkey"
            columns: ["term_id"]
            isOneToOne: false
            referencedRelation: "terms"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_sms_logs: {
        Row: {
          attendance_date: string
          attendance_status: string
          class_id: string | null
          created_at: string
          error_message: string | null
          id: string
          message: string | null
          parent_id: string | null
          phone_number: string | null
          provider_response: Json | null
          register_id: string | null
          school_id: string
          sent_at: string | null
          sms_status: string
          source: string
          student_id: string | null
          triggered_by: string | null
        }
        Insert: {
          attendance_date: string
          attendance_status: string
          class_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          message?: string | null
          parent_id?: string | null
          phone_number?: string | null
          provider_response?: Json | null
          register_id?: string | null
          school_id: string
          sent_at?: string | null
          sms_status?: string
          source?: string
          student_id?: string | null
          triggered_by?: string | null
        }
        Update: {
          attendance_date?: string
          attendance_status?: string
          class_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          message?: string | null
          parent_id?: string | null
          phone_number?: string | null
          provider_response?: Json | null
          register_id?: string | null
          school_id?: string
          sent_at?: string | null
          sms_status?: string
          source?: string
          student_id?: string | null
          triggered_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_sms_logs_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_sms_logs_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "school_classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_sms_logs_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "parents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_sms_logs_register_id_fkey"
            columns: ["register_id"]
            isOneToOne: false
            referencedRelation: "class_registers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_sms_logs_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_school_sms_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "attendance_sms_logs_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_tenant_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "attendance_sms_logs_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_sms_logs_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_status_types: {
        Row: {
          code: string
          color: string
          created_at: string
          id: string
          is_active: boolean
          label: string
          school_id: string
          sort_order: number
        }
        Insert: {
          code: string
          color?: string
          created_at?: string
          id?: string
          is_active?: boolean
          label: string
          school_id: string
          sort_order?: number
        }
        Update: {
          code?: string
          color?: string
          created_at?: string
          id?: string
          is_active?: boolean
          label?: string
          school_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "attendance_status_types_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_school_sms_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "attendance_status_types_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_tenant_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "attendance_status_types_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_summaries: {
        Row: {
          absent_count: number
          attendance_percentage: number
          excused_count: number
          id: string
          late_count: number
          present_count: number
          school_id: string
          sick_count: number
          student_id: string
          term_id: string | null
          total_days: number
          updated_at: string
        }
        Insert: {
          absent_count?: number
          attendance_percentage?: number
          excused_count?: number
          id?: string
          late_count?: number
          present_count?: number
          school_id: string
          sick_count?: number
          student_id: string
          term_id?: string | null
          total_days?: number
          updated_at?: string
        }
        Update: {
          absent_count?: number
          attendance_percentage?: number
          excused_count?: number
          id?: string
          late_count?: number
          present_count?: number
          school_id?: string
          sick_count?: number
          student_id?: string
          term_id?: string | null
          total_days?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_summaries_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_school_sms_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "attendance_summaries_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_tenant_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "attendance_summaries_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_summaries_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_summaries_term_id_fkey"
            columns: ["term_id"]
            isOneToOne: false
            referencedRelation: "terms"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action_type: string
          created_at: string | null
          details: Json | null
          entity_id: string | null
          entity_type: string
          id: string
          ip_address: string | null
          module: string | null
          new_values: Json | null
          old_values: Json | null
          performed_by: string | null
          record_id: string | null
          school_id: string | null
          user_agent: string | null
        }
        Insert: {
          action_type: string
          created_at?: string | null
          details?: Json | null
          entity_id?: string | null
          entity_type: string
          id?: string
          ip_address?: string | null
          module?: string | null
          new_values?: Json | null
          old_values?: Json | null
          performed_by?: string | null
          record_id?: string | null
          school_id?: string | null
          user_agent?: string | null
        }
        Update: {
          action_type?: string
          created_at?: string | null
          details?: Json | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip_address?: string | null
          module?: string | null
          new_values?: Json | null
          old_values?: Json | null
          performed_by?: string | null
          record_id?: string | null
          school_id?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_performed_by_fkey"
            columns: ["performed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_school_sms_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "audit_logs_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_tenant_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "audit_logs_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      behavior_reports: {
        Row: {
          action_taken: string | null
          approved_at: string | null
          approved_by: string | null
          attachment_url: string | null
          behavior_score: number | null
          created_at: string
          created_by: string | null
          demerits: number
          description: string | null
          follow_up: string | null
          id: string
          incident_date: string
          is_archived: boolean
          merits: number
          parent_notified: boolean
          report_type: string
          reported_by_name: string | null
          school_id: string
          status: string
          student_id: string
          teacher_remark: string | null
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          action_taken?: string | null
          approved_at?: string | null
          approved_by?: string | null
          attachment_url?: string | null
          behavior_score?: number | null
          created_at?: string
          created_by?: string | null
          demerits?: number
          description?: string | null
          follow_up?: string | null
          id?: string
          incident_date?: string
          is_archived?: boolean
          merits?: number
          parent_notified?: boolean
          report_type?: string
          reported_by_name?: string | null
          school_id: string
          status?: string
          student_id: string
          teacher_remark?: string | null
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          action_taken?: string | null
          approved_at?: string | null
          approved_by?: string | null
          attachment_url?: string | null
          behavior_score?: number | null
          created_at?: string
          created_by?: string | null
          demerits?: number
          description?: string | null
          follow_up?: string | null
          id?: string
          incident_date?: string
          is_archived?: boolean
          merits?: number
          parent_notified?: boolean
          report_type?: string
          reported_by_name?: string | null
          school_id?: string
          status?: string
          student_id?: string
          teacher_remark?: string | null
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "behavior_reports_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "behavior_reports_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "behavior_reports_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_school_sms_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "behavior_reports_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_tenant_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "behavior_reports_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "behavior_reports_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "behavior_reports_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_account_students: {
        Row: {
          billing_account_id: string
          effective_from: string
          effective_to: string | null
          id: string
          is_primary: boolean
          student_id: string
        }
        Insert: {
          billing_account_id: string
          effective_from?: string
          effective_to?: string | null
          id?: string
          is_primary?: boolean
          student_id: string
        }
        Update: {
          billing_account_id?: string
          effective_from?: string
          effective_to?: string | null
          id?: string
          is_primary?: boolean
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_account_students_billing_account_id_fkey"
            columns: ["billing_account_id"]
            isOneToOne: false
            referencedRelation: "billing_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_account_students_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_accounts: {
        Row: {
          account_no: string
          balance_due: number
          created_at: string
          currency: string
          display_name: string | null
          id: string
          payment_method_refs: Json
          primary_parent_id: string
          school_id: string
          status: Database["public"]["Enums"]["billing_account_status"]
          updated_at: string
        }
        Insert: {
          account_no: string
          balance_due?: number
          created_at?: string
          currency?: string
          display_name?: string | null
          id?: string
          payment_method_refs?: Json
          primary_parent_id: string
          school_id: string
          status?: Database["public"]["Enums"]["billing_account_status"]
          updated_at?: string
        }
        Update: {
          account_no?: string
          balance_due?: number
          created_at?: string
          currency?: string
          display_name?: string | null
          id?: string
          payment_method_refs?: Json
          primary_parent_id?: string
          school_id?: string
          status?: Database["public"]["Enums"]["billing_account_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_accounts_primary_parent_id_fkey"
            columns: ["primary_parent_id"]
            isOneToOne: false
            referencedRelation: "parents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_accounts_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_school_sms_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "billing_accounts_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_tenant_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "billing_accounts_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_allocation_rules: {
        Row: {
          id: string
          is_enabled: boolean
          rule_order: number
          rule_type: string
          school_id: string
        }
        Insert: {
          id?: string
          is_enabled?: boolean
          rule_order: number
          rule_type: string
          school_id: string
        }
        Update: {
          id?: string
          is_enabled?: boolean
          rule_order?: number
          rule_type?: string
          school_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_allocation_rules_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_school_sms_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "billing_allocation_rules_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_tenant_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "billing_allocation_rules_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_invoice_line_items: {
        Row: {
          amount: number
          created_at: string
          description: string
          fee_item_id: string | null
          id: string
          invoice_id: string
          quantity: number
          unit_price: number
        }
        Insert: {
          amount?: number
          created_at?: string
          description: string
          fee_item_id?: string | null
          id?: string
          invoice_id: string
          quantity?: number
          unit_price?: number
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string
          fee_item_id?: string | null
          id?: string
          invoice_id?: string
          quantity?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "billing_invoice_line_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "billing_invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_invoices: {
        Row: {
          amount_paid: number
          balance_due: number | null
          client_id: string | null
          created_at: string
          currency: string
          discount_amount: number
          due_date: string
          id: string
          invoice_number: string
          issued_by: string | null
          notes: string | null
          paid_at: string | null
          school_id: string
          sent_at: string | null
          status: Database["public"]["Enums"]["billing_invoice_status"]
          student_id: string | null
          subtotal: number
          tax_amount: number
          term_id: string | null
          total_amount: number
          updated_at: string
        }
        Insert: {
          amount_paid?: number
          balance_due?: number | null
          client_id?: string | null
          created_at?: string
          currency?: string
          discount_amount?: number
          due_date: string
          id?: string
          invoice_number: string
          issued_by?: string | null
          notes?: string | null
          paid_at?: string | null
          school_id: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["billing_invoice_status"]
          student_id?: string | null
          subtotal?: number
          tax_amount?: number
          term_id?: string | null
          total_amount?: number
          updated_at?: string
        }
        Update: {
          amount_paid?: number
          balance_due?: number | null
          client_id?: string | null
          created_at?: string
          currency?: string
          discount_amount?: number
          due_date?: string
          id?: string
          invoice_number?: string
          issued_by?: string | null
          notes?: string | null
          paid_at?: string | null
          school_id?: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["billing_invoice_status"]
          student_id?: string | null
          subtotal?: number
          tax_amount?: number
          term_id?: string | null
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_invoices_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_school_sms_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "billing_invoices_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_tenant_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "billing_invoices_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_invoices_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_invoices_term_id_fkey"
            columns: ["term_id"]
            isOneToOne: false
            referencedRelation: "terms"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_jobs: {
        Row: {
          academic_term: string
          completed_at: string | null
          created_at: string
          created_by: string | null
          error_message: string | null
          id: string
          job_type: string
          payload: Json
          progress: Json
          school_id: string
          started_at: string | null
          status: Database["public"]["Enums"]["billing_job_status"]
          term_id: string | null
        }
        Insert: {
          academic_term: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          error_message?: string | null
          id?: string
          job_type?: string
          payload?: Json
          progress?: Json
          school_id: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["billing_job_status"]
          term_id?: string | null
        }
        Update: {
          academic_term?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          error_message?: string | null
          id?: string
          job_type?: string
          payload?: Json
          progress?: Json
          school_id?: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["billing_job_status"]
          term_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "billing_jobs_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_school_sms_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "billing_jobs_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_tenant_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "billing_jobs_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_jobs_term_id_fkey"
            columns: ["term_id"]
            isOneToOne: false
            referencedRelation: "terms"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_payments: {
        Row: {
          amount: number
          created_at: string
          currency: string
          gateway: Database["public"]["Enums"]["billing_payment_gateway"]
          gateway_config_id: string | null
          gateway_ref: string | null
          id: string
          invoice_id: string
          metadata: Json
          method: Database["public"]["Enums"]["billing_payment_method"]
          notes: string | null
          paid_at: string | null
          parent_id: string | null
          payer_name: string | null
          payer_role: string | null
          payer_user_id: string | null
          payment_context: string
          paystack_transaction_id: string | null
          receipt_url: string | null
          recorded_by: string | null
          school_id: string
          status: Database["public"]["Enums"]["billing_payment_status"]
          student_id: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          gateway?: Database["public"]["Enums"]["billing_payment_gateway"]
          gateway_config_id?: string | null
          gateway_ref?: string | null
          id?: string
          invoice_id: string
          metadata?: Json
          method?: Database["public"]["Enums"]["billing_payment_method"]
          notes?: string | null
          paid_at?: string | null
          parent_id?: string | null
          payer_name?: string | null
          payer_role?: string | null
          payer_user_id?: string | null
          payment_context?: string
          paystack_transaction_id?: string | null
          receipt_url?: string | null
          recorded_by?: string | null
          school_id: string
          status?: Database["public"]["Enums"]["billing_payment_status"]
          student_id?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          gateway?: Database["public"]["Enums"]["billing_payment_gateway"]
          gateway_config_id?: string | null
          gateway_ref?: string | null
          id?: string
          invoice_id?: string
          metadata?: Json
          method?: Database["public"]["Enums"]["billing_payment_method"]
          notes?: string | null
          paid_at?: string | null
          parent_id?: string | null
          payer_name?: string | null
          payer_role?: string | null
          payer_user_id?: string | null
          payment_context?: string
          paystack_transaction_id?: string | null
          receipt_url?: string | null
          recorded_by?: string | null
          school_id?: string
          status?: Database["public"]["Enums"]["billing_payment_status"]
          student_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_payments_gateway_config_id_fkey"
            columns: ["gateway_config_id"]
            isOneToOne: false
            referencedRelation: "tenant_payment_gateway_configs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "billing_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_payments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "parents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_payments_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_school_sms_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "billing_payments_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_tenant_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "billing_payments_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_payments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_events: {
        Row: {
          academic_year: string | null
          all_day: boolean
          created_at: string
          created_by: string | null
          description: string | null
          end_at: string | null
          event_type: string
          id: string
          is_archived: boolean
          is_published: boolean
          location: string | null
          school_id: string
          semester: string | null
          start_at: string
          status: string
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          academic_year?: string | null
          all_day?: boolean
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_at?: string | null
          event_type?: string
          id?: string
          is_archived?: boolean
          is_published?: boolean
          location?: string | null
          school_id: string
          semester?: string | null
          start_at: string
          status?: string
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          academic_year?: string | null
          all_day?: boolean
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_at?: string | null
          event_type?: string
          id?: string
          is_archived?: boolean
          is_published?: boolean
          location?: string | null
          school_id?: string
          semester?: string | null
          start_at?: string
          status?: string
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "calendar_events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_school_sms_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "calendar_events_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_tenant_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "calendar_events_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      class_grading_config: {
        Row: {
          class_id: string | null
          created_at: string | null
          created_by: string | null
          exam_type_id: string | null
          id: string
          subject_id: string | null
          term: string | null
          weight_percentage: number
        }
        Insert: {
          class_id?: string | null
          created_at?: string | null
          created_by?: string | null
          exam_type_id?: string | null
          id?: string
          subject_id?: string | null
          term?: string | null
          weight_percentage?: number
        }
        Update: {
          class_id?: string | null
          created_at?: string | null
          created_by?: string | null
          exam_type_id?: string | null
          id?: string
          subject_id?: string | null
          term?: string | null
          weight_percentage?: number
        }
        Relationships: [
          {
            foreignKeyName: "class_grading_config_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_grading_config_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "school_classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_grading_config_exam_type_id_fkey"
            columns: ["exam_type_id"]
            isOneToOne: false
            referencedRelation: "exam_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_grading_config_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      class_registers: {
        Row: {
          academic_year_id: string | null
          admin_feedback: string | null
          class_id: string
          created_at: string
          created_by: string | null
          day_of_week: number | null
          homework: string | null
          id: string
          lesson_objectives: string | null
          lesson_summary: string | null
          locked: boolean
          participation_summary: string | null
          period_label: string
          register_date: string
          reviewed_at: string | null
          reviewed_by: string | null
          reviewer_name: string | null
          school_id: string
          session_label: string | null
          status: Database["public"]["Enums"]["class_register_status"]
          subject_id: string
          submitted_at: string | null
          teacher_id: string
          teacher_signature: string | null
          teaching_methods: string | null
          term_id: string | null
          updated_at: string
        }
        Insert: {
          academic_year_id?: string | null
          admin_feedback?: string | null
          class_id: string
          created_at?: string
          created_by?: string | null
          day_of_week?: number | null
          homework?: string | null
          id?: string
          lesson_objectives?: string | null
          lesson_summary?: string | null
          locked?: boolean
          participation_summary?: string | null
          period_label?: string
          register_date: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewer_name?: string | null
          school_id: string
          session_label?: string | null
          status?: Database["public"]["Enums"]["class_register_status"]
          subject_id: string
          submitted_at?: string | null
          teacher_id: string
          teacher_signature?: string | null
          teaching_methods?: string | null
          term_id?: string | null
          updated_at?: string
        }
        Update: {
          academic_year_id?: string | null
          admin_feedback?: string | null
          class_id?: string
          created_at?: string
          created_by?: string | null
          day_of_week?: number | null
          homework?: string | null
          id?: string
          lesson_objectives?: string | null
          lesson_summary?: string | null
          locked?: boolean
          participation_summary?: string | null
          period_label?: string
          register_date?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewer_name?: string | null
          school_id?: string
          session_label?: string | null
          status?: Database["public"]["Enums"]["class_register_status"]
          subject_id?: string
          submitted_at?: string | null
          teacher_id?: string
          teacher_signature?: string | null
          teaching_methods?: string | null
          term_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_registers_academic_year_id_fkey"
            columns: ["academic_year_id"]
            isOneToOne: false
            referencedRelation: "academic_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_registers_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_registers_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "school_classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_registers_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_school_sms_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "class_registers_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_tenant_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "class_registers_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_registers_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_registers_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_registers_term_id_fkey"
            columns: ["term_id"]
            isOneToOne: false
            referencedRelation: "terms"
            referencedColumns: ["id"]
          },
        ]
      }
      class_subjects: {
        Row: {
          class_id: string | null
          id: string
          subject_id: string | null
          teacher_id: string | null
        }
        Insert: {
          class_id?: string | null
          id?: string
          subject_id?: string | null
          teacher_id?: string | null
        }
        Update: {
          class_id?: string | null
          id?: string
          subject_id?: string | null
          teacher_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "class_subjects_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_subjects_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "school_classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_subjects_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_subjects_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      classes: {
        Row: {
          class_teacher_id: string | null
          created_at: string | null
          id: string
          level: string | null
          name: string
          school_id: string | null
          stream: string | null
          updated_at: string
        }
        Insert: {
          class_teacher_id?: string | null
          created_at?: string | null
          id?: string
          level?: string | null
          name: string
          school_id?: string | null
          stream?: string | null
          updated_at?: string
        }
        Update: {
          class_teacher_id?: string | null
          created_at?: string | null
          id?: string
          level?: string | null
          name?: string
          school_id?: string | null
          stream?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "classes_class_teacher_id_fkey"
            columns: ["class_teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classes_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_school_sms_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "classes_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_tenant_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "classes_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          client_type: string
          created_at: string
          email: string | null
          id: string
          metadata: Json
          name: string
          phone: string | null
          school_id: string
          updated_at: string
        }
        Insert: {
          client_type?: string
          created_at?: string
          email?: string | null
          id?: string
          metadata?: Json
          name: string
          phone?: string | null
          school_id: string
          updated_at?: string
        }
        Update: {
          client_type?: string
          created_at?: string
          email?: string | null
          id?: string
          metadata?: Json
          name?: string
          phone?: string | null
          school_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clients_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_school_sms_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "clients_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_tenant_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "clients_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      departments: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          description: string | null
          head_name: string | null
          head_staff_id: string | null
          id: string
          is_archived: boolean
          name: string
          school_id: string
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          head_name?: string | null
          head_staff_id?: string | null
          id?: string
          is_archived?: boolean
          name: string
          school_id: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          head_name?: string | null
          head_staff_id?: string | null
          id?: string
          is_archived?: boolean
          name?: string
          school_id?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "departments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "departments_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_school_sms_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "departments_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_tenant_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "departments_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "departments_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      desktop_sync_records: {
        Row: {
          client_updated_at: string | null
          deleted_at: string | null
          entity: string
          entity_id: string
          id: string
          operation: string
          payload: Json
          school_id: string | null
          synced_by: string | null
          updated_at: string
        }
        Insert: {
          client_updated_at?: string | null
          deleted_at?: string | null
          entity: string
          entity_id: string
          id?: string
          operation?: string
          payload?: Json
          school_id?: string | null
          synced_by?: string | null
          updated_at?: string
        }
        Update: {
          client_updated_at?: string | null
          deleted_at?: string | null
          entity?: string
          entity_id?: string
          id?: string
          operation?: string
          payload?: Json
          school_id?: string | null
          synced_by?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "desktop_sync_records_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_school_sms_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "desktop_sync_records_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_tenant_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "desktop_sync_records_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      enrollments: {
        Row: {
          class_id: string | null
          enrolled_on: string | null
          id: string
          status: string | null
          student_id: string | null
        }
        Insert: {
          class_id?: string | null
          enrolled_on?: string | null
          id?: string
          status?: string | null
          student_id?: string | null
        }
        Update: {
          class_id?: string | null
          enrolled_on?: string | null
          id?: string
          status?: string | null
          student_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "enrollments_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "school_classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      exam_attendance: {
        Row: {
          exam_id: string | null
          id: string
          recorded_at: string | null
          recorded_by: string | null
          status: string
          student_id: string | null
        }
        Insert: {
          exam_id?: string | null
          id?: string
          recorded_at?: string | null
          recorded_by?: string | null
          status?: string
          student_id?: string | null
        }
        Update: {
          exam_id?: string | null
          id?: string
          recorded_at?: string | null
          recorded_by?: string | null
          status?: string
          student_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "exam_attendance_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "exams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_attendance_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      exam_proctoring_logs: {
        Row: {
          attempt_id: string | null
          created_at: string | null
          description: string | null
          id: string
          snapshot_url: string | null
          student_id: string | null
          violation_type: string
        }
        Insert: {
          attempt_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          snapshot_url?: string | null
          student_id?: string | null
          violation_type: string
        }
        Update: {
          attempt_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          snapshot_url?: string | null
          student_id?: string | null
          violation_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "exam_proctoring_logs_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "online_exam_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_proctoring_logs_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      exam_results: {
        Row: {
          exam_id: string
          grade: string | null
          id: string
          marks_obtained: number | null
          recorded_at: string | null
          recorded_by: string | null
          remarks: string | null
          student_id: string
        }
        Insert: {
          exam_id: string
          grade?: string | null
          id?: string
          marks_obtained?: number | null
          recorded_at?: string | null
          recorded_by?: string | null
          remarks?: string | null
          student_id: string
        }
        Update: {
          exam_id?: string
          grade?: string | null
          id?: string
          marks_obtained?: number | null
          recorded_at?: string | null
          recorded_by?: string | null
          remarks?: string | null
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "exam_results_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "exams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_results_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      exam_summary_reports: {
        Row: {
          average_score: number | null
          created_by: string | null
          generated_at: string | null
          grade_distribution: Json | null
          highest_score: number | null
          id: string
          lowest_score: number | null
          online_exam_id: string | null
          question_analytics: Json | null
          students_attempted: number | null
          students_passed: number | null
          total_students: number | null
        }
        Insert: {
          average_score?: number | null
          created_by?: string | null
          generated_at?: string | null
          grade_distribution?: Json | null
          highest_score?: number | null
          id?: string
          lowest_score?: number | null
          online_exam_id?: string | null
          question_analytics?: Json | null
          students_attempted?: number | null
          students_passed?: number | null
          total_students?: number | null
        }
        Update: {
          average_score?: number | null
          created_by?: string | null
          generated_at?: string | null
          grade_distribution?: Json | null
          highest_score?: number | null
          id?: string
          lowest_score?: number | null
          online_exam_id?: string | null
          question_analytics?: Json | null
          students_attempted?: number | null
          students_passed?: number | null
          total_students?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "exam_summary_reports_online_exam_id_fkey"
            columns: ["online_exam_id"]
            isOneToOne: false
            referencedRelation: "online_exams"
            referencedColumns: ["id"]
          },
        ]
      }
      exam_time_extensions: {
        Row: {
          attempt_id: string
          created_at: string
          extended_by: string
          extension_minutes: number
          id: string
          reason: string | null
        }
        Insert: {
          attempt_id: string
          created_at?: string
          extended_by: string
          extension_minutes?: number
          id?: string
          reason?: string | null
        }
        Update: {
          attempt_id?: string
          created_at?: string
          extended_by?: string
          extension_minutes?: number
          id?: string
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "exam_time_extensions_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "online_exam_attempts"
            referencedColumns: ["id"]
          },
        ]
      }
      exam_types: {
        Row: {
          category: string
          created_at: string | null
          description: string | null
          id: string
          name: string
          school_id: string | null
        }
        Insert: {
          category?: string
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          school_id?: string | null
        }
        Update: {
          category?: string
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          school_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "exam_types_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_school_sms_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "exam_types_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_tenant_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "exam_types_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      exams: {
        Row: {
          class_id: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          duration_minutes: number
          exam_date: string
          exam_type_id: string | null
          id: string
          subject_id: string | null
          term: string | null
          title: string
          total_marks: number
        }
        Insert: {
          class_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          duration_minutes: number
          exam_date: string
          exam_type_id?: string | null
          id?: string
          subject_id?: string | null
          term?: string | null
          title: string
          total_marks: number
        }
        Update: {
          class_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          duration_minutes?: number
          exam_date?: string
          exam_type_id?: string | null
          id?: string
          subject_id?: string | null
          term?: string | null
          title?: string
          total_marks?: number
        }
        Relationships: [
          {
            foreignKeyName: "exams_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exams_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "school_classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exams_exam_type_id_fkey"
            columns: ["exam_type_id"]
            isOneToOne: false
            referencedRelation: "exam_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exams_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      exeats: {
        Row: {
          actual_checkin_at: string | null
          actual_checkout_at: string | null
          approval_status: string
          approved_at: string | null
          approved_by: string | null
          created_at: string
          created_by: string | null
          departure_at: string
          destination: string | null
          exeat_type: string
          guardian_approved: boolean
          id: string
          is_archived: boolean
          notes: string | null
          parent_approved: boolean
          qr_code: string | null
          reason: string
          return_at: string | null
          school_id: string
          student_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          actual_checkin_at?: string | null
          actual_checkout_at?: string | null
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          departure_at: string
          destination?: string | null
          exeat_type?: string
          guardian_approved?: boolean
          id?: string
          is_archived?: boolean
          notes?: string | null
          parent_approved?: boolean
          qr_code?: string | null
          reason: string
          return_at?: string | null
          school_id: string
          student_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          actual_checkin_at?: string | null
          actual_checkout_at?: string | null
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          departure_at?: string
          destination?: string | null
          exeat_type?: string
          guardian_approved?: boolean
          id?: string
          is_archived?: boolean
          notes?: string | null
          parent_approved?: boolean
          qr_code?: string | null
          reason?: string
          return_at?: string | null
          school_id?: string
          student_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "exeats_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exeats_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exeats_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_school_sms_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "exeats_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_tenant_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "exeats_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exeats_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exeats_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      fee_assignments: {
        Row: {
          class_id: string | null
          created_at: string
          fee_item_id: string
          id: string
          school_id: string
          student_id: string | null
          updated_at: string
        }
        Insert: {
          class_id?: string | null
          created_at?: string
          fee_item_id: string
          id?: string
          school_id: string
          student_id?: string | null
          updated_at?: string
        }
        Update: {
          class_id?: string | null
          created_at?: string
          fee_item_id?: string
          id?: string
          school_id?: string
          student_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fee_assignments_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fee_assignments_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "school_classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fee_assignments_fee_item_id_fkey"
            columns: ["fee_item_id"]
            isOneToOne: false
            referencedRelation: "fee_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fee_assignments_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_school_sms_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "fee_assignments_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_tenant_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "fee_assignments_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fee_assignments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      fee_categories: {
        Row: {
          code: string | null
          created_at: string
          default_priority: number
          description: string | null
          id: string
          is_active: boolean
          is_optional: boolean
          name: string
          school_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          code?: string | null
          created_at?: string
          default_priority?: number
          description?: string | null
          id?: string
          is_active?: boolean
          is_optional?: boolean
          name: string
          school_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          code?: string | null
          created_at?: string
          default_priority?: number
          description?: string | null
          id?: string
          is_active?: boolean
          is_optional?: boolean
          name?: string
          school_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fee_categories_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_school_sms_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "fee_categories_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_tenant_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "fee_categories_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      fee_items: {
        Row: {
          amount: number
          category_id: string
          created_at: string
          currency: string
          id: string
          school_id: string
          term_id: string
          updated_at: string
        }
        Insert: {
          amount: number
          category_id: string
          created_at?: string
          currency?: string
          id?: string
          school_id: string
          term_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          category_id?: string
          created_at?: string
          currency?: string
          id?: string
          school_id?: string
          term_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fee_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "fee_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fee_items_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_school_sms_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "fee_items_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_tenant_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "fee_items_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fee_items_term_id_fkey"
            columns: ["term_id"]
            isOneToOne: false
            referencedRelation: "terms"
            referencedColumns: ["id"]
          },
        ]
      }
      fee_structures: {
        Row: {
          amount: number
          created_at: string | null
          description: string | null
          id: string
          name: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      fee_templates: {
        Row: {
          academic_term: string
          amount: number
          class_id: string | null
          created_at: string
          due_day_of_month: number | null
          fee_category_id: string
          id: string
          is_active: boolean
          name: string
          school_id: string
          scope: Database["public"]["Enums"]["fee_scope"]
          student_id: string | null
          term_id: string | null
          updated_at: string
        }
        Insert: {
          academic_term: string
          amount: number
          class_id?: string | null
          created_at?: string
          due_day_of_month?: number | null
          fee_category_id: string
          id?: string
          is_active?: boolean
          name: string
          school_id: string
          scope: Database["public"]["Enums"]["fee_scope"]
          student_id?: string | null
          term_id?: string | null
          updated_at?: string
        }
        Update: {
          academic_term?: string
          amount?: number
          class_id?: string | null
          created_at?: string
          due_day_of_month?: number | null
          fee_category_id?: string
          id?: string
          is_active?: boolean
          name?: string
          school_id?: string
          scope?: Database["public"]["Enums"]["fee_scope"]
          student_id?: string | null
          term_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fee_templates_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fee_templates_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "school_classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fee_templates_fee_category_id_fkey"
            columns: ["fee_category_id"]
            isOneToOne: false
            referencedRelation: "fee_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fee_templates_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_school_sms_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "fee_templates_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_tenant_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "fee_templates_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fee_templates_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fee_templates_term_id_fkey"
            columns: ["term_id"]
            isOneToOne: false
            referencedRelation: "terms"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_budgets: {
        Row: {
          academic_year: string | null
          approved_at: string | null
          approved_by: string | null
          created_at: string
          created_by: string | null
          department: string | null
          id: string
          is_archived: boolean
          name: string
          notes: string | null
          planned_amount: number
          school_id: string
          spent_amount: number
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          academic_year?: string | null
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          department?: string | null
          id?: string
          is_archived?: boolean
          name: string
          notes?: string | null
          planned_amount?: number
          school_id: string
          spent_amount?: number
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          academic_year?: string | null
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          department?: string | null
          id?: string
          is_archived?: boolean
          name?: string
          notes?: string | null
          planned_amount?: number
          school_id?: string
          spent_amount?: number
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "finance_budgets_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_budgets_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_budgets_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_school_sms_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "finance_budgets_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_tenant_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "finance_budgets_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_budgets_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_expenses: {
        Row: {
          amount: number
          approved_at: string | null
          approved_by: string | null
          budget_id: string | null
          category: string
          created_at: string
          created_by: string | null
          department: string | null
          expense_date: string
          id: string
          is_archived: boolean
          is_recurring: boolean
          notes: string | null
          payment_method: string | null
          receipt_url: string | null
          school_id: string
          status: string
          supplier: string | null
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          amount: number
          approved_at?: string | null
          approved_by?: string | null
          budget_id?: string | null
          category: string
          created_at?: string
          created_by?: string | null
          department?: string | null
          expense_date?: string
          id?: string
          is_archived?: boolean
          is_recurring?: boolean
          notes?: string | null
          payment_method?: string | null
          receipt_url?: string | null
          school_id: string
          status?: string
          supplier?: string | null
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          amount?: number
          approved_at?: string | null
          approved_by?: string | null
          budget_id?: string | null
          category?: string
          created_at?: string
          created_by?: string | null
          department?: string | null
          expense_date?: string
          id?: string
          is_archived?: boolean
          is_recurring?: boolean
          notes?: string | null
          payment_method?: string | null
          receipt_url?: string | null
          school_id?: string
          status?: string
          supplier?: string | null
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "finance_expenses_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_expenses_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_expenses_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_school_sms_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "finance_expenses_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_tenant_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "finance_expenses_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_expenses_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_other_income: {
        Row: {
          amount: number
          attachment_url: string | null
          created_at: string
          created_by: string | null
          id: string
          income_date: string
          income_type: string
          is_archived: boolean
          notes: string | null
          school_id: string
          source_name: string | null
          status: string
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          amount: number
          attachment_url?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          income_date?: string
          income_type?: string
          is_archived?: boolean
          notes?: string | null
          school_id: string
          source_name?: string | null
          status?: string
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          amount?: number
          attachment_url?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          income_date?: string
          income_type?: string
          is_archived?: boolean
          notes?: string | null
          school_id?: string
          source_name?: string | null
          status?: string
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "finance_other_income_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_other_income_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_school_sms_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "finance_other_income_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_tenant_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "finance_other_income_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_other_income_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_audit_log: {
        Row: {
          action: string
          actor_user_id: string | null
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          metadata: Json
          new_balance: number | null
          old_balance: number | null
          school_id: string
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          metadata?: Json
          new_balance?: number | null
          old_balance?: number | null
          school_id: string
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          metadata?: Json
          new_balance?: number | null
          old_balance?: number | null
          school_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_audit_log_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_school_sms_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "financial_audit_log_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_tenant_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "financial_audit_log_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      google_workspace_connections: {
        Row: {
          access_token: string
          connected_at: string
          connected_by: string | null
          google_account_id: string
          google_email: string
          id: string
          refresh_token: string | null
          school_id: string
          scopes: string[] | null
          token_expires_at: string | null
          updated_at: string
        }
        Insert: {
          access_token: string
          connected_at?: string
          connected_by?: string | null
          google_account_id: string
          google_email: string
          id?: string
          refresh_token?: string | null
          school_id: string
          scopes?: string[] | null
          token_expires_at?: string | null
          updated_at?: string
        }
        Update: {
          access_token?: string
          connected_at?: string
          connected_by?: string | null
          google_account_id?: string
          google_email?: string
          id?: string
          refresh_token?: string | null
          school_id?: string
          scopes?: string[] | null
          token_expires_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "google_workspace_connections_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: true
            referencedRelation: "platform_school_sms_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "google_workspace_connections_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: true
            referencedRelation: "platform_tenant_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "google_workspace_connections_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: true
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      grade_scales: {
        Row: {
          created_at: string | null
          grade: string
          grade_point: number | null
          id: string
          max_score: number
          min_score: number
          name: string
          school_id: string | null
        }
        Insert: {
          created_at?: string | null
          grade: string
          grade_point?: number | null
          id?: string
          max_score: number
          min_score: number
          name: string
          school_id?: string | null
        }
        Update: {
          created_at?: string | null
          grade?: string
          grade_point?: number | null
          id?: string
          max_score?: number
          min_score?: number
          name?: string
          school_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "grade_scales_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_school_sms_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "grade_scales_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_tenant_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "grade_scales_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      grades: {
        Row: {
          created_at: string | null
          id: string
          score: number | null
          student_id: string | null
          subject_id: string | null
          term: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          score?: number | null
          student_id?: string | null
          subject_id?: string | null
          term?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          score?: number | null
          student_id?: string | null
          subject_id?: string | null
          term?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "grades_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grades_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      hostel_allocations: {
        Row: {
          actual_check_out_date: string | null
          allocation_status: string
          amount_paid: number
          assigned_by: string | null
          bed_id: string | null
          block_id: string
          check_in_date: string
          created_at: string
          expected_check_out_date: string | null
          fee_amount: number
          id: string
          notes: string | null
          payment_status: string
          room_id: string
          school_id: string
          student_id: string
          updated_at: string
        }
        Insert: {
          actual_check_out_date?: string | null
          allocation_status?: string
          amount_paid?: number
          assigned_by?: string | null
          bed_id?: string | null
          block_id: string
          check_in_date?: string
          created_at?: string
          expected_check_out_date?: string | null
          fee_amount?: number
          id?: string
          notes?: string | null
          payment_status?: string
          room_id: string
          school_id: string
          student_id: string
          updated_at?: string
        }
        Update: {
          actual_check_out_date?: string | null
          allocation_status?: string
          amount_paid?: number
          assigned_by?: string | null
          bed_id?: string | null
          block_id?: string
          check_in_date?: string
          created_at?: string
          expected_check_out_date?: string | null
          fee_amount?: number
          id?: string
          notes?: string | null
          payment_status?: string
          room_id?: string
          school_id?: string
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hostel_allocations_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hostel_allocations_bed_id_fkey"
            columns: ["bed_id"]
            isOneToOne: false
            referencedRelation: "hostel_beds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hostel_allocations_block_id_fkey"
            columns: ["block_id"]
            isOneToOne: false
            referencedRelation: "hostel_blocks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hostel_allocations_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "hostel_rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hostel_allocations_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_school_sms_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "hostel_allocations_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_tenant_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "hostel_allocations_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hostel_allocations_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      hostel_beds: {
        Row: {
          bed_number: string
          created_at: string
          id: string
          room_id: string
          school_id: string
          status: string
          updated_at: string
        }
        Insert: {
          bed_number: string
          created_at?: string
          id?: string
          room_id: string
          school_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          bed_number?: string
          created_at?: string
          id?: string
          room_id?: string
          school_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hostel_beds_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "hostel_rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hostel_beds_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_school_sms_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "hostel_beds_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_tenant_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "hostel_beds_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      hostel_blocks: {
        Row: {
          capacity: number | null
          created_at: string
          description: string | null
          gender: string | null
          hostel_type: string | null
          id: string
          name: string
          school_id: string
          status: string
          updated_at: string
          warden_name: string | null
          warden_phone: string | null
          warden_teacher_id: string | null
        }
        Insert: {
          capacity?: number | null
          created_at?: string
          description?: string | null
          gender?: string | null
          hostel_type?: string | null
          id?: string
          name: string
          school_id: string
          status?: string
          updated_at?: string
          warden_name?: string | null
          warden_phone?: string | null
          warden_teacher_id?: string | null
        }
        Update: {
          capacity?: number | null
          created_at?: string
          description?: string | null
          gender?: string | null
          hostel_type?: string | null
          id?: string
          name?: string
          school_id?: string
          status?: string
          updated_at?: string
          warden_name?: string | null
          warden_phone?: string | null
          warden_teacher_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hostel_blocks_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_school_sms_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "hostel_blocks_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_tenant_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "hostel_blocks_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hostel_blocks_warden_teacher_id_fkey"
            columns: ["warden_teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      hostel_payments: {
        Row: {
          allocation_id: string
          amount: number
          created_at: string
          id: string
          notes: string | null
          payment_date: string
          payment_method: string
          receipt_number: string | null
          recorded_by: string | null
          school_id: string
          student_id: string
        }
        Insert: {
          allocation_id: string
          amount: number
          created_at?: string
          id?: string
          notes?: string | null
          payment_date?: string
          payment_method?: string
          receipt_number?: string | null
          recorded_by?: string | null
          school_id: string
          student_id: string
        }
        Update: {
          allocation_id?: string
          amount?: number
          created_at?: string
          id?: string
          notes?: string | null
          payment_date?: string
          payment_method?: string
          receipt_number?: string | null
          recorded_by?: string | null
          school_id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hostel_payments_allocation_id_fkey"
            columns: ["allocation_id"]
            isOneToOne: false
            referencedRelation: "hostel_allocations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hostel_payments_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hostel_payments_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_school_sms_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "hostel_payments_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_tenant_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "hostel_payments_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hostel_payments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      hostel_rooms: {
        Row: {
          block_id: string
          capacity: number
          created_at: string
          floor: string | null
          gender: string | null
          id: string
          monthly_fee: number
          occupied: number
          room_number: string
          room_status: string
          room_type: string
          school_id: string
          term_fee: number
          updated_at: string
          wing: string | null
        }
        Insert: {
          block_id: string
          capacity?: number
          created_at?: string
          floor?: string | null
          gender?: string | null
          id?: string
          monthly_fee?: number
          occupied?: number
          room_number: string
          room_status?: string
          room_type?: string
          school_id: string
          term_fee?: number
          updated_at?: string
          wing?: string | null
        }
        Update: {
          block_id?: string
          capacity?: number
          created_at?: string
          floor?: string | null
          gender?: string | null
          id?: string
          monthly_fee?: number
          occupied?: number
          room_number?: string
          room_status?: string
          room_type?: string
          school_id?: string
          term_fee?: number
          updated_at?: string
          wing?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hostel_rooms_block_id_fkey"
            columns: ["block_id"]
            isOneToOne: false
            referencedRelation: "hostel_blocks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hostel_rooms_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_school_sms_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "hostel_rooms_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_tenant_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "hostel_rooms_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      hr_leave_requests: {
        Row: {
          created_at: string
          end_date: string
          id: string
          leave_type: string
          reason: string | null
          school_id: string
          staff_user_id: string
          start_date: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          end_date: string
          id?: string
          leave_type?: string
          reason?: string | null
          school_id: string
          staff_user_id: string
          start_date: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          end_date?: string
          id?: string
          leave_type?: string
          reason?: string | null
          school_id?: string
          staff_user_id?: string
          start_date?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hr_leave_requests_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_school_sms_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "hr_leave_requests_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_tenant_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "hr_leave_requests_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_leave_requests_staff_user_id_fkey"
            columns: ["staff_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      hr_staff_attendance: {
        Row: {
          attendance_date: string
          check_in: string | null
          check_out: string | null
          created_at: string
          id: string
          notes: string | null
          school_id: string
          staff_user_id: string
          status: string
        }
        Insert: {
          attendance_date: string
          check_in?: string | null
          check_out?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          school_id: string
          staff_user_id: string
          status?: string
        }
        Update: {
          attendance_date?: string
          check_in?: string | null
          check_out?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          school_id?: string
          staff_user_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "hr_staff_attendance_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_school_sms_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "hr_staff_attendance_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_tenant_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "hr_staff_attendance_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_staff_attendance_staff_user_id_fkey"
            columns: ["staff_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_assets: {
        Row: {
          asset_code: string
          asset_condition: string
          asset_status: string
          assigned_class_id: string | null
          assigned_department: string | null
          assigned_staff_id: string | null
          barcode: string | null
          category: string | null
          created_at: string
          current_value: number
          id: string
          last_maintenance_date: string | null
          maintenance_schedule: string | null
          name: string
          next_maintenance_date: string | null
          notes: string | null
          purchase_cost: number
          purchase_date: string | null
          school_id: string
          serial_number: string | null
          updated_at: string
          warranty_info: string | null
        }
        Insert: {
          asset_code: string
          asset_condition?: string
          asset_status?: string
          assigned_class_id?: string | null
          assigned_department?: string | null
          assigned_staff_id?: string | null
          barcode?: string | null
          category?: string | null
          created_at?: string
          current_value?: number
          id?: string
          last_maintenance_date?: string | null
          maintenance_schedule?: string | null
          name: string
          next_maintenance_date?: string | null
          notes?: string | null
          purchase_cost?: number
          purchase_date?: string | null
          school_id: string
          serial_number?: string | null
          updated_at?: string
          warranty_info?: string | null
        }
        Update: {
          asset_code?: string
          asset_condition?: string
          asset_status?: string
          assigned_class_id?: string | null
          assigned_department?: string | null
          assigned_staff_id?: string | null
          barcode?: string | null
          category?: string | null
          created_at?: string
          current_value?: number
          id?: string
          last_maintenance_date?: string | null
          maintenance_schedule?: string | null
          name?: string
          next_maintenance_date?: string | null
          notes?: string | null
          purchase_cost?: number
          purchase_date?: string | null
          school_id?: string
          serial_number?: string | null
          updated_at?: string
          warranty_info?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_assets_assigned_class_id_fkey"
            columns: ["assigned_class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_assets_assigned_class_id_fkey"
            columns: ["assigned_class_id"]
            isOneToOne: false
            referencedRelation: "school_classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_assets_assigned_staff_id_fkey"
            columns: ["assigned_staff_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_assets_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_school_sms_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "inventory_assets_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_tenant_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "inventory_assets_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_issuances: {
        Row: {
          approved_by: string | null
          class_or_department: string | null
          created_at: string
          expected_return_date: string | null
          id: string
          issue_date: string
          issued_by: string | null
          item_id: string
          quantity: number
          recipient_name: string
          recipient_ref: string | null
          recipient_type: string
          remarks: string | null
          return_date: string | null
          school_id: string
          status: string
          updated_at: string
        }
        Insert: {
          approved_by?: string | null
          class_or_department?: string | null
          created_at?: string
          expected_return_date?: string | null
          id?: string
          issue_date?: string
          issued_by?: string | null
          item_id: string
          quantity: number
          recipient_name: string
          recipient_ref?: string | null
          recipient_type: string
          remarks?: string | null
          return_date?: string | null
          school_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          approved_by?: string | null
          class_or_department?: string | null
          created_at?: string
          expected_return_date?: string | null
          id?: string
          issue_date?: string
          issued_by?: string | null
          item_id?: string
          quantity?: number
          recipient_name?: string
          recipient_ref?: string | null
          recipient_type?: string
          remarks?: string | null
          return_date?: string | null
          school_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_issuances_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_issuances_issued_by_fkey"
            columns: ["issued_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_issuances_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_issuances_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_school_sms_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "inventory_issuances_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_tenant_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "inventory_issuances_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_items: {
        Row: {
          barcode: string | null
          brand: string | null
          category: string | null
          created_at: string
          description: string | null
          id: string
          is_archived: boolean
          item_status: string
          location: string | null
          max_stock_level: number | null
          name: string
          quantity: number
          reorder_level: number | null
          school_id: string
          sku: string | null
          subcategory: string | null
          supplier_id: string | null
          unit: string | null
          unit_cost: number
          updated_at: string
        }
        Insert: {
          barcode?: string | null
          brand?: string | null
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_archived?: boolean
          item_status?: string
          location?: string | null
          max_stock_level?: number | null
          name: string
          quantity?: number
          reorder_level?: number | null
          school_id: string
          sku?: string | null
          subcategory?: string | null
          supplier_id?: string | null
          unit?: string | null
          unit_cost?: number
          updated_at?: string
        }
        Update: {
          barcode?: string | null
          brand?: string | null
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_archived?: boolean
          item_status?: string
          location?: string | null
          max_stock_level?: number | null
          name?: string
          quantity?: number
          reorder_level?: number | null
          school_id?: string
          sku?: string | null
          subcategory?: string | null
          supplier_id?: string | null
          unit?: string | null
          unit_cost?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_items_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_school_sms_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "inventory_items_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_tenant_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "inventory_items_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_items_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "inventory_suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_purchase_order_lines: {
        Row: {
          id: string
          item_id: string | null
          item_name: string
          line_total: number
          purchase_order_id: string
          quantity: number
          school_id: string
          unit_price: number
        }
        Insert: {
          id?: string
          item_id?: string | null
          item_name: string
          line_total?: number
          purchase_order_id: string
          quantity?: number
          school_id: string
          unit_price?: number
        }
        Update: {
          id?: string
          item_id?: string | null
          item_name?: string
          line_total?: number
          purchase_order_id?: string
          quantity?: number
          school_id?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "inventory_purchase_order_lines_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_purchase_order_lines_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "inventory_purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_purchase_order_lines_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_school_sms_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "inventory_purchase_order_lines_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_tenant_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "inventory_purchase_order_lines_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_purchase_orders: {
        Row: {
          created_at: string
          created_by: string | null
          delivery_status: string
          expected_delivery_date: string | null
          id: string
          invoice_number: string | null
          notes: string | null
          payment_status: string
          po_number: string
          purchase_date: string
          receipt_url: string | null
          school_id: string
          supplier_id: string | null
          total_cost: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          delivery_status?: string
          expected_delivery_date?: string | null
          id?: string
          invoice_number?: string | null
          notes?: string | null
          payment_status?: string
          po_number: string
          purchase_date?: string
          receipt_url?: string | null
          school_id: string
          supplier_id?: string | null
          total_cost?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          delivery_status?: string
          expected_delivery_date?: string | null
          id?: string
          invoice_number?: string | null
          notes?: string | null
          payment_status?: string
          po_number?: string
          purchase_date?: string
          receipt_url?: string | null
          school_id?: string
          supplier_id?: string | null
          total_cost?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_purchase_orders_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_purchase_orders_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_school_sms_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "inventory_purchase_orders_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_tenant_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "inventory_purchase_orders_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_purchase_orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "inventory_suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_stock_movements: {
        Row: {
          approved_by: string | null
          created_at: string
          current_stock: number
          department: string | null
          id: string
          item_id: string
          previous_stock: number
          quantity: number
          remarks: string | null
          requested_by: string | null
          school_id: string
          source_destination: string | null
          transaction_type: string
        }
        Insert: {
          approved_by?: string | null
          created_at?: string
          current_stock?: number
          department?: string | null
          id?: string
          item_id: string
          previous_stock?: number
          quantity: number
          remarks?: string | null
          requested_by?: string | null
          school_id: string
          source_destination?: string | null
          transaction_type: string
        }
        Update: {
          approved_by?: string | null
          created_at?: string
          current_stock?: number
          department?: string | null
          id?: string
          item_id?: string
          previous_stock?: number
          quantity?: number
          remarks?: string | null
          requested_by?: string | null
          school_id?: string
          source_destination?: string | null
          transaction_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_stock_movements_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_stock_movements_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_stock_movements_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_stock_movements_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_school_sms_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "inventory_stock_movements_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_tenant_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "inventory_stock_movements_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_suppliers: {
        Row: {
          address: string | null
          company_name: string | null
          contact_person: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          payment_terms: string | null
          phone: string | null
          products_supplied: string | null
          school_id: string
          status: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          company_name?: string | null
          contact_person?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          payment_terms?: string | null
          phone?: string | null
          products_supplied?: string | null
          school_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          company_name?: string | null
          contact_person?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          payment_terms?: string | null
          phone?: string | null
          products_supplied?: string | null
          school_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_suppliers_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_school_sms_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "inventory_suppliers_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_tenant_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "inventory_suppliers_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount: number
          created_at: string | null
          due_date: string | null
          fee_structure_id: string | null
          id: string
          invoice_no: string | null
          status: string | null
          student_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          due_date?: string | null
          fee_structure_id?: string | null
          id?: string
          invoice_no?: string | null
          status?: string | null
          student_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          due_date?: string | null
          fee_structure_id?: string | null
          id?: string
          invoice_no?: string | null
          status?: string | null
          student_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_fee_structure_id_fkey"
            columns: ["fee_structure_id"]
            isOneToOne: false
            referencedRelation: "fee_structures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      lab_bookings: {
        Row: {
          attendance_count: number | null
          booked_by_name: string | null
          class_name: string | null
          created_at: string
          created_by: string | null
          end_at: string
          facility_id: string
          id: string
          is_archived: boolean
          purpose: string | null
          school_id: string
          start_at: string
          status: string
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          attendance_count?: number | null
          booked_by_name?: string | null
          class_name?: string | null
          created_at?: string
          created_by?: string | null
          end_at: string
          facility_id: string
          id?: string
          is_archived?: boolean
          purpose?: string | null
          school_id: string
          start_at: string
          status?: string
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          attendance_count?: number | null
          booked_by_name?: string | null
          class_name?: string | null
          created_at?: string
          created_by?: string | null
          end_at?: string
          facility_id?: string
          id?: string
          is_archived?: boolean
          purpose?: string | null
          school_id?: string
          start_at?: string
          status?: string
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lab_bookings_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lab_bookings_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "lab_facilities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lab_bookings_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_school_sms_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "lab_bookings_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_tenant_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "lab_bookings_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lab_bookings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lab_equipment: {
        Row: {
          asset_tag: string | null
          condition: string
          created_at: string
          created_by: string | null
          facility_id: string | null
          id: string
          is_archived: boolean
          is_consumable: boolean
          name: string
          notes: string | null
          quantity: number
          school_id: string
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          asset_tag?: string | null
          condition?: string
          created_at?: string
          created_by?: string | null
          facility_id?: string | null
          id?: string
          is_archived?: boolean
          is_consumable?: boolean
          name: string
          notes?: string | null
          quantity?: number
          school_id: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          asset_tag?: string | null
          condition?: string
          created_at?: string
          created_by?: string | null
          facility_id?: string | null
          id?: string
          is_archived?: boolean
          is_consumable?: boolean
          name?: string
          notes?: string | null
          quantity?: number
          school_id?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lab_equipment_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lab_equipment_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "lab_facilities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lab_equipment_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_school_sms_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "lab_equipment_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_tenant_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "lab_equipment_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lab_equipment_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lab_facilities: {
        Row: {
          capacity: number | null
          created_at: string
          created_by: string | null
          id: string
          is_archived: boolean
          lab_type: string
          location: string | null
          name: string
          safety_notes: string | null
          school_id: string
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          capacity?: number | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_archived?: boolean
          lab_type?: string
          location?: string | null
          name: string
          safety_notes?: string | null
          school_id: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          capacity?: number | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_archived?: boolean
          lab_type?: string
          location?: string | null
          name?: string
          safety_notes?: string | null
          school_id?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lab_facilities_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lab_facilities_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_school_sms_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "lab_facilities_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_tenant_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "lab_facilities_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lab_facilities_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_note_attachments: {
        Row: {
          created_at: string
          file_name: string
          file_size: number | null
          file_type: string | null
          file_url: string
          id: string
          lesson_note_id: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          file_name: string
          file_size?: number | null
          file_type?: string | null
          file_url: string
          id?: string
          lesson_note_id: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          file_name?: string
          file_size?: number | null
          file_type?: string | null
          file_url?: string
          id?: string
          lesson_note_id?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lesson_note_attachments_lesson_note_id_fkey"
            columns: ["lesson_note_id"]
            isOneToOne: false
            referencedRelation: "lesson_notes"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_note_comments: {
        Row: {
          author_name: string | null
          author_role: string | null
          author_user_id: string
          body: string
          created_at: string
          id: string
          lesson_note_id: string
        }
        Insert: {
          author_name?: string | null
          author_role?: string | null
          author_user_id: string
          body: string
          created_at?: string
          id?: string
          lesson_note_id: string
        }
        Update: {
          author_name?: string | null
          author_role?: string | null
          author_user_id?: string
          body?: string
          created_at?: string
          id?: string
          lesson_note_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_note_comments_lesson_note_id_fkey"
            columns: ["lesson_note_id"]
            isOneToOne: false
            referencedRelation: "lesson_notes"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_note_status_logs: {
        Row: {
          actor_name: string | null
          actor_user_id: string | null
          comment: string | null
          created_at: string
          from_status: Database["public"]["Enums"]["lesson_note_status"] | null
          id: string
          lesson_note_id: string
          school_id: string
          to_status: Database["public"]["Enums"]["lesson_note_status"]
        }
        Insert: {
          actor_name?: string | null
          actor_user_id?: string | null
          comment?: string | null
          created_at?: string
          from_status?: Database["public"]["Enums"]["lesson_note_status"] | null
          id?: string
          lesson_note_id: string
          school_id: string
          to_status: Database["public"]["Enums"]["lesson_note_status"]
        }
        Update: {
          actor_name?: string | null
          actor_user_id?: string | null
          comment?: string | null
          created_at?: string
          from_status?: Database["public"]["Enums"]["lesson_note_status"] | null
          id?: string
          lesson_note_id?: string
          school_id?: string
          to_status?: Database["public"]["Enums"]["lesson_note_status"]
        }
        Relationships: [
          {
            foreignKeyName: "lesson_note_status_logs_lesson_note_id_fkey"
            columns: ["lesson_note_id"]
            isOneToOne: false
            referencedRelation: "lesson_notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_note_status_logs_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_school_sms_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "lesson_note_status_logs_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_tenant_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "lesson_note_status_logs_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_note_versions: {
        Row: {
          id: string
          lesson_note_id: string
          snapshot: Json
          submitted_at: string
          submitted_by: string | null
          version_number: number
        }
        Insert: {
          id?: string
          lesson_note_id: string
          snapshot: Json
          submitted_at?: string
          submitted_by?: string | null
          version_number: number
        }
        Update: {
          id?: string
          lesson_note_id?: string
          snapshot?: Json
          submitted_at?: string
          submitted_by?: string | null
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "lesson_note_versions_lesson_note_id_fkey"
            columns: ["lesson_note_id"]
            isOneToOne: false
            referencedRelation: "lesson_notes"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_notes: {
        Row: {
          academic_year_id: string | null
          admin_feedback: string | null
          class_id: string
          content: Json
          created_at: string
          day_of_week: string
          id: string
          lesson_date: string
          reviewed_at: string | null
          reviewed_by: string | null
          reviewer_name: string | null
          school_id: string
          session_label: string | null
          status: Database["public"]["Enums"]["lesson_note_status"]
          sub_topic: string | null
          subject_id: string
          submitted_at: string | null
          teacher_id: string
          teacher_name: string | null
          term_id: string | null
          topic: string
          updated_at: string
          version_number: number
          week_number: number
        }
        Insert: {
          academic_year_id?: string | null
          admin_feedback?: string | null
          class_id: string
          content?: Json
          created_at?: string
          day_of_week: string
          id?: string
          lesson_date: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewer_name?: string | null
          school_id: string
          session_label?: string | null
          status?: Database["public"]["Enums"]["lesson_note_status"]
          sub_topic?: string | null
          subject_id: string
          submitted_at?: string | null
          teacher_id: string
          teacher_name?: string | null
          term_id?: string | null
          topic?: string
          updated_at?: string
          version_number?: number
          week_number: number
        }
        Update: {
          academic_year_id?: string | null
          admin_feedback?: string | null
          class_id?: string
          content?: Json
          created_at?: string
          day_of_week?: string
          id?: string
          lesson_date?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewer_name?: string | null
          school_id?: string
          session_label?: string | null
          status?: Database["public"]["Enums"]["lesson_note_status"]
          sub_topic?: string | null
          subject_id?: string
          submitted_at?: string | null
          teacher_id?: string
          teacher_name?: string | null
          term_id?: string | null
          topic?: string
          updated_at?: string
          version_number?: number
          week_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "lesson_notes_academic_year_id_fkey"
            columns: ["academic_year_id"]
            isOneToOne: false
            referencedRelation: "academic_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_notes_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_notes_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "school_classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_notes_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_school_sms_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "lesson_notes_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_tenant_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "lesson_notes_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_notes_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_notes_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_notes_term_id_fkey"
            columns: ["term_id"]
            isOneToOne: false
            referencedRelation: "terms"
            referencedColumns: ["id"]
          },
        ]
      }
      library_books: {
        Row: {
          author: string | null
          category: string | null
          copies_available: number
          copies_total: number
          created_at: string
          id: string
          isbn: string | null
          school_id: string
          shelf_location: string | null
          title: string
          updated_at: string
        }
        Insert: {
          author?: string | null
          category?: string | null
          copies_available?: number
          copies_total?: number
          created_at?: string
          id?: string
          isbn?: string | null
          school_id: string
          shelf_location?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          author?: string | null
          category?: string | null
          copies_available?: number
          copies_total?: number
          created_at?: string
          id?: string
          isbn?: string | null
          school_id?: string
          shelf_location?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "library_books_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_school_sms_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "library_books_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_tenant_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "library_books_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      live_class_attendance: {
        Row: {
          created_at: string
          duration_seconds: number
          id: string
          join_time: string | null
          leave_time: string | null
          session_id: string
          status: string
          student_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          duration_seconds?: number
          id?: string
          join_time?: string | null
          leave_time?: string | null
          session_id: string
          status?: string
          student_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          duration_seconds?: number
          id?: string
          join_time?: string | null
          leave_time?: string | null
          session_id?: string
          status?: string
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "live_class_attendance_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "live_class_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_class_attendance_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      live_class_audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          metadata: Json | null
          school_id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          metadata?: Json | null
          school_id: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          metadata?: Json | null
          school_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "live_class_audit_logs_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_school_sms_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "live_class_audit_logs_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_tenant_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "live_class_audit_logs_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      live_class_recordings: {
        Row: {
          created_at: string
          duration_seconds: number | null
          id: string
          recording_date: string
          recording_url: string
          school_id: string
          session_id: string
          title: string | null
        }
        Insert: {
          created_at?: string
          duration_seconds?: number | null
          id?: string
          recording_date?: string
          recording_url: string
          school_id: string
          session_id: string
          title?: string | null
        }
        Update: {
          created_at?: string
          duration_seconds?: number | null
          id?: string
          recording_date?: string
          recording_url?: string
          school_id?: string
          session_id?: string
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "live_class_recordings_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_school_sms_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "live_class_recordings_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_tenant_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "live_class_recordings_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_class_recordings_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "live_class_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      live_class_resources: {
        Row: {
          created_at: string
          file_name: string | null
          file_url: string | null
          id: string
          live_class_id: string
          mime_type: string | null
          resource_type: string
          school_id: string
          title: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          file_name?: string | null
          file_url?: string | null
          id?: string
          live_class_id: string
          mime_type?: string | null
          resource_type?: string
          school_id: string
          title: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          file_name?: string | null
          file_url?: string | null
          id?: string
          live_class_id?: string
          mime_type?: string | null
          resource_type?: string
          school_id?: string
          title?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "live_class_resources_live_class_id_fkey"
            columns: ["live_class_id"]
            isOneToOne: false
            referencedRelation: "live_classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_class_resources_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_school_sms_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "live_class_resources_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_tenant_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "live_class_resources_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      live_class_sessions: {
        Row: {
          class_id: string
          created_at: string
          description: string | null
          end_at: string
          google_event_id: string | null
          id: string
          live_class_id: string
          meet_id: string | null
          meet_link: string | null
          schedule_id: string | null
          school_id: string
          session_date: string
          start_at: string
          status: string
          subject_id: string | null
          teacher_id: string
          title: string
          updated_at: string
        }
        Insert: {
          class_id: string
          created_at?: string
          description?: string | null
          end_at: string
          google_event_id?: string | null
          id?: string
          live_class_id: string
          meet_id?: string | null
          meet_link?: string | null
          schedule_id?: string | null
          school_id: string
          session_date: string
          start_at: string
          status?: string
          subject_id?: string | null
          teacher_id: string
          title: string
          updated_at?: string
        }
        Update: {
          class_id?: string
          created_at?: string
          description?: string | null
          end_at?: string
          google_event_id?: string | null
          id?: string
          live_class_id?: string
          meet_id?: string | null
          meet_link?: string | null
          schedule_id?: string | null
          school_id?: string
          session_date?: string
          start_at?: string
          status?: string
          subject_id?: string | null
          teacher_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "live_class_sessions_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_class_sessions_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "school_classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_class_sessions_live_class_id_fkey"
            columns: ["live_class_id"]
            isOneToOne: false
            referencedRelation: "live_classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_class_sessions_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "schedules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_class_sessions_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_school_sms_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "live_class_sessions_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_tenant_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "live_class_sessions_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_class_sessions_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_class_sessions_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      live_classes: {
        Row: {
          class_id: string
          created_at: string
          created_by: string | null
          description: string | null
          end_time: string
          id: string
          recording_enabled: boolean
          recurrence_end_date: string | null
          recurrence_rule: Json | null
          recurrence_type: string
          schedule_id: string | null
          school_id: string
          session_date: string
          start_time: string
          status: string
          subject_id: string | null
          teacher_id: string
          timezone: string
          title: string
          updated_at: string
        }
        Insert: {
          class_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_time: string
          id?: string
          recording_enabled?: boolean
          recurrence_end_date?: string | null
          recurrence_rule?: Json | null
          recurrence_type?: string
          schedule_id?: string | null
          school_id: string
          session_date: string
          start_time: string
          status?: string
          subject_id?: string | null
          teacher_id: string
          timezone?: string
          title: string
          updated_at?: string
        }
        Update: {
          class_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_time?: string
          id?: string
          recording_enabled?: boolean
          recurrence_end_date?: string | null
          recurrence_rule?: Json | null
          recurrence_type?: string
          schedule_id?: string | null
          school_id?: string
          session_date?: string
          start_time?: string
          status?: string
          subject_id?: string | null
          teacher_id?: string
          timezone?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "live_classes_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_classes_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "school_classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_classes_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "schedules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_classes_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_school_sms_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "live_classes_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_tenant_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "live_classes_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_classes_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_classes_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      login_activity: {
        Row: {
          created_at: string
          email: string | null
          failure_reason: string | null
          id: string
          ip_address: string | null
          school_id: string | null
          success: boolean
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          failure_reason?: string | null
          id?: string
          ip_address?: string | null
          school_id?: string | null
          success?: boolean
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          failure_reason?: string | null
          id?: string
          ip_address?: string | null
          school_id?: string | null
          success?: boolean
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "login_activity_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_school_sms_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "login_activity_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_tenant_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "login_activity_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          body: string | null
          created_at: string | null
          id: string
          read: boolean | null
          receiver_id: string | null
          sender_id: string | null
          subject: string | null
        }
        Insert: {
          body?: string | null
          created_at?: string | null
          id?: string
          read?: boolean | null
          receiver_id?: string | null
          sender_id?: string | null
          subject?: string | null
        }
        Update: {
          body?: string | null
          created_at?: string | null
          id?: string
          read?: boolean | null
          receiver_id?: string | null
          sender_id?: string | null
          subject?: string | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string | null
          data: Json | null
          id: string
          read: boolean | null
          title: string | null
          user_id: string | null
        }
        Insert: {
          body?: string | null
          created_at?: string | null
          data?: Json | null
          id?: string
          read?: boolean | null
          title?: string | null
          user_id?: string | null
        }
        Update: {
          body?: string | null
          created_at?: string | null
          data?: Json | null
          id?: string
          read?: boolean | null
          title?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      online_exam_answers: {
        Row: {
          attempt_id: string | null
          id: string
          is_correct: boolean | null
          marks_obtained: number | null
          question_id: string | null
          student_answer: string | null
        }
        Insert: {
          attempt_id?: string | null
          id?: string
          is_correct?: boolean | null
          marks_obtained?: number | null
          question_id?: string | null
          student_answer?: string | null
        }
        Update: {
          attempt_id?: string | null
          id?: string
          is_correct?: boolean | null
          marks_obtained?: number | null
          question_id?: string | null
          student_answer?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "online_exam_answers_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "online_exam_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "online_exam_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "question_bank"
            referencedColumns: ["id"]
          },
        ]
      }
      online_exam_attempts: {
        Row: {
          assigned_questions: Json | null
          id: string
          online_exam_id: string | null
          started_at: string | null
          status: string | null
          student_id: string | null
          submitted_at: string | null
          total_marks_obtained: number | null
        }
        Insert: {
          assigned_questions?: Json | null
          id?: string
          online_exam_id?: string | null
          started_at?: string | null
          status?: string | null
          student_id?: string | null
          submitted_at?: string | null
          total_marks_obtained?: number | null
        }
        Update: {
          assigned_questions?: Json | null
          id?: string
          online_exam_id?: string | null
          started_at?: string | null
          status?: string | null
          student_id?: string | null
          submitted_at?: string | null
          total_marks_obtained?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "online_exam_attempts_online_exam_id_fkey"
            columns: ["online_exam_id"]
            isOneToOne: false
            referencedRelation: "online_exams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "online_exam_attempts_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      online_exam_questions: {
        Row: {
          id: string
          marks: number
          online_exam_id: string | null
          question_id: string | null
          question_order: number | null
        }
        Insert: {
          id?: string
          marks?: number
          online_exam_id?: string | null
          question_id?: string | null
          question_order?: number | null
        }
        Update: {
          id?: string
          marks?: number
          online_exam_id?: string | null
          question_id?: string | null
          question_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "online_exam_questions_online_exam_id_fkey"
            columns: ["online_exam_id"]
            isOneToOne: false
            referencedRelation: "online_exams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "online_exam_questions_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "question_bank"
            referencedColumns: ["id"]
          },
        ]
      }
      online_exams: {
        Row: {
          class_id: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          duration_minutes: number
          end_time: string
          exam_type_id: string | null
          fullscreen_required: boolean | null
          id: string
          is_published: boolean
          passing_marks: number | null
          proctoring_enabled: boolean | null
          question_pool_size: number | null
          questions_to_answer: number | null
          show_result_immediately: boolean | null
          shuffle_answers: boolean | null
          shuffle_questions: boolean | null
          start_time: string
          subject_id: string | null
          tab_switch_limit: number | null
          term: string | null
          title: string
          total_marks: number
          webcam_required: boolean | null
        }
        Insert: {
          class_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          duration_minutes: number
          end_time: string
          exam_type_id?: string | null
          fullscreen_required?: boolean | null
          id?: string
          is_published?: boolean
          passing_marks?: number | null
          proctoring_enabled?: boolean | null
          question_pool_size?: number | null
          questions_to_answer?: number | null
          show_result_immediately?: boolean | null
          shuffle_answers?: boolean | null
          shuffle_questions?: boolean | null
          start_time: string
          subject_id?: string | null
          tab_switch_limit?: number | null
          term?: string | null
          title: string
          total_marks: number
          webcam_required?: boolean | null
        }
        Update: {
          class_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          duration_minutes?: number
          end_time?: string
          exam_type_id?: string | null
          fullscreen_required?: boolean | null
          id?: string
          is_published?: boolean
          passing_marks?: number | null
          proctoring_enabled?: boolean | null
          question_pool_size?: number | null
          questions_to_answer?: number | null
          show_result_immediately?: boolean | null
          shuffle_answers?: boolean | null
          shuffle_questions?: boolean | null
          start_time?: string
          subject_id?: string | null
          tab_switch_limit?: number | null
          term?: string | null
          title?: string
          total_marks?: number
          webcam_required?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "online_exams_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "online_exams_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "school_classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "online_exams_exam_type_id_fkey"
            columns: ["exam_type_id"]
            isOneToOne: false
            referencedRelation: "exam_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "online_exams_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_subscription_payments: {
        Row: {
          amount: number
          billing_cycle: string
          created_at: string
          created_by: string | null
          currency: string
          id: string
          metadata: Json
          paid_at: string | null
          payment_reference: string
          payment_status: string | null
          paystack_transaction_id: string | null
          period_end: string | null
          period_start: string | null
          plan_id: string
          school_id: string
          status: string
        }
        Insert: {
          amount: number
          billing_cycle: string
          created_at?: string
          created_by?: string | null
          currency?: string
          id?: string
          metadata?: Json
          paid_at?: string | null
          payment_reference: string
          payment_status?: string | null
          paystack_transaction_id?: string | null
          period_end?: string | null
          period_start?: string | null
          plan_id: string
          school_id: string
          status?: string
        }
        Update: {
          amount?: number
          billing_cycle?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          id?: string
          metadata?: Json
          paid_at?: string | null
          payment_reference?: string
          payment_status?: string | null
          paystack_transaction_id?: string | null
          period_end?: string | null
          period_start?: string | null
          plan_id?: string
          school_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_subscription_payments_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_subscription_payments_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_school_sms_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "organization_subscription_payments_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_tenant_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "organization_subscription_payments_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      parent_student_links: {
        Row: {
          created_at: string | null
          id: string
          parent_id: string
          relationship: string | null
          student_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          parent_id: string
          relationship?: string | null
          student_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          parent_id?: string
          relationship?: string | null
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "parent_student_links_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "parents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parent_student_links_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      parents: {
        Row: {
          address: string | null
          created_at: string | null
          emergency_contact: string | null
          id: string
          phone: string | null
          school_id: string | null
          signup_child_admission_numbers: string[] | null
          user_id: string | null
          whatsapp_number: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string | null
          emergency_contact?: string | null
          id?: string
          phone?: string | null
          school_id?: string | null
          signup_child_admission_numbers?: string[] | null
          user_id?: string | null
          whatsapp_number?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string | null
          emergency_contact?: string | null
          id?: string
          phone?: string | null
          school_id?: string | null
          signup_child_admission_numbers?: string[] | null
          user_id?: string | null
          whatsapp_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "parents_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_school_sms_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "parents_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_tenant_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "parents_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parents_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      password_reset_otps: {
        Row: {
          attempts: number
          code_hash: string
          consumed_at: string | null
          created_at: string
          delivery: Json
          expires_at: string
          id: string
          identifier: string
          ip_address: string | null
          max_attempts: number
          user_agent: string | null
          user_id: string
          verified_at: string | null
        }
        Insert: {
          attempts?: number
          code_hash: string
          consumed_at?: string | null
          created_at?: string
          delivery?: Json
          expires_at: string
          id?: string
          identifier: string
          ip_address?: string | null
          max_attempts?: number
          user_agent?: string | null
          user_id: string
          verified_at?: string | null
        }
        Update: {
          attempts?: number
          code_hash?: string
          consumed_at?: string | null
          created_at?: string
          delivery?: Json
          expires_at?: string
          id?: string
          identifier?: string
          ip_address?: string | null
          max_attempts?: number
          user_agent?: string | null
          user_id?: string
          verified_at?: string | null
        }
        Relationships: []
      }
      payment_allocations: {
        Row: {
          allocated_by: string | null
          amount: number
          created_at: string
          id: string
          invoice_item_id: string
          payment_id: string
        }
        Insert: {
          allocated_by?: string | null
          amount: number
          created_at?: string
          id?: string
          invoice_item_id: string
          payment_id: string
        }
        Update: {
          allocated_by?: string | null
          amount?: number
          created_at?: string
          id?: string
          invoice_item_id?: string
          payment_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_allocations_invoice_item_id_fkey"
            columns: ["invoice_item_id"]
            isOneToOne: false
            referencedRelation: "account_invoice_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_allocations_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "account_payments"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_checkout_sessions: {
        Row: {
          created_at: string
          gateway_config_id: string | null
          invoice_id: string | null
          reference: string
          school_id: string
          shop_order_id: string | null
        }
        Insert: {
          created_at?: string
          gateway_config_id?: string | null
          invoice_id?: string | null
          reference: string
          school_id: string
          shop_order_id?: string | null
        }
        Update: {
          created_at?: string
          gateway_config_id?: string | null
          invoice_id?: string | null
          reference?: string
          school_id?: string
          shop_order_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_checkout_sessions_gateway_config_id_fkey"
            columns: ["gateway_config_id"]
            isOneToOne: false
            referencedRelation: "tenant_payment_gateway_configs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_checkout_sessions_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "billing_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_checkout_sessions_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_school_sms_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "payment_checkout_sessions_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_tenant_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "payment_checkout_sessions_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_checkout_sessions_shop_order_id_fkey"
            columns: ["shop_order_id"]
            isOneToOne: false
            referencedRelation: "shop_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_webhook_logs: {
        Row: {
          created_at: string
          error_message: string | null
          event_type: string | null
          id: string
          payload: Json | null
          processing_status: string
          provider: string
          reference: string | null
          school_id: string | null
          signature_valid: boolean | null
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          event_type?: string | null
          id?: string
          payload?: Json | null
          processing_status?: string
          provider: string
          reference?: string | null
          school_id?: string | null
          signature_valid?: boolean | null
        }
        Update: {
          created_at?: string
          error_message?: string | null
          event_type?: string | null
          id?: string
          payload?: Json | null
          processing_status?: string
          provider?: string
          reference?: string | null
          school_id?: string | null
          signature_valid?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_webhook_logs_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_school_sms_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "payment_webhook_logs_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_tenant_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "payment_webhook_logs_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number | null
          created_at: string | null
          id: string
          invoice_id: string | null
          notes: string | null
          payer_user_id: string | null
          payment_date: string | null
          payment_method: string | null
          payment_provider: string | null
          payment_type: string | null
          provider_reference: string | null
          status: string | null
          student_id: string | null
        }
        Insert: {
          amount?: number | null
          created_at?: string | null
          id?: string
          invoice_id?: string | null
          notes?: string | null
          payer_user_id?: string | null
          payment_date?: string | null
          payment_method?: string | null
          payment_provider?: string | null
          payment_type?: string | null
          provider_reference?: string | null
          status?: string | null
          student_id?: string | null
        }
        Update: {
          amount?: number | null
          created_at?: string | null
          id?: string
          invoice_id?: string | null
          notes?: string | null
          payer_user_id?: string | null
          payment_date?: string | null
          payment_method?: string | null
          payment_provider?: string | null
          payment_type?: string | null
          provider_reference?: string | null
          status?: string | null
          student_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      paystack_webhook_events: {
        Row: {
          attempts: number
          created_at: string
          event_type: string | null
          id: string
          last_error: string | null
          next_retry_at: string | null
          payload: Json
          reference: string | null
          school_id: string | null
          status: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          event_type?: string | null
          id?: string
          last_error?: string | null
          next_retry_at?: string | null
          payload?: Json
          reference?: string | null
          school_id?: string | null
          status?: string
        }
        Update: {
          attempts?: number
          created_at?: string
          event_type?: string | null
          id?: string
          last_error?: string | null
          next_retry_at?: string | null
          payload?: Json
          reference?: string | null
          school_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "paystack_webhook_events_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_school_sms_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "paystack_webhook_events_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_tenant_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "paystack_webhook_events_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      permission_logs: {
        Row: {
          action_type: string
          actor_id: string | null
          created_at: string
          details: Json
          id: string
          permission_code: string | null
          role_id: string | null
          school_id: string | null
          target_user_id: string | null
        }
        Insert: {
          action_type: string
          actor_id?: string | null
          created_at?: string
          details?: Json
          id?: string
          permission_code?: string | null
          role_id?: string | null
          school_id?: string | null
          target_user_id?: string | null
        }
        Update: {
          action_type?: string
          actor_id?: string | null
          created_at?: string
          details?: Json
          id?: string
          permission_code?: string | null
          role_id?: string | null
          school_id?: string | null
          target_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "permission_logs_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "permission_logs_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_school_sms_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "permission_logs_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_tenant_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "permission_logs_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      permissions: {
        Row: {
          action: string
          category: string | null
          code: string
          created_at: string
          description: string | null
          id: string
          module: string
        }
        Insert: {
          action: string
          category?: string | null
          code: string
          created_at?: string
          description?: string | null
          id?: string
          module: string
        }
        Update: {
          action?: string
          category?: string | null
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          module?: string
        }
        Relationships: []
      }
      platform_ai_config: {
        Row: {
          ai_enabled: boolean
          gemini_api_key: string | null
          id: number
          monthly_request_limit: number
          updated_at: string
        }
        Insert: {
          ai_enabled?: boolean
          gemini_api_key?: string | null
          id?: number
          monthly_request_limit?: number
          updated_at?: string
        }
        Update: {
          ai_enabled?: boolean
          gemini_api_key?: string | null
          id?: number
          monthly_request_limit?: number
          updated_at?: string
        }
        Relationships: []
      }
      platform_modules: {
        Row: {
          category: string
          description: string | null
          is_core: boolean
          label: string
          module_key: string
          portal_module_key: string | null
          sort_order: number
        }
        Insert: {
          category: string
          description?: string | null
          is_core?: boolean
          label: string
          module_key: string
          portal_module_key?: string | null
          sort_order?: number
        }
        Update: {
          category?: string
          description?: string | null
          is_core?: boolean
          label?: string
          module_key?: string
          portal_module_key?: string | null
          sort_order?: number
        }
        Relationships: []
      }
      platform_payment_gateway: {
        Row: {
          is_enabled: boolean
          is_test_mode: boolean
          provider: string
          public_key: string | null
          secret_key: string | null
          updated_at: string
          updated_by: string | null
          webhook_secret: string | null
        }
        Insert: {
          is_enabled?: boolean
          is_test_mode?: boolean
          provider: string
          public_key?: string | null
          secret_key?: string | null
          updated_at?: string
          updated_by?: string | null
          webhook_secret?: string | null
        }
        Update: {
          is_enabled?: boolean
          is_test_mode?: boolean
          provider?: string
          public_key?: string | null
          secret_key?: string | null
          updated_at?: string
          updated_by?: string | null
          webhook_secret?: string | null
        }
        Relationships: []
      }
      platform_sms_gateway: {
        Row: {
          api_key: string | null
          id: boolean
          updated_at: string
        }
        Insert: {
          api_key?: string | null
          id?: boolean
          updated_at?: string
        }
        Update: {
          api_key?: string | null
          id?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      platform_subscription_checkouts: {
        Row: {
          amount: number
          billing_cycle: string
          consumed_at: string | null
          created_at: string
          created_by: string | null
          enable_sms: boolean
          package_amount: number | null
          plan_id: string
          reference: string
          school_id: string
          sms_amount: number
        }
        Insert: {
          amount: number
          billing_cycle: string
          consumed_at?: string | null
          created_at?: string
          created_by?: string | null
          enable_sms?: boolean
          package_amount?: number | null
          plan_id: string
          reference: string
          school_id: string
          sms_amount?: number
        }
        Update: {
          amount?: number
          billing_cycle?: string
          consumed_at?: string | null
          created_at?: string
          created_by?: string | null
          enable_sms?: boolean
          package_amount?: number | null
          plan_id?: string
          reference?: string
          school_id?: string
          sms_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "platform_subscription_checkouts_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "platform_subscription_checkouts_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_school_sms_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "platform_subscription_checkouts_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_tenant_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "platform_subscription_checkouts_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          admin_approval_status:
            | Database["public"]["Enums"]["admin_approval_status"]
            | null
          avatar_url: string | null
          created_at: string | null
          email: string
          full_name: string | null
          id: string
          phone: string | null
          school_id: string | null
          updated_at: string | null
        }
        Insert: {
          admin_approval_status?:
            | Database["public"]["Enums"]["admin_approval_status"]
            | null
          avatar_url?: string | null
          created_at?: string | null
          email: string
          full_name?: string | null
          id: string
          phone?: string | null
          school_id?: string | null
          updated_at?: string | null
        }
        Update: {
          admin_approval_status?:
            | Database["public"]["Enums"]["admin_approval_status"]
            | null
          avatar_url?: string | null
          created_at?: string | null
          email?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          school_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_school_sms_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "profiles_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_tenant_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "profiles_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      question_bank: {
        Row: {
          correct_answer: string
          created_at: string | null
          created_by: string | null
          difficulty: string | null
          id: string
          marks: number
          options: Json | null
          question_text: string
          question_type: string
          school_id: string | null
          subject_id: string | null
        }
        Insert: {
          correct_answer: string
          created_at?: string | null
          created_by?: string | null
          difficulty?: string | null
          id?: string
          marks?: number
          options?: Json | null
          question_text: string
          question_type: string
          school_id?: string | null
          subject_id?: string | null
        }
        Update: {
          correct_answer?: string
          created_at?: string | null
          created_by?: string | null
          difficulty?: string | null
          id?: string
          marks?: number
          options?: Json | null
          question_text?: string
          question_type?: string
          school_id?: string | null
          subject_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "question_bank_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_school_sms_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "question_bank_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_tenant_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "question_bank_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_bank_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      register_audit_logs: {
        Row: {
          action: string
          actor_name: string | null
          actor_user_id: string | null
          created_at: string
          details: Json | null
          id: string
          register_id: string | null
          school_id: string
        }
        Insert: {
          action: string
          actor_name?: string | null
          actor_user_id?: string | null
          created_at?: string
          details?: Json | null
          id?: string
          register_id?: string | null
          school_id: string
        }
        Update: {
          action?: string
          actor_name?: string | null
          actor_user_id?: string | null
          created_at?: string
          details?: Json | null
          id?: string
          register_id?: string | null
          school_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "register_audit_logs_register_id_fkey"
            columns: ["register_id"]
            isOneToOne: false
            referencedRelation: "class_registers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "register_audit_logs_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_school_sms_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "register_audit_logs_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_tenant_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "register_audit_logs_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      register_status_logs: {
        Row: {
          actor_name: string | null
          actor_user_id: string | null
          comment: string | null
          created_at: string
          from_status:
            | Database["public"]["Enums"]["class_register_status"]
            | null
          id: string
          register_id: string
          school_id: string
          to_status: Database["public"]["Enums"]["class_register_status"]
        }
        Insert: {
          actor_name?: string | null
          actor_user_id?: string | null
          comment?: string | null
          created_at?: string
          from_status?:
            | Database["public"]["Enums"]["class_register_status"]
            | null
          id?: string
          register_id: string
          school_id: string
          to_status: Database["public"]["Enums"]["class_register_status"]
        }
        Update: {
          actor_name?: string | null
          actor_user_id?: string | null
          comment?: string | null
          created_at?: string
          from_status?:
            | Database["public"]["Enums"]["class_register_status"]
            | null
          id?: string
          register_id?: string
          school_id?: string
          to_status?: Database["public"]["Enums"]["class_register_status"]
        }
        Relationships: [
          {
            foreignKeyName: "register_status_logs_register_id_fkey"
            columns: ["register_id"]
            isOneToOne: false
            referencedRelation: "class_registers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "register_status_logs_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_school_sms_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "register_status_logs_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_tenant_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "register_status_logs_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      register_student_entries: {
        Row: {
          attendance_status: string
          behavior_remark: string | null
          created_at: string
          id: string
          participation: string | null
          register_id: string
          remarks: string | null
          student_id: string
          time_in: string | null
          updated_at: string
        }
        Insert: {
          attendance_status?: string
          behavior_remark?: string | null
          created_at?: string
          id?: string
          participation?: string | null
          register_id: string
          remarks?: string | null
          student_id: string
          time_in?: string | null
          updated_at?: string
        }
        Update: {
          attendance_status?: string
          behavior_remark?: string | null
          created_at?: string
          id?: string
          participation?: string | null
          register_id?: string
          remarks?: string | null
          student_id?: string
          time_in?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "register_student_entries_register_id_fkey"
            columns: ["register_id"]
            isOneToOne: false
            referencedRelation: "class_registers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "register_student_entries_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      registration_numbers: {
        Row: {
          assigned_user_id: string | null
          generated_at: string | null
          generated_by: string | null
          id: string
          number_type: string
          registration_number: string
          school_id: string
          status: string
          used_at: string | null
        }
        Insert: {
          assigned_user_id?: string | null
          generated_at?: string | null
          generated_by?: string | null
          id?: string
          number_type: string
          registration_number: string
          school_id: string
          status?: string
          used_at?: string | null
        }
        Update: {
          assigned_user_id?: string | null
          generated_at?: string | null
          generated_by?: string | null
          id?: string
          number_type?: string
          registration_number?: string
          school_id?: string
          status?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "registration_numbers_assigned_user_id_fkey"
            columns: ["assigned_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registration_numbers_generated_by_fkey"
            columns: ["generated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registration_numbers_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_school_sms_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "registration_numbers_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_tenant_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "registration_numbers_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      resources: {
        Row: {
          class_id: string | null
          description: string | null
          file_type: string | null
          file_url: string
          id: string
          subject_id: string | null
          title: string
          uploaded_at: string | null
          uploaded_by: string | null
        }
        Insert: {
          class_id?: string | null
          description?: string | null
          file_type?: string | null
          file_url: string
          id?: string
          subject_id?: string | null
          title: string
          uploaded_at?: string | null
          uploaded_by?: string | null
        }
        Update: {
          class_id?: string | null
          description?: string | null
          file_type?: string | null
          file_url?: string
          id?: string
          subject_id?: string | null
          title?: string
          uploaded_at?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "resources_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resources_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "school_classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resources_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      results: {
        Row: {
          ca_score: number | null
          created_at: string
          exam_score: number | null
          grade: string | null
          id: string
          position: number | null
          remark: string | null
          student_id: string
          subject_id: string
          submitted: boolean | null
          teacher_id: string | null
          term_id: string
          total: number | null
          updated_at: string
        }
        Insert: {
          ca_score?: number | null
          created_at?: string
          exam_score?: number | null
          grade?: string | null
          id?: string
          position?: number | null
          remark?: string | null
          student_id: string
          subject_id: string
          submitted?: boolean | null
          teacher_id?: string | null
          term_id: string
          total?: number | null
          updated_at?: string
        }
        Update: {
          ca_score?: number | null
          created_at?: string
          exam_score?: number | null
          grade?: string | null
          id?: string
          position?: number | null
          remark?: string | null
          student_id?: string
          subject_id?: string
          submitted?: boolean | null
          teacher_id?: string | null
          term_id?: string
          total?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "results_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "results_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "results_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "results_term_id_fkey"
            columns: ["term_id"]
            isOneToOne: false
            referencedRelation: "terms"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          created_at: string
          id: string
          permission_id: string
          role_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          permission_id: string
          role_id: string
        }
        Update: {
          created_at?: string
          id?: string
          permission_id?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_system: boolean
          name: string
          school_id: string | null
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_system?: boolean
          name: string
          school_id?: string | null
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_system?: boolean
          name?: string
          school_id?: string | null
          slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "roles_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_school_sms_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "roles_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_tenant_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "roles_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      schedules: {
        Row: {
          class_id: string | null
          created_at: string | null
          day_of_week: number
          end_time: string
          id: string
          room: string | null
          start_time: string
          subject_id: string | null
          teacher_id: string | null
        }
        Insert: {
          class_id?: string | null
          created_at?: string | null
          day_of_week: number
          end_time: string
          id?: string
          room?: string | null
          start_time: string
          subject_id?: string | null
          teacher_id?: string | null
        }
        Update: {
          class_id?: string | null
          created_at?: string | null
          day_of_week?: number
          end_time?: string
          id?: string
          room?: string | null
          start_time?: string
          subject_id?: string | null
          teacher_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "schedules_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedules_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "school_classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedules_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedules_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      school_google_oauth_config: {
        Row: {
          client_id: string
          client_secret: string
          redirect_uri: string
          school_id: string
          updated_at: string
        }
        Insert: {
          client_id: string
          client_secret: string
          redirect_uri?: string
          school_id: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          client_secret?: string
          redirect_uri?: string
          school_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "school_google_oauth_config_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: true
            referencedRelation: "platform_school_sms_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "school_google_oauth_config_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: true
            referencedRelation: "platform_tenant_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "school_google_oauth_config_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: true
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      school_module_entitlements: {
        Row: {
          can_create: boolean
          can_delete: boolean
          can_edit: boolean
          can_export: boolean
          can_read: boolean
          enabled: boolean
          id: string
          module_key: string
          school_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          can_create?: boolean
          can_delete?: boolean
          can_edit?: boolean
          can_export?: boolean
          can_read?: boolean
          enabled?: boolean
          id?: string
          module_key: string
          school_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          can_create?: boolean
          can_delete?: boolean
          can_edit?: boolean
          can_export?: boolean
          can_read?: boolean
          enabled?: boolean
          id?: string
          module_key?: string
          school_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "school_module_entitlements_module_key_fkey"
            columns: ["module_key"]
            isOneToOne: false
            referencedRelation: "platform_modules"
            referencedColumns: ["module_key"]
          },
          {
            foreignKeyName: "school_module_entitlements_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_school_sms_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "school_module_entitlements_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_tenant_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "school_module_entitlements_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      school_settings: {
        Row: {
          alert_drop_threshold: number | null
          allow_multiple_parents_per_student: boolean | null
          auto_remarks: boolean | null
          ca_weight: number | null
          created_at: string
          exam_weight: number | null
          grading_system: string | null
          id: string
          pass_mark: number | null
          pos_require_reference: boolean
          pos_terminal_enabled: boolean
          pos_terminal_label: string
          report_card_footer: string | null
          report_theme_primary: string | null
          school_id: string
          sms_attendance_enabled: boolean
          sms_auto_send_report_card: boolean
          sms_notify_absent: boolean
          sms_notify_late: boolean
          sms_notify_present: boolean
          sms_report_card_template: string | null
          sms_sender_id: string | null
          sms_teacher_can_send_report_card: boolean
          sms_template_absent: string | null
          sms_template_default: string | null
          sms_template_late: string | null
          sms_template_present: string | null
          updated_at: string
          whatsapp_auto_send_fee_notification: boolean
          whatsapp_auto_send_fee_receipt: boolean
          whatsapp_auto_send_report_card: boolean
          whatsapp_auto_send_weekly_attention: boolean
          whatsapp_default_country_code: string
          whatsapp_enabled: boolean
          whatsapp_fee_notification_template: string | null
          whatsapp_fee_receipt_template: string | null
          whatsapp_provider: string
          whatsapp_report_card_template: string | null
          whatsapp_weekly_attention_template: string | null
        }
        Insert: {
          alert_drop_threshold?: number | null
          allow_multiple_parents_per_student?: boolean | null
          auto_remarks?: boolean | null
          ca_weight?: number | null
          created_at?: string
          exam_weight?: number | null
          grading_system?: string | null
          id?: string
          pass_mark?: number | null
          pos_require_reference?: boolean
          pos_terminal_enabled?: boolean
          pos_terminal_label?: string
          report_card_footer?: string | null
          report_theme_primary?: string | null
          school_id: string
          sms_attendance_enabled?: boolean
          sms_auto_send_report_card?: boolean
          sms_notify_absent?: boolean
          sms_notify_late?: boolean
          sms_notify_present?: boolean
          sms_report_card_template?: string | null
          sms_sender_id?: string | null
          sms_teacher_can_send_report_card?: boolean
          sms_template_absent?: string | null
          sms_template_default?: string | null
          sms_template_late?: string | null
          sms_template_present?: string | null
          updated_at?: string
          whatsapp_auto_send_fee_notification?: boolean
          whatsapp_auto_send_fee_receipt?: boolean
          whatsapp_auto_send_report_card?: boolean
          whatsapp_auto_send_weekly_attention?: boolean
          whatsapp_default_country_code?: string
          whatsapp_enabled?: boolean
          whatsapp_fee_notification_template?: string | null
          whatsapp_fee_receipt_template?: string | null
          whatsapp_provider?: string
          whatsapp_report_card_template?: string | null
          whatsapp_weekly_attention_template?: string | null
        }
        Update: {
          alert_drop_threshold?: number | null
          allow_multiple_parents_per_student?: boolean | null
          auto_remarks?: boolean | null
          ca_weight?: number | null
          created_at?: string
          exam_weight?: number | null
          grading_system?: string | null
          id?: string
          pass_mark?: number | null
          pos_require_reference?: boolean
          pos_terminal_enabled?: boolean
          pos_terminal_label?: string
          report_card_footer?: string | null
          report_theme_primary?: string | null
          school_id?: string
          sms_attendance_enabled?: boolean
          sms_auto_send_report_card?: boolean
          sms_notify_absent?: boolean
          sms_notify_late?: boolean
          sms_notify_present?: boolean
          sms_report_card_template?: string | null
          sms_sender_id?: string | null
          sms_teacher_can_send_report_card?: boolean
          sms_template_absent?: string | null
          sms_template_default?: string | null
          sms_template_late?: string | null
          sms_template_present?: string | null
          updated_at?: string
          whatsapp_auto_send_fee_notification?: boolean
          whatsapp_auto_send_fee_receipt?: boolean
          whatsapp_auto_send_report_card?: boolean
          whatsapp_auto_send_weekly_attention?: boolean
          whatsapp_default_country_code?: string
          whatsapp_enabled?: boolean
          whatsapp_fee_notification_template?: string | null
          whatsapp_fee_receipt_template?: string | null
          whatsapp_provider?: string
          whatsapp_report_card_template?: string | null
          whatsapp_weekly_attention_template?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "school_settings_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: true
            referencedRelation: "platform_school_sms_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "school_settings_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: true
            referencedRelation: "platform_tenant_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "school_settings_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: true
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      school_subscriptions: {
        Row: {
          amount_paid: number | null
          billing_cycle: string | null
          block_login_on_expiry: boolean
          created_at: string
          entitlements_override: boolean
          expires_at: string | null
          grace_period_ends_at: string | null
          id: string
          locked_at: string | null
          monthly_revenue: number
          notes: string | null
          payment_reference: string | null
          paystack_transaction_id: string | null
          plan_id: string | null
          read_only_on_expiry: boolean
          reminder_day: number
          renewed_at: string | null
          school_id: string
          sms_admin_override: boolean
          sms_balance: number
          sms_enabled: boolean
          sms_enabled_at: string | null
          started_at: string
          status: Database["public"]["Enums"]["subscription_status"]
          storage_limit_mb: number | null
          storage_used_mb: number
          trial_ends_at: string | null
          updated_at: string
        }
        Insert: {
          amount_paid?: number | null
          billing_cycle?: string | null
          block_login_on_expiry?: boolean
          created_at?: string
          entitlements_override?: boolean
          expires_at?: string | null
          grace_period_ends_at?: string | null
          id?: string
          locked_at?: string | null
          monthly_revenue?: number
          notes?: string | null
          payment_reference?: string | null
          paystack_transaction_id?: string | null
          plan_id?: string | null
          read_only_on_expiry?: boolean
          reminder_day?: number
          renewed_at?: string | null
          school_id: string
          sms_admin_override?: boolean
          sms_balance?: number
          sms_enabled?: boolean
          sms_enabled_at?: string | null
          started_at?: string
          status?: Database["public"]["Enums"]["subscription_status"]
          storage_limit_mb?: number | null
          storage_used_mb?: number
          trial_ends_at?: string | null
          updated_at?: string
        }
        Update: {
          amount_paid?: number | null
          billing_cycle?: string | null
          block_login_on_expiry?: boolean
          created_at?: string
          entitlements_override?: boolean
          expires_at?: string | null
          grace_period_ends_at?: string | null
          id?: string
          locked_at?: string | null
          monthly_revenue?: number
          notes?: string | null
          payment_reference?: string | null
          paystack_transaction_id?: string | null
          plan_id?: string | null
          read_only_on_expiry?: boolean
          reminder_day?: number
          renewed_at?: string | null
          school_id?: string
          sms_admin_override?: boolean
          sms_balance?: number
          sms_enabled?: boolean
          sms_enabled_at?: string | null
          started_at?: string
          status?: Database["public"]["Enums"]["subscription_status"]
          storage_limit_mb?: number | null
          storage_used_mb?: number
          trial_ends_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "school_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_subscriptions_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: true
            referencedRelation: "platform_school_sms_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "school_subscriptions_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: true
            referencedRelation: "platform_tenant_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "school_subscriptions_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: true
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      school_usage_snapshots: {
        Row: {
          created_at: string
          id: string
          login_count_30d: number
          parent_count: number
          school_id: string
          snapshot_date: string
          storage_mb: number
          student_count: number
          teacher_count: number
          user_count: number
        }
        Insert: {
          created_at?: string
          id?: string
          login_count_30d?: number
          parent_count?: number
          school_id: string
          snapshot_date?: string
          storage_mb?: number
          student_count?: number
          teacher_count?: number
          user_count?: number
        }
        Update: {
          created_at?: string
          id?: string
          login_count_30d?: number
          parent_count?: number
          school_id?: string
          snapshot_date?: string
          storage_mb?: number
          student_count?: number
          teacher_count?: number
          user_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "school_usage_snapshots_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_school_sms_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "school_usage_snapshots_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_tenant_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "school_usage_snapshots_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      schools: {
        Row: {
          address: string | null
          admin_key: string | null
          admission_prefix: string | null
          billing_invoice_prefix: string | null
          billing_receipt_footer: string | null
          created_at: string | null
          currency: string | null
          email: string | null
          id: string
          is_active: boolean | null
          logo_url: string | null
          motto: string | null
          name: string | null
          phone: string | null
          principal_name: string | null
          school_code: string
          school_name: string
          stamp_url: string | null
          theme_accent: string | null
          theme_primary: string | null
          theme_secondary: string | null
        }
        Insert: {
          address?: string | null
          admin_key?: string | null
          admission_prefix?: string | null
          billing_invoice_prefix?: string | null
          billing_receipt_footer?: string | null
          created_at?: string | null
          currency?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          logo_url?: string | null
          motto?: string | null
          name?: string | null
          phone?: string | null
          principal_name?: string | null
          school_code: string
          school_name: string
          stamp_url?: string | null
          theme_accent?: string | null
          theme_primary?: string | null
          theme_secondary?: string | null
        }
        Update: {
          address?: string | null
          admin_key?: string | null
          admission_prefix?: string | null
          billing_invoice_prefix?: string | null
          billing_receipt_footer?: string | null
          created_at?: string | null
          currency?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          logo_url?: string | null
          motto?: string | null
          name?: string | null
          phone?: string | null
          principal_name?: string | null
          school_code?: string
          school_name?: string
          stamp_url?: string | null
          theme_accent?: string | null
          theme_primary?: string | null
          theme_secondary?: string | null
        }
        Relationships: []
      }
      shop_cart_items: {
        Row: {
          created_at: string
          id: string
          product_id: string
          quantity: number
          school_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          quantity?: number
          school_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          quantity?: number
          school_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shop_cart_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "shop_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_cart_items_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_school_sms_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "shop_cart_items_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_tenant_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "shop_cart_items_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_cart_items_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_categories: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_archived: boolean
          name: string
          school_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_archived?: boolean
          name: string
          school_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_archived?: boolean
          name?: string
          school_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shop_categories_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_school_sms_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "shop_categories_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_tenant_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "shop_categories_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_coupons: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          description: string | null
          discount_type: string
          discount_value: number
          ends_at: string | null
          id: string
          is_archived: boolean
          max_uses: number | null
          min_order_total: number
          school_id: string
          starts_at: string | null
          status: string
          updated_at: string
          used_count: number
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          discount_type?: string
          discount_value?: number
          ends_at?: string | null
          id?: string
          is_archived?: boolean
          max_uses?: number | null
          min_order_total?: number
          school_id: string
          starts_at?: string | null
          status?: string
          updated_at?: string
          used_count?: number
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          discount_type?: string
          discount_value?: number
          ends_at?: string | null
          id?: string
          is_archived?: boolean
          max_uses?: number | null
          min_order_total?: number
          school_id?: string
          starts_at?: string | null
          status?: string
          updated_at?: string
          used_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "shop_coupons_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_coupons_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_school_sms_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "shop_coupons_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_tenant_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "shop_coupons_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_order_items: {
        Row: {
          id: string
          line_total: number
          order_id: string
          product_id: string | null
          product_name: string
          quantity: number
          school_id: string
          unit_price: number
        }
        Insert: {
          id?: string
          line_total?: number
          order_id: string
          product_id?: string | null
          product_name: string
          quantity?: number
          school_id: string
          unit_price?: number
        }
        Update: {
          id?: string
          line_total?: number
          order_id?: string
          product_id?: string | null
          product_name?: string
          quantity?: number
          school_id?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "shop_order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "shop_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "shop_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_order_items_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_school_sms_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "shop_order_items_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_tenant_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "shop_order_items_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_orders: {
        Row: {
          buyer_user_id: string | null
          coupon_code: string | null
          created_at: string
          created_by: string | null
          customer_email: string | null
          customer_name: string
          customer_phone: string | null
          discount: number
          fulfillment_method: string
          fulfillment_status: string
          id: string
          is_archived: boolean
          notes: string | null
          order_number: string
          paid_at: string | null
          payment_status: string
          paystack_reference: string | null
          paystack_transaction_id: string | null
          portal_role: string | null
          school_id: string
          shipping_address: string | null
          student_id: string | null
          subtotal: number
          total: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          buyer_user_id?: string | null
          coupon_code?: string | null
          created_at?: string
          created_by?: string | null
          customer_email?: string | null
          customer_name: string
          customer_phone?: string | null
          discount?: number
          fulfillment_method?: string
          fulfillment_status?: string
          id?: string
          is_archived?: boolean
          notes?: string | null
          order_number: string
          paid_at?: string | null
          payment_status?: string
          paystack_reference?: string | null
          paystack_transaction_id?: string | null
          portal_role?: string | null
          school_id: string
          shipping_address?: string | null
          student_id?: string | null
          subtotal?: number
          total?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          buyer_user_id?: string | null
          coupon_code?: string | null
          created_at?: string
          created_by?: string | null
          customer_email?: string | null
          customer_name?: string
          customer_phone?: string | null
          discount?: number
          fulfillment_method?: string
          fulfillment_status?: string
          id?: string
          is_archived?: boolean
          notes?: string | null
          order_number?: string
          paid_at?: string | null
          payment_status?: string
          paystack_reference?: string | null
          paystack_transaction_id?: string | null
          portal_role?: string | null
          school_id?: string
          shipping_address?: string | null
          student_id?: string | null
          subtotal?: number
          total?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shop_orders_buyer_user_id_fkey"
            columns: ["buyer_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_orders_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_orders_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_school_sms_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "shop_orders_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_tenant_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "shop_orders_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_orders_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_orders_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_products: {
        Row: {
          category_id: string | null
          cost: number
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          image_url: string | null
          is_archived: boolean
          is_digital: boolean
          name: string
          price: number
          product_type: string
          reorder_level: number
          school_id: string
          sku: string | null
          status: string
          stock_qty: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          category_id?: string | null
          cost?: number
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_archived?: boolean
          is_digital?: boolean
          name: string
          price?: number
          product_type?: string
          reorder_level?: number
          school_id: string
          sku?: string | null
          status?: string
          stock_qty?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          category_id?: string | null
          cost?: number
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_archived?: boolean
          is_digital?: boolean
          name?: string
          price?: number
          product_type?: string
          reorder_level?: number
          school_id?: string
          sku?: string | null
          status?: string
          stock_qty?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shop_products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "shop_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_products_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_products_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_school_sms_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "shop_products_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_tenant_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "shop_products_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_products_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_reviews: {
        Row: {
          comment: string | null
          created_at: string
          id: string
          product_id: string
          rating: number
          school_id: string
          user_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          id?: string
          product_id: string
          rating: number
          school_id: string
          user_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          id?: string
          product_id?: string
          rating?: number
          school_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shop_reviews_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "shop_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_reviews_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_school_sms_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "shop_reviews_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_tenant_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "shop_reviews_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_reviews_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_wishlists: {
        Row: {
          created_at: string
          id: string
          product_id: string
          school_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          school_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          school_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shop_wishlists_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "shop_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_wishlists_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_school_sms_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "shop_wishlists_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_tenant_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "shop_wishlists_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_wishlists_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sms_logs: {
        Row: {
          id: string
          message: string
          parent_id: string | null
          phone_number: string
          provider_response: Json | null
          register_id: string | null
          school_id: string
          sent_at: string
          sms_status: string
          student_id: string | null
        }
        Insert: {
          id?: string
          message: string
          parent_id?: string | null
          phone_number: string
          provider_response?: Json | null
          register_id?: string | null
          school_id: string
          sent_at?: string
          sms_status?: string
          student_id?: string | null
        }
        Update: {
          id?: string
          message?: string
          parent_id?: string | null
          phone_number?: string
          provider_response?: Json | null
          register_id?: string | null
          school_id?: string
          sent_at?: string
          sms_status?: string
          student_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sms_logs_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "parents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_logs_register_id_fkey"
            columns: ["register_id"]
            isOneToOne: false
            referencedRelation: "class_registers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_logs_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_school_sms_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "sms_logs_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_tenant_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "sms_logs_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_logs_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_bank_accounts: {
        Row: {
          account_name: string | null
          account_number: string | null
          bank_code: string | null
          bank_name: string | null
          created_at: string
          id: string
          mobile_money_number: string | null
          mobile_money_provider: string | null
          payment_notes: string | null
          preferred_payout_method: string | null
          recipient_code: string | null
          school_id: string
          staff_user_id: string
          updated_at: string
        }
        Insert: {
          account_name?: string | null
          account_number?: string | null
          bank_code?: string | null
          bank_name?: string | null
          created_at?: string
          id?: string
          mobile_money_number?: string | null
          mobile_money_provider?: string | null
          payment_notes?: string | null
          preferred_payout_method?: string | null
          recipient_code?: string | null
          school_id: string
          staff_user_id: string
          updated_at?: string
        }
        Update: {
          account_name?: string | null
          account_number?: string | null
          bank_code?: string | null
          bank_name?: string | null
          created_at?: string
          id?: string
          mobile_money_number?: string | null
          mobile_money_provider?: string | null
          payment_notes?: string | null
          preferred_payout_method?: string | null
          recipient_code?: string | null
          school_id?: string
          staff_user_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_bank_accounts_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_school_sms_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "staff_bank_accounts_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_tenant_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "staff_bank_accounts_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_employees: {
        Row: {
          address: string | null
          contract_end_date: string | null
          created_at: string
          created_by: string | null
          date_of_birth: string | null
          deleted_by: string | null
          department_id: string | null
          documents_url: string | null
          email: string | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          employment_status: string
          employment_type: string | null
          experience_years: number | null
          full_name: string
          gender: string | null
          hire_date: string | null
          id: string
          is_archived: boolean
          notes: string | null
          phone: string | null
          photo_url: string | null
          position: string | null
          profile_id: string | null
          qualification: string | null
          salary: number | null
          school_id: string
          staff_id: string
          termination_date: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          address?: string | null
          contract_end_date?: string | null
          created_at?: string
          created_by?: string | null
          date_of_birth?: string | null
          deleted_by?: string | null
          department_id?: string | null
          documents_url?: string | null
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          employment_status?: string
          employment_type?: string | null
          experience_years?: number | null
          full_name: string
          gender?: string | null
          hire_date?: string | null
          id?: string
          is_archived?: boolean
          notes?: string | null
          phone?: string | null
          photo_url?: string | null
          position?: string | null
          profile_id?: string | null
          qualification?: string | null
          salary?: number | null
          school_id: string
          staff_id: string
          termination_date?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          address?: string | null
          contract_end_date?: string | null
          created_at?: string
          created_by?: string | null
          date_of_birth?: string | null
          deleted_by?: string | null
          department_id?: string | null
          documents_url?: string | null
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          employment_status?: string
          employment_type?: string | null
          experience_years?: number | null
          full_name?: string
          gender?: string | null
          hire_date?: string | null
          id?: string
          is_archived?: boolean
          notes?: string | null
          phone?: string | null
          photo_url?: string | null
          position?: string | null
          profile_id?: string | null
          qualification?: string | null
          salary?: number | null
          school_id?: string
          staff_id?: string
          termination_date?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "staff_employees_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_employees_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_employees_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_employees_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_employees_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_school_sms_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "staff_employees_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_tenant_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "staff_employees_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_employees_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_salaries: {
        Row: {
          allowances: number
          amount: number
          created_at: string
          currency: string
          deductions: number
          duplicate_override: boolean
          gateway: string
          gateway_ref: string | null
          id: string
          method: string
          month: string
          notes: string | null
          paid_at: string | null
          payout_snapshot: Json | null
          recorded_by: string | null
          school_id: string
          staff_user_id: string
          status: string
        }
        Insert: {
          allowances?: number
          amount: number
          created_at?: string
          currency?: string
          deductions?: number
          duplicate_override?: boolean
          gateway?: string
          gateway_ref?: string | null
          id?: string
          method?: string
          month: string
          notes?: string | null
          paid_at?: string | null
          payout_snapshot?: Json | null
          recorded_by?: string | null
          school_id: string
          staff_user_id: string
          status?: string
        }
        Update: {
          allowances?: number
          amount?: number
          created_at?: string
          currency?: string
          deductions?: number
          duplicate_override?: boolean
          gateway?: string
          gateway_ref?: string | null
          id?: string
          method?: string
          month?: string
          notes?: string | null
          paid_at?: string | null
          payout_snapshot?: Json | null
          recorded_by?: string | null
          school_id?: string
          staff_user_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_salaries_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_school_sms_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "staff_salaries_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_tenant_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "staff_salaries_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      student_health_profiles: {
        Row: {
          allergies: string | null
          blood_group: string | null
          created_at: string
          created_by: string | null
          critical_alert: boolean
          current_medication: string | null
          disabilities: string | null
          doctor_name: string | null
          documents_url: string | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          emergency_relationship: string | null
          health_clearance: boolean
          health_status: string
          hearing: string | null
          height_cm: number | null
          hospital: string | null
          id: string
          insurance: string | null
          is_archived: boolean
          medical_conditions: string | null
          medical_notes: string | null
          school_id: string
          student_id: string
          updated_at: string
          updated_by: string | null
          vaccination_history: string | null
          vision: string | null
          weight_kg: number | null
        }
        Insert: {
          allergies?: string | null
          blood_group?: string | null
          created_at?: string
          created_by?: string | null
          critical_alert?: boolean
          current_medication?: string | null
          disabilities?: string | null
          doctor_name?: string | null
          documents_url?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          emergency_relationship?: string | null
          health_clearance?: boolean
          health_status?: string
          hearing?: string | null
          height_cm?: number | null
          hospital?: string | null
          id?: string
          insurance?: string | null
          is_archived?: boolean
          medical_conditions?: string | null
          medical_notes?: string | null
          school_id: string
          student_id: string
          updated_at?: string
          updated_by?: string | null
          vaccination_history?: string | null
          vision?: string | null
          weight_kg?: number | null
        }
        Update: {
          allergies?: string | null
          blood_group?: string | null
          created_at?: string
          created_by?: string | null
          critical_alert?: boolean
          current_medication?: string | null
          disabilities?: string | null
          doctor_name?: string | null
          documents_url?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          emergency_relationship?: string | null
          health_clearance?: boolean
          health_status?: string
          hearing?: string | null
          height_cm?: number | null
          hospital?: string | null
          id?: string
          insurance?: string | null
          is_archived?: boolean
          medical_conditions?: string | null
          medical_notes?: string | null
          school_id?: string
          student_id?: string
          updated_at?: string
          updated_by?: string | null
          vaccination_history?: string | null
          vision?: string | null
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "student_health_profiles_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_health_profiles_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_school_sms_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "student_health_profiles_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_tenant_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "student_health_profiles_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_health_profiles_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_health_profiles_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      student_health_visits: {
        Row: {
          complaint: string | null
          created_at: string
          created_by: string | null
          health_profile_id: string
          id: string
          outcome: string | null
          recorded_by_name: string | null
          school_id: string
          student_id: string
          treatment: string | null
          visit_date: string
          visit_type: string
        }
        Insert: {
          complaint?: string | null
          created_at?: string
          created_by?: string | null
          health_profile_id: string
          id?: string
          outcome?: string | null
          recorded_by_name?: string | null
          school_id: string
          student_id: string
          treatment?: string | null
          visit_date?: string
          visit_type?: string
        }
        Update: {
          complaint?: string | null
          created_at?: string
          created_by?: string | null
          health_profile_id?: string
          id?: string
          outcome?: string | null
          recorded_by_name?: string | null
          school_id?: string
          student_id?: string
          treatment?: string | null
          visit_date?: string
          visit_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_health_visits_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_health_visits_health_profile_id_fkey"
            columns: ["health_profile_id"]
            isOneToOne: false
            referencedRelation: "student_health_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_health_visits_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_school_sms_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "student_health_visits_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_tenant_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "student_health_visits_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_health_visits_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      student_transport_assignments: {
        Row: {
          assigned_by: string | null
          bus_id: string
          created_at: string
          fare_amount: number
          fee_item_id: string | null
          id: string
          notes: string | null
          school_id: string
          status: string
          stop_id: string
          student_id: string
          updated_at: string
        }
        Insert: {
          assigned_by?: string | null
          bus_id: string
          created_at?: string
          fare_amount?: number
          fee_item_id?: string | null
          id?: string
          notes?: string | null
          school_id: string
          status?: string
          stop_id: string
          student_id: string
          updated_at?: string
        }
        Update: {
          assigned_by?: string | null
          bus_id?: string
          created_at?: string
          fare_amount?: number
          fee_item_id?: string | null
          id?: string
          notes?: string | null
          school_id?: string
          status?: string
          stop_id?: string
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_transport_assignments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_transport_assignments_bus_id_fkey"
            columns: ["bus_id"]
            isOneToOne: false
            referencedRelation: "transport_buses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_transport_assignments_fee_item_id_fkey"
            columns: ["fee_item_id"]
            isOneToOne: false
            referencedRelation: "fee_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_transport_assignments_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_school_sms_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "student_transport_assignments_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_tenant_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "student_transport_assignments_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_transport_assignments_stop_id_fkey"
            columns: ["stop_id"]
            isOneToOne: false
            referencedRelation: "transport_stops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_transport_assignments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: true
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      students: {
        Row: {
          admission_no: string | null
          admission_number: string | null
          class_id: string | null
          created_at: string | null
          date_of_birth: string | null
          first_name: string | null
          full_name: string | null
          gender: string | null
          guardian_id: string | null
          id: string
          last_name: string | null
          profile_id: string | null
          school_id: string | null
          user_id: string | null
        }
        Insert: {
          admission_no?: string | null
          admission_number?: string | null
          class_id?: string | null
          created_at?: string | null
          date_of_birth?: string | null
          first_name?: string | null
          full_name?: string | null
          gender?: string | null
          guardian_id?: string | null
          id?: string
          last_name?: string | null
          profile_id?: string | null
          school_id?: string | null
          user_id?: string | null
        }
        Update: {
          admission_no?: string | null
          admission_number?: string | null
          class_id?: string | null
          created_at?: string | null
          date_of_birth?: string | null
          first_name?: string | null
          full_name?: string | null
          gender?: string | null
          guardian_id?: string | null
          id?: string
          last_name?: string | null
          profile_id?: string | null
          school_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "students_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "school_classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_guardian_id_fkey"
            columns: ["guardian_id"]
            isOneToOne: false
            referencedRelation: "parents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_school_sms_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "students_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_tenant_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "students_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      subjects: {
        Row: {
          code: string | null
          id: string
          name: string
          school_id: string | null
        }
        Insert: {
          code?: string | null
          id?: string
          name: string
          school_id?: string | null
        }
        Update: {
          code?: string | null
          id?: string
          name?: string
          school_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subjects_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_school_sms_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "subjects_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_tenant_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "subjects_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      submissions: {
        Row: {
          assignment_id: string | null
          file_url: string | null
          grade: number | null
          id: string
          student_id: string | null
          submitted_at: string | null
        }
        Insert: {
          assignment_id?: string | null
          file_url?: string | null
          grade?: number | null
          id?: string
          student_id?: string | null
          submitted_at?: string | null
        }
        Update: {
          assignment_id?: string | null
          file_url?: string | null
          grade?: number | null
          id?: string
          student_id?: string | null
          submitted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "submissions_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submissions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_audit_log: {
        Row: {
          action: string
          created_at: string
          details: Json
          id: string
          payment_reference: string | null
          school_id: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json
          id?: string
          payment_reference?: string | null
          school_id: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json
          id?: string
          payment_reference?: string | null
          school_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subscription_audit_log_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_school_sms_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "subscription_audit_log_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_tenant_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "subscription_audit_log_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_plans: {
        Row: {
          created_at: string
          default_modules: Json
          description: string | null
          id: string
          is_active: boolean
          is_custom: boolean
          max_storage_gb: number | null
          max_students: number | null
          max_teachers: number | null
          name: string
          price_annual: number
          price_monthly: number
          slug: string
          sms_addon_fee_annual: number
          sms_addon_fee_monthly: number
          sms_included_quantity: number
          sms_price_per_message: number
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_modules?: Json
          description?: string | null
          id?: string
          is_active?: boolean
          is_custom?: boolean
          max_storage_gb?: number | null
          max_students?: number | null
          max_teachers?: number | null
          name: string
          price_annual?: number
          price_monthly?: number
          slug: string
          sms_addon_fee_annual?: number
          sms_addon_fee_monthly?: number
          sms_included_quantity?: number
          sms_price_per_message?: number
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_modules?: Json
          description?: string | null
          id?: string
          is_active?: boolean
          is_custom?: boolean
          max_storage_gb?: number | null
          max_students?: number | null
          max_teachers?: number | null
          name?: string
          price_annual?: number
          price_monthly?: number
          slug?: string
          sms_addon_fee_annual?: number
          sms_addon_fee_monthly?: number
          sms_included_quantity?: number
          sms_price_per_message?: number
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      super_admin_schools: {
        Row: {
          created_at: string | null
          id: string
          school_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          school_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          school_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "super_admin_schools_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_school_sms_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "super_admin_schools_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_tenant_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "super_admin_schools_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      system_backups: {
        Row: {
          backup_name: string
          completed_at: string | null
          created_at: string
          created_by: string | null
          error_message: string | null
          file_path: string | null
          file_size_bytes: number | null
          id: string
          metadata: Json
          progress_message: string | null
          progress_pct: number
          progress_stage: string | null
          record_count: number
          school_id: string
          sheet_count: number
          started_at: string
          status: string
          tables_included: string[] | null
          updated_at: string
        }
        Insert: {
          backup_name: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          error_message?: string | null
          file_path?: string | null
          file_size_bytes?: number | null
          id?: string
          metadata?: Json
          progress_message?: string | null
          progress_pct?: number
          progress_stage?: string | null
          record_count?: number
          school_id: string
          sheet_count?: number
          started_at?: string
          status?: string
          tables_included?: string[] | null
          updated_at?: string
        }
        Update: {
          backup_name?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          error_message?: string | null
          file_path?: string | null
          file_size_bytes?: number | null
          id?: string
          metadata?: Json
          progress_message?: string | null
          progress_pct?: number
          progress_stage?: string | null
          record_count?: number
          school_id?: string
          sheet_count?: number
          started_at?: string
          status?: string
          tables_included?: string[] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "system_backups_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_school_sms_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "system_backups_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_tenant_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "system_backups_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      system_settings: {
        Row: {
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      teacher_payroll_config: {
        Row: {
          base_monthly_salary: number
          class_id: string | null
          created_at: string
          default_allowances: number
          default_deductions: number
          id: string
          notes: string | null
          school_id: string
          staff_user_id: string
          subject_label: string | null
          updated_at: string
        }
        Insert: {
          base_monthly_salary?: number
          class_id?: string | null
          created_at?: string
          default_allowances?: number
          default_deductions?: number
          id?: string
          notes?: string | null
          school_id: string
          staff_user_id: string
          subject_label?: string | null
          updated_at?: string
        }
        Update: {
          base_monthly_salary?: number
          class_id?: string | null
          created_at?: string
          default_allowances?: number
          default_deductions?: number
          id?: string
          notes?: string | null
          school_id?: string
          staff_user_id?: string
          subject_label?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "teacher_payroll_config_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_payroll_config_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "school_classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_payroll_config_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_school_sms_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "teacher_payroll_config_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_tenant_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "teacher_payroll_config_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      teachers: {
        Row: {
          created_at: string | null
          deactivated_at: string | null
          deactivated_by: string | null
          employee_no: string | null
          id: string
          is_active: boolean
          school_id: string | null
          subject_specialty: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          deactivated_at?: string | null
          deactivated_by?: string | null
          employee_no?: string | null
          id?: string
          is_active?: boolean
          school_id?: string | null
          subject_specialty?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          deactivated_at?: string | null
          deactivated_by?: string | null
          employee_no?: string | null
          id?: string
          is_active?: boolean
          school_id?: string | null
          subject_specialty?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "teachers_deactivated_by_fkey"
            columns: ["deactivated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teachers_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_school_sms_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "teachers_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_tenant_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "teachers_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teachers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_payment_gateway_audit: {
        Row: {
          action: string
          created_at: string
          gateway_config_id: string | null
          id: string
          provider: string
          school_id: string
          summary: Json
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          gateway_config_id?: string | null
          id?: string
          provider: string
          school_id: string
          summary?: Json
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          gateway_config_id?: string | null
          id?: string
          provider?: string
          school_id?: string
          summary?: Json
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenant_payment_gateway_audit_gateway_config_id_fkey"
            columns: ["gateway_config_id"]
            isOneToOne: false
            referencedRelation: "tenant_payment_gateway_configs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_payment_gateway_audit_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_school_sms_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "tenant_payment_gateway_audit_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_tenant_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "tenant_payment_gateway_audit_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_payment_gateway_configs: {
        Row: {
          callback_url: string | null
          config_json: Json
          connection_status: string
          created_at: string
          id: string
          is_default: boolean
          is_enabled: boolean
          is_test_mode: boolean
          last_validated_at: string | null
          merchant_email: string | null
          paystack_secret_key: string | null
          provider: string
          public_key: string | null
          school_id: string
          updated_at: string
        }
        Insert: {
          callback_url?: string | null
          config_json?: Json
          connection_status?: string
          created_at?: string
          id?: string
          is_default?: boolean
          is_enabled?: boolean
          is_test_mode?: boolean
          last_validated_at?: string | null
          merchant_email?: string | null
          paystack_secret_key?: string | null
          provider: string
          public_key?: string | null
          school_id: string
          updated_at?: string
        }
        Update: {
          callback_url?: string | null
          config_json?: Json
          connection_status?: string
          created_at?: string
          id?: string
          is_default?: boolean
          is_enabled?: boolean
          is_test_mode?: boolean
          last_validated_at?: string | null
          merchant_email?: string | null
          paystack_secret_key?: string | null
          provider?: string
          public_key?: string | null
          school_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_payment_gateway_configs_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_school_sms_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "tenant_payment_gateway_configs_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_tenant_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "tenant_payment_gateway_configs_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_payment_gateway_secrets: {
        Row: {
          ciphertext: string
          gateway_config_id: string
          updated_at: string
        }
        Insert: {
          ciphertext: string
          gateway_config_id: string
          updated_at?: string
        }
        Update: {
          ciphertext?: string
          gateway_config_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_payment_gateway_secrets_gateway_config_id_fkey"
            columns: ["gateway_config_id"]
            isOneToOne: true
            referencedRelation: "tenant_payment_gateway_configs"
            referencedColumns: ["id"]
          },
        ]
      }
      term_class_report_versions: {
        Row: {
          changed_by: string | null
          created_at: string
          id: string
          note: string | null
          report_id: string
          snapshot: Json
          status: Database["public"]["Enums"]["report_card_status"]
          version: number
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          id?: string
          note?: string | null
          report_id: string
          snapshot?: Json
          status: Database["public"]["Enums"]["report_card_status"]
          version: number
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          id?: string
          note?: string | null
          report_id?: string
          snapshot?: Json
          status?: Database["public"]["Enums"]["report_card_status"]
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "term_class_report_versions_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "term_class_report_versions_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "term_class_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      term_class_reports: {
        Row: {
          academic_year: string | null
          admin_comment: string | null
          approved_at: string | null
          class_id: string
          class_name: string | null
          created_at: string
          id: string
          rejection_reason: string | null
          reviewed_at: string | null
          saved_at: string | null
          school_id: string
          snapshot: Json
          status: Database["public"]["Enums"]["report_card_status"]
          student_count: number
          subject_count: number
          submitted_at: string | null
          teacher_id: string | null
          term_id: string
          term_label: string | null
          updated_at: string
          version: number
        }
        Insert: {
          academic_year?: string | null
          admin_comment?: string | null
          approved_at?: string | null
          class_id: string
          class_name?: string | null
          created_at?: string
          id?: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          saved_at?: string | null
          school_id: string
          snapshot?: Json
          status?: Database["public"]["Enums"]["report_card_status"]
          student_count?: number
          subject_count?: number
          submitted_at?: string | null
          teacher_id?: string | null
          term_id: string
          term_label?: string | null
          updated_at?: string
          version?: number
        }
        Update: {
          academic_year?: string | null
          admin_comment?: string | null
          approved_at?: string | null
          class_id?: string
          class_name?: string | null
          created_at?: string
          id?: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          saved_at?: string | null
          school_id?: string
          snapshot?: Json
          status?: Database["public"]["Enums"]["report_card_status"]
          student_count?: number
          subject_count?: number
          submitted_at?: string | null
          teacher_id?: string | null
          term_id?: string
          term_label?: string | null
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "term_class_reports_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "term_class_reports_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "school_classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "term_class_reports_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_school_sms_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "term_class_reports_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_tenant_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "term_class_reports_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "term_class_reports_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "term_class_reports_term_id_fkey"
            columns: ["term_id"]
            isOneToOne: false
            referencedRelation: "terms"
            referencedColumns: ["id"]
          },
        ]
      }
      term_report_card_versions: {
        Row: {
          change_note: string | null
          changed_by: string | null
          created_at: string
          form_snapshot: Json
          id: string
          report_id: string
          status: Database["public"]["Enums"]["report_card_status"]
          version: number
        }
        Insert: {
          change_note?: string | null
          changed_by?: string | null
          created_at?: string
          form_snapshot: Json
          id?: string
          report_id: string
          status: Database["public"]["Enums"]["report_card_status"]
          version: number
        }
        Update: {
          change_note?: string | null
          changed_by?: string | null
          created_at?: string
          form_snapshot?: Json
          id?: string
          report_id?: string
          status?: Database["public"]["Enums"]["report_card_status"]
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "term_report_card_versions_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "term_report_card_versions_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "term_report_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      term_report_cards: {
        Row: {
          academic_year: string | null
          admin_comment: string | null
          approved_at: string | null
          attendance_made: string | null
          attendance_total: string | null
          attitude: string | null
          class_id: string | null
          class_name: string | null
          class_position: string | null
          class_student_total_manual: number | null
          club: string | null
          conduct: string | null
          created_at: string
          head_sign_date: string | null
          id: string
          interest: string | null
          next_term: string | null
          parent_sign_date: string | null
          published_at: string | null
          published_by: string | null
          rejection_reason: string | null
          reopening_date: string | null
          report_pdf_url: string | null
          reviewed_at: string | null
          roll_number: number | null
          saved_at: string | null
          school_closes: string | null
          school_id: string
          sent_to_parents_at: string | null
          sent_to_parents_by: string | null
          status: Database["public"]["Enums"]["report_card_status"]
          student_id: string
          student_name: string
          subjects: Json
          submitted_at: string | null
          teacher_id: string | null
          teacher_remark: string | null
          teacher_sign_date: string | null
          term_id: string | null
          term_label: string | null
          total_score: number | null
          updated_at: string
          version: number
        }
        Insert: {
          academic_year?: string | null
          admin_comment?: string | null
          approved_at?: string | null
          attendance_made?: string | null
          attendance_total?: string | null
          attitude?: string | null
          class_id?: string | null
          class_name?: string | null
          class_position?: string | null
          class_student_total_manual?: number | null
          club?: string | null
          conduct?: string | null
          created_at?: string
          head_sign_date?: string | null
          id?: string
          interest?: string | null
          next_term?: string | null
          parent_sign_date?: string | null
          published_at?: string | null
          published_by?: string | null
          rejection_reason?: string | null
          reopening_date?: string | null
          report_pdf_url?: string | null
          reviewed_at?: string | null
          roll_number?: number | null
          saved_at?: string | null
          school_closes?: string | null
          school_id: string
          sent_to_parents_at?: string | null
          sent_to_parents_by?: string | null
          status?: Database["public"]["Enums"]["report_card_status"]
          student_id: string
          student_name: string
          subjects?: Json
          submitted_at?: string | null
          teacher_id?: string | null
          teacher_remark?: string | null
          teacher_sign_date?: string | null
          term_id?: string | null
          term_label?: string | null
          total_score?: number | null
          updated_at?: string
          version?: number
        }
        Update: {
          academic_year?: string | null
          admin_comment?: string | null
          approved_at?: string | null
          attendance_made?: string | null
          attendance_total?: string | null
          attitude?: string | null
          class_id?: string | null
          class_name?: string | null
          class_position?: string | null
          class_student_total_manual?: number | null
          club?: string | null
          conduct?: string | null
          created_at?: string
          head_sign_date?: string | null
          id?: string
          interest?: string | null
          next_term?: string | null
          parent_sign_date?: string | null
          published_at?: string | null
          published_by?: string | null
          rejection_reason?: string | null
          reopening_date?: string | null
          report_pdf_url?: string | null
          reviewed_at?: string | null
          roll_number?: number | null
          saved_at?: string | null
          school_closes?: string | null
          school_id?: string
          sent_to_parents_at?: string | null
          sent_to_parents_by?: string | null
          status?: Database["public"]["Enums"]["report_card_status"]
          student_id?: string
          student_name?: string
          subjects?: Json
          submitted_at?: string | null
          teacher_id?: string | null
          teacher_remark?: string | null
          teacher_sign_date?: string | null
          term_id?: string | null
          term_label?: string | null
          total_score?: number | null
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "term_report_cards_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "term_report_cards_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "school_classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "term_report_cards_published_by_fkey"
            columns: ["published_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "term_report_cards_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_school_sms_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "term_report_cards_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_tenant_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "term_report_cards_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "term_report_cards_sent_to_parents_by_fkey"
            columns: ["sent_to_parents_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "term_report_cards_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "term_report_cards_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "term_report_cards_term_id_fkey"
            columns: ["term_id"]
            isOneToOne: false
            referencedRelation: "terms"
            referencedColumns: ["id"]
          },
        ]
      }
      terms: {
        Row: {
          academic_year_id: string | null
          created_at: string
          end_date: string | null
          fees_due_date: string | null
          id: string
          is_current: boolean | null
          name: string
          school_id: string
          session: string
          start_date: string | null
          term_kind: string | null
        }
        Insert: {
          academic_year_id?: string | null
          created_at?: string
          end_date?: string | null
          fees_due_date?: string | null
          id?: string
          is_current?: boolean | null
          name: string
          school_id: string
          session: string
          start_date?: string | null
          term_kind?: string | null
        }
        Update: {
          academic_year_id?: string | null
          created_at?: string
          end_date?: string | null
          fees_due_date?: string | null
          id?: string
          is_current?: boolean | null
          name?: string
          school_id?: string
          session?: string
          start_date?: string | null
          term_kind?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "terms_academic_year_id_fkey"
            columns: ["academic_year_id"]
            isOneToOne: false
            referencedRelation: "academic_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "terms_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_school_sms_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "terms_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_tenant_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "terms_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      transport_buses: {
        Row: {
          capacity: number | null
          created_at: string
          driver_name: string | null
          driver_phone: string | null
          id: string
          is_active: boolean
          name: string
          route_id: string | null
          school_id: string
          updated_at: string
          vehicle_plate: string | null
        }
        Insert: {
          capacity?: number | null
          created_at?: string
          driver_name?: string | null
          driver_phone?: string | null
          id?: string
          is_active?: boolean
          name: string
          route_id?: string | null
          school_id: string
          updated_at?: string
          vehicle_plate?: string | null
        }
        Update: {
          capacity?: number | null
          created_at?: string
          driver_name?: string | null
          driver_phone?: string | null
          id?: string
          is_active?: boolean
          name?: string
          route_id?: string | null
          school_id?: string
          updated_at?: string
          vehicle_plate?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transport_buses_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "transport_routes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transport_buses_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_school_sms_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "transport_buses_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_tenant_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "transport_buses_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      transport_routes: {
        Row: {
          capacity: number | null
          created_at: string
          description: string | null
          driver_name: string | null
          id: string
          name: string
          school_id: string
          updated_at: string
          vehicle_plate: string | null
        }
        Insert: {
          capacity?: number | null
          created_at?: string
          description?: string | null
          driver_name?: string | null
          id?: string
          name: string
          school_id: string
          updated_at?: string
          vehicle_plate?: string | null
        }
        Update: {
          capacity?: number | null
          created_at?: string
          description?: string | null
          driver_name?: string | null
          id?: string
          name?: string
          school_id?: string
          updated_at?: string
          vehicle_plate?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transport_routes_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_school_sms_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "transport_routes_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_tenant_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "transport_routes_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      transport_stops: {
        Row: {
          created_at: string
          fare: number
          id: string
          name: string
          route_id: string
          school_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          fare?: number
          id?: string
          name: string
          route_id: string
          school_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          fare?: number
          id?: string
          name?: string
          route_id?: string
          school_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transport_stops_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "transport_routes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transport_stops_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_school_sms_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "transport_stops_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_tenant_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "transport_stops_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      user_role_assignments: {
        Row: {
          assigned_by: string | null
          created_at: string
          id: string
          role_id: string
          school_id: string | null
          user_id: string
        }
        Insert: {
          assigned_by?: string | null
          created_at?: string
          id?: string
          role_id: string
          school_id?: string | null
          user_id: string
        }
        Update: {
          assigned_by?: string | null
          created_at?: string
          id?: string
          role_id?: string
          school_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_role_assignments_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_role_assignments_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_school_sms_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "user_role_assignments_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_tenant_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "user_role_assignments_school_id_fkey"
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
      user_signatures: {
        Row: {
          created_at: string
          id: string
          image_url: string
          is_active: boolean
          label: string
          role_kind: string
          school_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          image_url: string
          is_active?: boolean
          label?: string
          role_kind: string
          school_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string
          is_active?: boolean
          label?: string
          role_kind?: string
          school_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_signatures_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_school_sms_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "user_signatures_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_tenant_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "user_signatures_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      waec_practice_sessions: {
        Row: {
          correct_count: number
          created_at: string
          duration_minutes: number | null
          grade: string | null
          id: string
          level: string
          max_score: number
          mode: string
          paper_type: string
          percentage: number
          question_count: number
          question_ids: string[]
          school_id: string | null
          score: number
          started_at: string
          status: string
          student_id: string | null
          subject_id: string
          submitted_at: string | null
          topic_filter: string | null
          unanswered_count: number
          user_id: string
          wrong_count: number
          year_filter: number | null
        }
        Insert: {
          correct_count?: number
          created_at?: string
          duration_minutes?: number | null
          grade?: string | null
          id?: string
          level: string
          max_score?: number
          mode?: string
          paper_type?: string
          percentage?: number
          question_count?: number
          question_ids?: string[]
          school_id?: string | null
          score?: number
          started_at?: string
          status?: string
          student_id?: string | null
          subject_id: string
          submitted_at?: string | null
          topic_filter?: string | null
          unanswered_count?: number
          user_id: string
          wrong_count?: number
          year_filter?: number | null
        }
        Update: {
          correct_count?: number
          created_at?: string
          duration_minutes?: number | null
          grade?: string | null
          id?: string
          level?: string
          max_score?: number
          mode?: string
          paper_type?: string
          percentage?: number
          question_count?: number
          question_ids?: string[]
          school_id?: string | null
          score?: number
          started_at?: string
          status?: string
          student_id?: string | null
          subject_id?: string
          submitted_at?: string | null
          topic_filter?: string | null
          unanswered_count?: number
          user_id?: string
          wrong_count?: number
          year_filter?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "waec_practice_sessions_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_school_sms_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "waec_practice_sessions_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_tenant_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "waec_practice_sessions_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waec_practice_sessions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waec_practice_sessions_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "waec_subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waec_practice_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      waec_questions: {
        Row: {
          ai_model: string | null
          content_hash: string | null
          correct_answer: string
          created_at: string
          difficulty: string
          estimated_time_seconds: number | null
          explanation: string | null
          generated_by: string
          id: string
          is_active: boolean
          keywords: string[]
          learning_objective: string | null
          marking_scheme: string | null
          marks: number
          options: Json | null
          paper_type: string
          question_text: string
          question_type: string
          school_id: string | null
          status: string
          sub_topic: string | null
          subject_id: string
          topic: string | null
          updated_at: string
          year: number | null
        }
        Insert: {
          ai_model?: string | null
          content_hash?: string | null
          correct_answer: string
          created_at?: string
          difficulty?: string
          estimated_time_seconds?: number | null
          explanation?: string | null
          generated_by?: string
          id?: string
          is_active?: boolean
          keywords?: string[]
          learning_objective?: string | null
          marking_scheme?: string | null
          marks?: number
          options?: Json | null
          paper_type?: string
          question_text: string
          question_type?: string
          school_id?: string | null
          status?: string
          sub_topic?: string | null
          subject_id: string
          topic?: string | null
          updated_at?: string
          year?: number | null
        }
        Update: {
          ai_model?: string | null
          content_hash?: string | null
          correct_answer?: string
          created_at?: string
          difficulty?: string
          estimated_time_seconds?: number | null
          explanation?: string | null
          generated_by?: string
          id?: string
          is_active?: boolean
          keywords?: string[]
          learning_objective?: string | null
          marking_scheme?: string | null
          marks?: number
          options?: Json | null
          paper_type?: string
          question_text?: string
          question_type?: string
          school_id?: string | null
          status?: string
          sub_topic?: string | null
          subject_id?: string
          topic?: string | null
          updated_at?: string
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "waec_questions_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_school_sms_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "waec_questions_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_tenant_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "waec_questions_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waec_questions_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "waec_subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      waec_session_answers: {
        Row: {
          answered_at: string | null
          id: string
          is_correct: boolean | null
          marks_awarded: number
          question_id: string
          selected_answer: string | null
          session_id: string
        }
        Insert: {
          answered_at?: string | null
          id?: string
          is_correct?: boolean | null
          marks_awarded?: number
          question_id: string
          selected_answer?: string | null
          session_id: string
        }
        Update: {
          answered_at?: string | null
          id?: string
          is_correct?: boolean | null
          marks_awarded?: number
          question_id?: string
          selected_answer?: string | null
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "waec_session_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "waec_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waec_session_answers_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "waec_practice_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      waec_subjects: {
        Row: {
          category: string | null
          created_at: string
          id: string
          is_active: boolean
          level: string
          name: string
          sort_order: number
        }
        Insert: {
          category?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          level: string
          name: string
          sort_order?: number
        }
        Update: {
          category?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          level?: string
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      weekly_attention_reports: {
        Row: {
          academic_notes: string | null
          attention_summary: string
          behavioural_notes: string | null
          class_id: string | null
          created_at: string
          id: string
          metadata: Json
          recommendations: string | null
          school_id: string
          sent_by: string | null
          sent_via_whatsapp_at: string | null
          status: string
          student_id: string
          teacher_id: string | null
          updated_at: string
          week_end: string
          week_start: string
          whatsapp_delivery_id: string | null
        }
        Insert: {
          academic_notes?: string | null
          attention_summary: string
          behavioural_notes?: string | null
          class_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          recommendations?: string | null
          school_id: string
          sent_by?: string | null
          sent_via_whatsapp_at?: string | null
          status?: string
          student_id: string
          teacher_id?: string | null
          updated_at?: string
          week_end: string
          week_start: string
          whatsapp_delivery_id?: string | null
        }
        Update: {
          academic_notes?: string | null
          attention_summary?: string
          behavioural_notes?: string | null
          class_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          recommendations?: string | null
          school_id?: string
          sent_by?: string | null
          sent_via_whatsapp_at?: string | null
          status?: string
          student_id?: string
          teacher_id?: string | null
          updated_at?: string
          week_end?: string
          week_start?: string
          whatsapp_delivery_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "weekly_attention_reports_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "weekly_attention_reports_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "school_classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "weekly_attention_reports_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_school_sms_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "weekly_attention_reports_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_tenant_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "weekly_attention_reports_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "weekly_attention_reports_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "weekly_attention_reports_whatsapp_delivery_id_fkey"
            columns: ["whatsapp_delivery_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_deliveries"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_deliveries: {
        Row: {
          attempt_count: number
          created_at: string
          created_by: string | null
          delivered_at: string | null
          document_url: string | null
          error_message: string | null
          id: string
          idempotency_key: string | null
          max_attempts: number
          message_body: string | null
          message_type: string
          metadata: Json
          parent_id: string | null
          provider: string | null
          provider_message_id: string | null
          queued_at: string | null
          recipient_name: string | null
          recipient_phone: string | null
          related_entity_id: string | null
          related_entity_type: string | null
          school_id: string
          sent_at: string | null
          status: string
          student_id: string | null
          updated_at: string
        }
        Insert: {
          attempt_count?: number
          created_at?: string
          created_by?: string | null
          delivered_at?: string | null
          document_url?: string | null
          error_message?: string | null
          id?: string
          idempotency_key?: string | null
          max_attempts?: number
          message_body?: string | null
          message_type: string
          metadata?: Json
          parent_id?: string | null
          provider?: string | null
          provider_message_id?: string | null
          queued_at?: string | null
          recipient_name?: string | null
          recipient_phone?: string | null
          related_entity_id?: string | null
          related_entity_type?: string | null
          school_id: string
          sent_at?: string | null
          status?: string
          student_id?: string | null
          updated_at?: string
        }
        Update: {
          attempt_count?: number
          created_at?: string
          created_by?: string | null
          delivered_at?: string | null
          document_url?: string | null
          error_message?: string | null
          id?: string
          idempotency_key?: string | null
          max_attempts?: number
          message_body?: string | null
          message_type?: string
          metadata?: Json
          parent_id?: string | null
          provider?: string | null
          provider_message_id?: string | null
          queued_at?: string | null
          recipient_name?: string | null
          recipient_phone?: string | null
          related_entity_id?: string | null
          related_entity_type?: string | null
          school_id?: string
          sent_at?: string | null
          status?: string
          student_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_deliveries_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "parents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_deliveries_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_school_sms_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "whatsapp_deliveries_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_tenant_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "whatsapp_deliveries_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_deliveries_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      parent_students: {
        Row: {
          id: string | null
          parent_id: string | null
          relationship: string | null
          student_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "parent_student_links_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parents_user_id_fkey"
            columns: ["parent_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_school_sms_overview_v: {
        Row: {
          last_sms_at: string | null
          plan_name: string | null
          school_code: string | null
          school_id: string | null
          school_name: string | null
          sms_admin_override: boolean | null
          sms_enabled: boolean | null
          sms_enabled_at: string | null
          sms_sent_30d: number | null
          sms_sent_total: number | null
          subscription_expires_at: string | null
          subscription_status:
            | Database["public"]["Enums"]["subscription_status"]
            | null
        }
        Relationships: []
      }
      platform_tenant_overview_v: {
        Row: {
          admin_approval_status: string | null
          created_at: string | null
          expires_at: string | null
          is_active: boolean | null
          parent_count: number | null
          payment_completed: boolean | null
          plan_name: string | null
          plan_slug: string | null
          primary_admin_email: string | null
          primary_admin_name: string | null
          primary_admin_phone: string | null
          school_code: string | null
          school_id: string | null
          school_name: string | null
          storage_limit_mb: number | null
          storage_used_mb: number | null
          student_count: number | null
          subscription_status:
            | Database["public"]["Enums"]["subscription_status"]
            | null
          teacher_count: number | null
          trial_ends_at: string | null
          user_count: number | null
        }
        Relationships: []
      }
      school_classes: {
        Row: {
          id: string | null
          level: string | null
          name: string | null
          school_id: string | null
          stream: string | null
        }
        Insert: {
          id?: string | null
          level?: string | null
          name?: string | null
          school_id?: string | null
          stream?: string | null
        }
        Update: {
          id?: string | null
          level?: string | null
          name?: string | null
          school_id?: string | null
          stream?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "classes_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_school_sms_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "classes_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "platform_tenant_overview_v"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "classes_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      _apply_allocation_to_item: {
        Args: {
          p_actor_user_id: string
          p_amount: number
          p_invoice_item_id: string
          p_payment_id: string
          p_school_id: string
        }
        Returns: undefined
      }
      _google_refresh_access_token: {
        Args: { p_school_id: string }
        Returns: string
      }
      _safe_exec: { Args: { p_sql: string }; Returns: undefined }
      activate_organization_subscription: {
        Args: {
          p_amount?: number
          p_payment_status?: string
          p_paystack_transaction_id?: string
          p_reference: string
        }
        Returns: Json
      }
      admin_account_portal_allowed: {
        Args: { p_user_id: string }
        Returns: boolean
      }
      allocate_account_payment: {
        Args: { p_manual_allocations?: Json; p_payment_id: string }
        Returns: Json
      }
      apply_school_sms_package_credits: {
        Args: { p_plan_id: string; p_school_id: string }
        Returns: undefined
      }
      apply_subscription_plan_to_school: {
        Args: {
          p_expires_at?: string
          p_plan_id: string
          p_school_id: string
          p_status?: Database["public"]["Enums"]["subscription_status"]
        }
        Returns: Json
      }
      apply_subscription_plan_to_school_internal: {
        Args: { p_plan_id: string; p_school_id: string }
        Returns: undefined
      }
      approve_organization_subscription: {
        Args: { p_school_id: string }
        Returns: Json
      }
      approve_waec_drafts_for_subject: {
        Args: { p_subject_id: string }
        Returns: Json
      }
      assign_class_teacher: {
        Args: { p_class_id: string; p_teacher_id: string }
        Returns: undefined
      }
      backfill_billing_accounts_for_school: {
        Args: { p_school_id: string }
        Returns: Json
      }
      build_arkesel_sms_url: {
        Args: {
          p_api_key: string
          p_message: string
          p_sender: string
          p_to_phone: string
        }
        Returns: string
      }
      can_manage_role_permissions: {
        Args: { _school_id?: string; _user_id: string }
        Returns: boolean
      }
      can_manage_term_report_card: {
        Args: {
          p_class_id: string
          p_school_id: string
          p_student_id: string
          p_user_id: string
        }
        Returns: boolean
      }
      check_my_teacher_account_active: { Args: never; Returns: Json }
      checkout_hostel_allocation: {
        Args: { p_allocation_id: string }
        Returns: Json
      }
      class_teacher_student_overview: {
        Args: { p_class_id: string }
        Returns: {
          admission_no: string
          alert_low_attendance: boolean
          alert_low_performance: boolean
          attendance_percent: number
          average_score: number
          failing_subjects: number
          full_name: string
          present_days: number
          student_id: string
          total_days: number
        }[]
      }
      cleanup_student_before_delete: {
        Args: { p_student_id: string }
        Returns: undefined
      }
      cleanup_teacher_before_delete: {
        Args: { p_teacher_id: string }
        Returns: undefined
      }
      confirm_paystack_payment: { Args: { p_reference: string }; Returns: Json }
      confirm_shop_paystack_payment: {
        Args: { p_reference: string }
        Returns: Json
      }
      consume_school_sms_credit: {
        Args: { p_count?: number; p_school_id: string }
        Returns: Json
      }
      create_academic_recommendation: {
        Args: {
          p_recommendation_type: string
          p_strengths?: string
          p_student_id: string
          p_suggestions: string
          p_term_id?: string
          p_threshold_alert?: boolean
          p_weaknesses?: string
        }
        Returns: string
      }
      create_billing_job: {
        Args: {
          p_academic_term: string
          p_school_id: string
          p_term_id?: string
        }
        Returns: string
      }
      create_live_class_via_google: {
        Args: {
          p_class_id: string
          p_description?: string
          p_end_time: string
          p_recording_enabled?: boolean
          p_recurrence_end_date?: string
          p_recurrence_rule?: Json
          p_recurrence_type?: string
          p_schedule_id?: string
          p_school_id: string
          p_session_date: string
          p_start_time: string
          p_subject_id: string
          p_teacher_id: string
          p_timezone?: string
          p_title: string
        }
        Returns: Json
      }
      create_notification: {
        Args: {
          p_body: string
          p_data?: Json
          p_title: string
          p_user_id: string
        }
        Returns: string
      }
      create_or_get_class_register: {
        Args: {
          p_academic_year_id?: string
          p_class_id: string
          p_created_by?: string
          p_period_label?: string
          p_register_date: string
          p_school_id: string
          p_session_label?: string
          p_subject_id: string
          p_teacher_id: string
          p_term_id?: string
        }
        Returns: string
      }
      ensure_student_billing_account: {
        Args: { p_student_id: string }
        Returns: string
      }
      ensure_transport_fee_category: {
        Args: { p_school_id: string }
        Returns: string
      }
      exchange_google_oauth_code: {
        Args: { p_code: string; p_redirect_uri: string; p_state?: string }
        Returns: Json
      }
      finalize_live_class_session: {
        Args: { p_session_id: string }
        Returns: undefined
      }
      gemini_chat: {
        Args: {
          p_context?: Json
          p_conversation_id?: string
          p_history?: Json
          p_message: string
        }
        Returns: Json
      }
      gemini_chat_usage_stats: { Args: never; Returns: Json }
      get_achievements_dashboard_stats: {
        Args: { p_school_id: string }
        Returns: Json
      }
      get_google_oauth_public_config: {
        Args: { p_school_id: string }
        Returns: Json
      }
      get_hostel_dashboard_stats: {
        Args: { p_school_id: string }
        Returns: Json
      }
      get_inventory_dashboard_stats: {
        Args: { p_school_id: string }
        Returns: Json
      }
      get_my_admin_verification_status: { Args: never; Returns: Json }
      get_organization_subscription_access: {
        Args: { p_school_id: string }
        Returns: Json
      }
      get_parent_children_user_ids: {
        Args: { _parent_user_id: string }
        Returns: string[]
      }
      get_parent_teacher_user_ids: {
        Args: { _parent_user_id: string }
        Returns: string[]
      }
      get_paystack_checkout_context: {
        Args: { p_invoice_id: string }
        Returns: Json
      }
      get_platform_ai_status: { Args: never; Returns: Json }
      get_platform_paystack_config: { Args: never; Returns: Json }
      get_platform_sms_gateway_status: { Args: never; Returns: Json }
      get_school_sms_balance: { Args: { p_school_id: string }; Returns: number }
      get_school_teacher_user_ids: {
        Args: { _teacher_user_id: string }
        Returns: string[]
      }
      get_shop_paystack_checkout_context: {
        Args: { p_order_id: string }
        Returns: Json
      }
      get_student_classmate_user_ids: {
        Args: { _student_user_id: string }
        Returns: string[]
      }
      get_student_teacher_user_ids: {
        Args: { _student_user_id: string }
        Returns: string[]
      }
      get_student_transport_info: {
        Args: { p_student_id: string }
        Returns: Json
      }
      get_teacher_parent_user_ids: {
        Args: { _teacher_user_id: string }
        Returns: string[]
      }
      get_teacher_student_user_ids: {
        Args: { _teacher_user_id: string }
        Returns: string[]
      }
      get_transport_assignments_report: {
        Args: { p_school_id: string }
        Returns: {
          admission_number: string
          bus_name: string
          class_name: string
          fare_amount: number
          route_name: string
          status: string
          stop_name: string
          student_id: string
          student_name: string
        }[]
      }
      get_user_permissions: {
        Args: { _school_id?: string; _user_id: string }
        Returns: string[]
      }
      get_user_school_id: { Args: { _user_id: string }; Returns: string }
      get_waec_question_catalog: { Args: { p_level?: string }; Returns: Json }
      get_waec_student_dashboard: { Args: { p_user_id: string }; Returns: Json }
      grant_all_school_module_entitlements: {
        Args: { p_school_id: string }
        Returns: Json
      }
      grant_complimentary_subscription: {
        Args: {
          p_billing_cycle?: string
          p_expires_at?: string
          p_plan_id: string
          p_school_id: string
        }
        Returns: Json
      }
      has_permission: {
        Args: {
          _permission_code: string
          _school_id?: string
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_role_slug: {
        Args: { _school_id?: string; _slug: string; _user_id: string }
        Returns: boolean
      }
      init_platform_subscription_checkout: {
        Args: {
          p_billing_cycle?: string
          p_callback_url?: string
          p_enable_sms?: boolean
          p_package_amount?: number
          p_plan_id: string
          p_sms_amount?: number
          p_total_amount?: number
        }
        Returns: Json
      }
      insert_waec_generated_questions: {
        Args: {
          p_ai_model: string
          p_auto_approve?: boolean
          p_rows: Json
          p_school_id: string
          p_subject_id: string
        }
        Returns: Json
      }
      inventory_item_stock_status: {
        Args: { p_quantity: number; p_reorder: number }
        Returns: string
      }
      is_class_teacher_of: {
        Args: { _class_id: string; _user_id: string }
        Returns: boolean
      }
      is_platform_super_admin: { Args: { p_uid?: string }; Returns: boolean }
      is_portal_student: { Args: { _user_id: string }; Returns: boolean }
      is_school_admin: {
        Args: { _school_id: string; _user_id: string }
        Returns: boolean
      }
      link_parent_children_by_admission: {
        Args: { p_admission_numbers: string[] }
        Returns: Json
      }
      list_teachers_for_payroll: {
        Args: { p_school_id: string }
        Returns: {
          admission_number: string
          base_monthly_salary: number
          class_label: string
          default_allowances: number
          default_deductions: number
          email: string
          first_name: string
          last_name: string
          payment_account_holder: string
          payment_account_number: string
          payment_bank_code: string
          payment_bank_name: string
          payment_mobile_money_number: string
          payment_mobile_money_provider: string
          payment_notes: string
          phone: string
          preferred_payout_method: string
          subject_label: string
          user_id: string
        }[]
      }
      log_login_activity_event: {
        Args: {
          p_email: string
          p_failure_reason?: string
          p_success: boolean
          p_user_agent?: string
        }
        Returns: undefined
      }
      log_subscription_audit: {
        Args: {
          p_action: string
          p_details?: Json
          p_payment_reference?: string
          p_school_id: string
          p_user_id?: string
        }
        Returns: undefined
      }
      map_register_status_to_legacy: {
        Args: { p_status: string }
        Returns: string
      }
      normalize_sms_phone: { Args: { raw: string }; Returns: string }
      notify_school_admins_subscription: {
        Args: {
          p_body: string
          p_data?: Json
          p_school_id: string
          p_title: string
        }
        Returns: number
      }
      parent_can_view_teacher: {
        Args: { parent_user_id: string; teacher_id: string }
        Returns: boolean
      }
      place_shop_order: {
        Args: {
          p_coupon_code?: string
          p_customer_email?: string
          p_customer_name: string
          p_customer_phone?: string
          p_fulfillment_method?: string
          p_items: Json
          p_notes?: string
          p_portal_role?: string
          p_school_id: string
          p_shipping_address?: string
          p_student_id?: string
        }
        Returns: Json
      }
      prepare_teacher_attendance_sms_register: {
        Args: { p_class_id: string; p_date: string }
        Returns: string
      }
      process_billing_job_chunk: {
        Args: { p_chunk_size?: number; p_job_id: string }
        Returns: Json
      }
      reassign_billing_invoice: {
        Args: {
          p_due_date?: string
          p_invoice_id: string
          p_student_id: string
          p_term_id?: string
        }
        Returns: undefined
      }
      recalculate_class_rankings: {
        Args: { p_class_id: string; p_term_id: string }
        Returns: Json
      }
      recompute_attendance_summary: {
        Args: { p_school_id: string; p_student_id: string; p_term_id: string }
        Returns: undefined
      }
      record_account_payment: {
        Args: {
          p_allocation_mode?: string
          p_amount: number
          p_billing_account_id: string
          p_invoice_id: string
          p_manual_allocations?: Json
          p_school_id: string
        }
        Returns: Json
      }
      record_hostel_payment: {
        Args: {
          p_allocation_id: string
          p_amount: number
          p_notes?: string
          p_payment_date?: string
          p_payment_method?: string
          p_receipt_number?: string
        }
        Returns: Json
      }
      record_inventory_stock_movement: {
        Args: {
          p_department?: string
          p_item_id: string
          p_quantity: number
          p_remarks?: string
          p_source_destination?: string
          p_transaction_type: string
        }
        Returns: Json
      }
      refresh_account_invoice_totals: {
        Args: { p_invoice_id: string }
        Returns: undefined
      }
      refresh_billing_account_balance: {
        Args: { p_billing_account_id: string }
        Returns: undefined
      }
      refund_school_sms_credit: {
        Args: { p_count?: number; p_school_id: string }
        Returns: Json
      }
      reject_organization_subscription: {
        Args: { p_reason?: string; p_school_id: string }
        Returns: Json
      }
      report_teacher_record_id: { Args: { p_user_id: string }; Returns: string }
      resolve_login_identifier: {
        Args: { p_identifier: string }
        Returns: Json
      }
      resolve_platform_module_key: { Args: { p_key: string }; Returns: string }
      resolve_student_by_admission_number: {
        Args: { p_admission_number: string }
        Returns: Json
      }
      result_ranking_score: {
        Args: { p_ca: number; p_exam: number }
        Returns: number
      }
      reverse_billing_sent_invoice: {
        Args: { p_invoice_id: string }
        Returns: undefined
      }
      review_class_register: {
        Args: { p_action: string; p_comment?: string; p_register_id: string }
        Returns: undefined
      }
      run_subscription_lifecycle_batch: { Args: never; Returns: Json }
      save_role_permissions: {
        Args: { p_permission_codes: string[]; p_role_id: string }
        Returns: Json
      }
      save_school_module_entitlements: {
        Args: { p_rows: Json; p_school_id: string }
        Returns: Json
      }
      save_teacher_class_attendance: {
        Args: { p_class_id: string; p_date: string; p_records: Json }
        Returns: undefined
      }
      school_dashboard_billing_counts: {
        Args: { _school_id: string }
        Returns: Json
      }
      school_has_platform_module: {
        Args: { p_module_key: string; p_school_id: string }
        Returns: boolean
      }
      school_sms_service_active: {
        Args: { p_school_id: string }
        Returns: boolean
      }
      school_subscription_enforced: {
        Args: { p_school_id: string }
        Returns: boolean
      }
      school_subscription_writable: {
        Args: { p_school_id: string }
        Returns: boolean
      }
      seed_billing_allocation_rules: {
        Args: { p_school_id: string }
        Returns: undefined
      }
      seed_billing_fee_categories: {
        Args: { p_school_id: string }
        Returns: undefined
      }
      send_attendance_sms_for_register: {
        Args: { p_register_id: string }
        Returns: Json
      }
      send_teacher_attendance_sms: {
        Args: { p_class_id: string; p_date: string }
        Returns: Json
      }
      set_platform_school_sms: {
        Args: {
          p_admin_override?: boolean
          p_enabled: boolean
          p_school_id: string
        }
        Returns: Json
      }
      set_school_current_term: {
        Args: { p_term_id: string }
        Returns: undefined
      }
      set_waec_question_status: {
        Args: { p_question_id: string; p_status: string }
        Returns: Json
      }
      sms_phone_for_arkesel: { Args: { intl_phone: string }; Returns: string }
      submit_waec_session: { Args: { p_session_id: string }; Returns: Json }
      sync_hostel_room_occupancy: {
        Args: { p_room_id: string }
        Returns: undefined
      }
      sync_organization_subscription_modules: {
        Args: { p_school_id?: string }
        Returns: Json
      }
      sync_register_to_attendance: {
        Args: { p_register_id: string }
        Returns: undefined
      }
      sync_school_rbac_to_entitlements: {
        Args: { p_school_id: string }
        Returns: undefined
      }
      sync_school_sms_entitlement: {
        Args: { p_school_id: string }
        Returns: undefined
      }
      sync_transport_billing_for_assignment: {
        Args: { p_assignment_id: string }
        Returns: Json
      }
      teacher_can_access_student_report: {
        Args: { p_class_id: string; p_student_id: string; p_teacher_id: string }
        Returns: boolean
      }
      teacher_can_view_parent: {
        Args: { parent_id: string; teacher_user_id: string }
        Returns: boolean
      }
      teacher_can_view_student: {
        Args: { student_class_id: string; teacher_user_id: string }
        Returns: boolean
      }
      teacher_login_blocked_message: {
        Args: { p_user_id: string }
        Returns: string
      }
      teacher_teaches_class: {
        Args: { p_class_id: string; p_teacher_id: string }
        Returns: boolean
      }
      update_class_register_header: {
        Args: {
          p_homework?: string
          p_lesson_objectives?: string
          p_lesson_summary?: string
          p_participation_summary?: string
          p_register_id: string
          p_teacher_signature?: string
          p_teaching_methods?: string
        }
        Returns: undefined
      }
      upsert_google_oauth_config: {
        Args: {
          p_client_id: string
          p_client_secret: string
          p_redirect_uri: string
          p_school_id: string
        }
        Returns: Json
      }
      upsert_hostel_allocation: {
        Args: {
          p_allocation_status?: string
          p_bed_id?: string
          p_block_id: string
          p_check_in_date?: string
          p_expected_check_out_date?: string
          p_fee_amount?: number
          p_notes?: string
          p_room_id: string
          p_student_id: string
        }
        Returns: Json
      }
      upsert_platform_arkesel_key: {
        Args: { p_api_key: string }
        Returns: Json
      }
      upsert_platform_gemini_key: {
        Args: { p_api_key: string; p_monthly_limit?: number }
        Returns: Json
      }
      upsert_register_entries: {
        Args: { p_entries: Json; p_register_id: string }
        Returns: undefined
      }
      upsert_student_transport_assignment: {
        Args: {
          p_bus_id: string
          p_notes?: string
          p_status?: string
          p_stop_id: string
          p_student_id: string
        }
        Returns: Json
      }
      upsert_term_report_card: { Args: { p_row: Json }; Returns: Json }
      url_query_encode: { Args: { input: string }; Returns: string }
      user_can_access_live_session: {
        Args: { p_session_id: string; p_user_id: string }
        Returns: boolean
      }
      user_can_access_school: {
        Args: { _school_id: string; _user_id: string }
        Returns: boolean
      }
      user_has_payroll_permission: {
        Args: { _require_manage?: boolean; _school_id: string; _uid: string }
        Returns: boolean
      }
      waec_grade_from_percentage: { Args: { p_pct: number }; Returns: string }
      waec_question_hash: { Args: { p_text: string }; Returns: string }
      write_audit_log: {
        Args: {
          p_action_type: string
          p_details?: Json
          p_entity_id: string
          p_entity_type: string
          p_module?: string
          p_new_values?: Json
          p_old_values?: Json
          p_record_id?: string
          p_school_id: string
        }
        Returns: string
      }
      write_financial_audit_log: {
        Args: {
          p_action: string
          p_actor_user_id: string
          p_entity_id: string
          p_entity_type: string
          p_metadata?: Json
          p_new_balance: number
          p_old_balance: number
          p_school_id: string
        }
        Returns: undefined
      }
    }
    Enums: {
      account_invoice_status:
        | "draft"
        | "issued"
        | "partially_paid"
        | "paid"
        | "void"
        | "overdue"
      account_payment_status: "pending" | "completed" | "failed" | "refunded"
      admin_approval_status: "pending_verification" | "approved" | "rejected"
      app_role:
        | "admin"
        | "teacher"
        | "parent"
        | "student"
        | "super_admin"
        | "accountant"
        | "auditor"
      approval_status: "pending" | "approved" | "rejected" | "cancelled"
      billing_account_status: "active" | "suspended" | "closed"
      billing_invoice_status:
        | "draft"
        | "sent"
        | "viewed"
        | "partially_paid"
        | "paid"
        | "overdue"
        | "void"
      billing_job_status: "queued" | "running" | "completed" | "failed"
      billing_payment_gateway: "paystack" | "stripe" | "flutterwave" | "manual"
      billing_payment_method:
        | "card"
        | "mobile_money"
        | "bank_transfer"
        | "ussd"
        | "cash"
        | "pos_terminal"
      billing_payment_status:
        | "pending"
        | "processing"
        | "paid"
        | "failed"
        | "refunded"
        | "disputed"
      class_register_status: "draft" | "submitted" | "approved" | "rejected"
      fee_scope: "global" | "grade" | "student"
      lesson_note_status:
        | "draft"
        | "pending_review"
        | "approved"
        | "rejected"
        | "needs_correction"
      report_card_status:
        | "draft"
        | "saved"
        | "pending_review"
        | "reviewed"
        | "approved"
        | "published"
        | "rejected"
      subscription_status:
        | "trial"
        | "active"
        | "suspended"
        | "expired"
        | "cancelled"
        | "pending"
        | "locked"
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
      account_invoice_status: [
        "draft",
        "issued",
        "partially_paid",
        "paid",
        "void",
        "overdue",
      ],
      account_payment_status: ["pending", "completed", "failed", "refunded"],
      admin_approval_status: ["pending_verification", "approved", "rejected"],
      app_role: [
        "admin",
        "teacher",
        "parent",
        "student",
        "super_admin",
        "accountant",
        "auditor",
      ],
      approval_status: ["pending", "approved", "rejected", "cancelled"],
      billing_account_status: ["active", "suspended", "closed"],
      billing_invoice_status: [
        "draft",
        "sent",
        "viewed",
        "partially_paid",
        "paid",
        "overdue",
        "void",
      ],
      billing_job_status: ["queued", "running", "completed", "failed"],
      billing_payment_gateway: ["paystack", "stripe", "flutterwave", "manual"],
      billing_payment_method: [
        "card",
        "mobile_money",
        "bank_transfer",
        "ussd",
        "cash",
        "pos_terminal",
      ],
      billing_payment_status: [
        "pending",
        "processing",
        "paid",
        "failed",
        "refunded",
        "disputed",
      ],
      class_register_status: ["draft", "submitted", "approved", "rejected"],
      fee_scope: ["global", "grade", "student"],
      lesson_note_status: [
        "draft",
        "pending_review",
        "approved",
        "rejected",
        "needs_correction",
      ],
      report_card_status: [
        "draft",
        "saved",
        "pending_review",
        "reviewed",
        "approved",
        "published",
        "rejected",
      ],
      subscription_status: [
        "trial",
        "active",
        "suspended",
        "expired",
        "cancelled",
        "pending",
        "locked",
      ],
    },
  },
} as const
