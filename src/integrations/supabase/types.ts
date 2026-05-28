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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
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
            foreignKeyName: "attendance_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
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
            referencedRelation: "schools"
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
          created_at: string | null
          id: string
          level: string | null
          name: string
          school_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          level?: string | null
          name: string
          school_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          level?: string | null
          name?: string
          school_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "classes_school_id_fkey"
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
          user_id: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string | null
          emergency_contact?: string | null
          id?: string
          phone?: string | null
          school_id?: string | null
          user_id?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string | null
          emergency_contact?: string | null
          id?: string
          phone?: string | null
          school_id?: string | null
          user_id?: string | null
        }
        Relationships: [
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
      profiles: {
        Row: {
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
          report_card_footer: string | null
          school_id: string
          updated_at: string
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
          report_card_footer?: string | null
          school_id: string
          updated_at?: string
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
          report_card_footer?: string | null
          school_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "school_settings_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: true
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      schools: {
        Row: {
          address: string | null
          admin_key: string | null
          created_at: string | null
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
          created_at?: string | null
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
          created_at?: string | null
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
      students: {
        Row: {
          admission_no: string | null
          admission_number: string | null
          class_id: string | null
          created_at: string | null
          date_of_birth: string | null
          full_name: string | null
          gender: string | null
          guardian_id: string | null
          id: string
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
          full_name?: string | null
          gender?: string | null
          guardian_id?: string | null
          id?: string
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
          full_name?: string | null
          gender?: string | null
          guardian_id?: string | null
          id?: string
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
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      teachers: {
        Row: {
          created_at: string | null
          employee_no: string | null
          id: string
          school_id: string | null
          subject_specialty: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          employee_no?: string | null
          id?: string
          school_id?: string | null
          subject_specialty?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          employee_no?: string | null
          id?: string
          school_id?: string | null
          subject_specialty?: string | null
          user_id?: string | null
        }
        Relationships: [
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
          created_at: string
          end_date: string | null
          id: string
          is_current: boolean | null
          name: string
          school_id: string
          session: string
          start_date: string | null
          term_kind: string | null
        }
        Insert: {
          created_at?: string
          end_date?: string | null
          id?: string
          is_current?: boolean | null
          name: string
          school_id: string
          session: string
          start_date?: string | null
          term_kind?: string | null
        }
        Update: {
          created_at?: string
          end_date?: string | null
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
            foreignKeyName: "terms_school_id_fkey"
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
            referencedRelation: "schools"
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
    }
    Functions: {
      can_manage_role_permissions: {
        Args: { _school_id?: string; _user_id: string }
        Returns: boolean
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
      get_parent_children_user_ids: {
        Args: { _parent_user_id: string }
        Returns: string[]
      }
      get_parent_teacher_user_ids: {
        Args: { _parent_user_id: string }
        Returns: string[]
      }
      get_school_teacher_user_ids: {
        Args: { _teacher_user_id: string }
        Returns: string[]
      }
      get_student_classmate_user_ids: {
        Args: { _student_user_id: string }
        Returns: string[]
      }
      get_student_teacher_user_ids: {
        Args: { _student_user_id: string }
        Returns: string[]
      }
      get_teacher_parent_user_ids: {
        Args: { _teacher_user_id: string }
        Returns: string[]
      }
      get_teacher_student_user_ids: {
        Args: { _teacher_user_id: string }
        Returns: string[]
      }
      get_user_permissions: {
        Args: { _school_id?: string; _user_id: string }
        Returns: string[]
      }
      get_user_school_id: { Args: { _user_id: string }; Returns: string }
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
      is_portal_student: { Args: { _user_id: string }; Returns: boolean }
      is_school_admin: {
        Args: { _school_id: string; _user_id: string }
        Returns: boolean
      }
      parent_can_view_teacher: {
        Args: { parent_user_id: string; teacher_id: string }
        Returns: boolean
      }
      recalculate_class_rankings: {
        Args: { p_class_id: string; p_term_id: string }
        Returns: Json
      }
      result_ranking_score: {
        Args: { p_ca: number; p_exam: number }
        Returns: number
      }
      save_role_permissions: {
        Args: { p_permission_codes: string[]; p_role_id: string }
        Returns: Json
      }
      set_school_current_term: {
        Args: { p_term_id: string }
        Returns: undefined
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
      teacher_teaches_class: {
        Args: { p_class_id: string; p_teacher_id: string }
        Returns: boolean
      }
      user_can_access_school: {
        Args: { _school_id: string; _user_id: string }
        Returns: boolean
      }
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
    }
    Enums: {
      app_role:
        | "admin"
        | "teacher"
        | "parent"
        | "student"
        | "super_admin"
        | "accountant"
        | "auditor"
      approval_status: "pending" | "approved" | "rejected" | "cancelled"
      report_card_status:
        | "draft"
        | "saved"
        | "pending_review"
        | "reviewed"
        | "approved"
        | "published"
        | "rejected"
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
      report_card_status: [
        "draft",
        "saved",
        "pending_review",
        "reviewed",
        "approved",
        "published",
        "rejected",
      ],
    },
  },
} as const
