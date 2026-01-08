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
    PostgrestVersion: "13.0.5"
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
          target_roles: string[] | null
          title: string
        }
        Insert: {
          body: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          priority?: string | null
          target_roles?: string[] | null
          title: string
        }
        Update: {
          body?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          priority?: string | null
          target_roles?: string[] | null
          title?: string
        }
        Relationships: []
      }
      assignments: {
        Row: {
          class_id: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          due_date: string | null
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
          id: string
          online_exam_id: string | null
          started_at: string | null
          status: string | null
          student_id: string | null
          submitted_at: string | null
          total_marks_obtained: number | null
        }
        Insert: {
          id?: string
          online_exam_id?: string | null
          started_at?: string | null
          status?: string | null
          student_id?: string | null
          submitted_at?: string | null
          total_marks_obtained?: number | null
        }
        Update: {
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
          passing_marks: number | null
          proctoring_enabled: boolean | null
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
          passing_marks?: number | null
          proctoring_enabled?: boolean | null
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
          passing_marks?: number | null
          proctoring_enabled?: boolean | null
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
      parents: {
        Row: {
          address: string | null
          created_at: string | null
          id: string
          school_id: string | null
          user_id: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string | null
          id?: string
          school_id?: string | null
          user_id?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string | null
          id?: string
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
          payer_user_id: string | null
          payment_provider: string | null
          provider_reference: string | null
          status: string | null
        }
        Insert: {
          amount?: number | null
          created_at?: string | null
          id?: string
          invoice_id?: string | null
          payer_user_id?: string | null
          payment_provider?: string | null
          provider_reference?: string | null
          status?: string | null
        }
        Update: {
          amount?: number | null
          created_at?: string | null
          id?: string
          invoice_id?: string | null
          payer_user_id?: string | null
          payment_provider?: string | null
          provider_reference?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
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
      schools: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          logo_url: string | null
          school_code: string
          school_name: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          logo_url?: string | null
          school_code: string
          school_name: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          logo_url?: string | null
          school_code?: string
          school_name?: string
        }
        Relationships: []
      }
      students: {
        Row: {
          admission_no: string | null
          class_id: string | null
          created_at: string | null
          date_of_birth: string | null
          gender: string | null
          guardian_id: string | null
          id: string
          school_id: string | null
          user_id: string | null
        }
        Insert: {
          admission_no?: string | null
          class_id?: string | null
          created_at?: string | null
          date_of_birth?: string | null
          gender?: string | null
          guardian_id?: string | null
          id?: string
          school_id?: string | null
          user_id?: string | null
        }
        Update: {
          admission_no?: string | null
          class_id?: string | null
          created_at?: string | null
          date_of_birth?: string | null
          gender?: string | null
          guardian_id?: string | null
          id?: string
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
      get_user_school_id: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_school_admin: {
        Args: { _school_id: string; _user_id: string }
        Returns: boolean
      }
      parent_can_view_teacher: {
        Args: { parent_user_id: string; teacher_id: string }
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
    }
    Enums: {
      app_role: "admin" | "teacher" | "parent" | "student" | "super_admin"
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
      app_role: ["admin", "teacher", "parent", "student", "super_admin"],
    },
  },
} as const
