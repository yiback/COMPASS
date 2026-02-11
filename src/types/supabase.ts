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
      academies: {
        Row: {
          address: string | null
          created_at: string | null
          id: string
          invite_code: string | null
          is_active: boolean | null
          logo_url: string | null
          name: string
          phone: string | null
          settings: Json | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string | null
          id?: string
          invite_code?: string | null
          is_active?: boolean | null
          logo_url?: string | null
          name: string
          phone?: string | null
          settings?: Json | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string | null
          id?: string
          invite_code?: string | null
          is_active?: boolean | null
          logo_url?: string | null
          name?: string
          phone?: string | null
          settings?: Json | null
          updated_at?: string | null
        }
        Relationships: []
      }
      achievement_standards: {
        Row: {
          code: string
          content: string
          created_at: string | null
          curriculum_version: string | null
          grade: number
          id: string
          is_active: boolean | null
          keywords: string[] | null
          semester: number | null
          sub_unit: string | null
          subject: string
          unit: string | null
          updated_at: string | null
        }
        Insert: {
          code: string
          content: string
          created_at?: string | null
          curriculum_version?: string | null
          grade: number
          id?: string
          is_active?: boolean | null
          keywords?: string[] | null
          semester?: number | null
          sub_unit?: string | null
          subject: string
          unit?: string | null
          updated_at?: string | null
        }
        Update: {
          code?: string
          content?: string
          created_at?: string | null
          curriculum_version?: string | null
          grade?: number
          id?: string
          is_active?: boolean | null
          keywords?: string[] | null
          semester?: number | null
          sub_unit?: string | null
          subject?: string
          unit?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      ai_generation_logs: {
        Row: {
          academy_id: string
          action_type: string
          created_at: string | null
          duration_ms: number | null
          error_message: string | null
          id: string
          input_params: Json | null
          model: string
          output_data: Json | null
          provider: string
          status: string | null
          token_count: number | null
          user_id: string
        }
        Insert: {
          academy_id: string
          action_type: string
          created_at?: string | null
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          input_params?: Json | null
          model: string
          output_data?: Json | null
          provider: string
          status?: string | null
          token_count?: number | null
          user_id: string
        }
        Update: {
          academy_id?: string
          action_type?: string
          created_at?: string | null
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          input_params?: Json | null
          model?: string
          output_data?: Json | null
          provider?: string
          status?: string | null
          token_count?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_generation_logs_academy_id_fkey"
            columns: ["academy_id"]
            isOneToOne: false
            referencedRelation: "academies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_generation_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      answers: {
        Row: {
          ai_confidence: number | null
          ai_feedback: string | null
          ai_score: number | null
          answer_image_url: string | null
          created_at: string | null
          id: string
          is_correct: boolean | null
          max_score: number | null
          needs_review: boolean | null
          question_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          score: number | null
          student_answer: string | null
          submission_id: string
          teacher_feedback: string | null
          teacher_score: number | null
        }
        Insert: {
          ai_confidence?: number | null
          ai_feedback?: string | null
          ai_score?: number | null
          answer_image_url?: string | null
          created_at?: string | null
          id?: string
          is_correct?: boolean | null
          max_score?: number | null
          needs_review?: boolean | null
          question_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          score?: number | null
          student_answer?: string | null
          submission_id: string
          teacher_feedback?: string | null
          teacher_score?: number | null
        }
        Update: {
          ai_confidence?: number | null
          ai_feedback?: string | null
          ai_score?: number | null
          answer_image_url?: string | null
          created_at?: string | null
          id?: string
          is_correct?: boolean | null
          max_score?: number | null
          needs_review?: boolean | null
          question_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          score?: number | null
          student_answer?: string | null
          submission_id?: string
          teacher_feedback?: string | null
          teacher_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "answers_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "answers_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "exam_submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      exam_questions: {
        Row: {
          exam_id: string
          id: string
          order_number: number
          points: number | null
          question_id: string
        }
        Insert: {
          exam_id: string
          id?: string
          order_number: number
          points?: number | null
          question_id: string
        }
        Update: {
          exam_id?: string
          id?: string
          order_number?: number
          points?: number | null
          question_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "exam_questions_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "exams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_questions_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
      }
      exam_submissions: {
        Row: {
          academy_id: string
          answer_sheet_urls: string[] | null
          created_at: string | null
          exam_id: string
          id: string
          max_score: number | null
          started_at: string | null
          status: string | null
          student_id: string
          submitted_at: string | null
          total_score: number | null
          updated_at: string | null
        }
        Insert: {
          academy_id: string
          answer_sheet_urls?: string[] | null
          created_at?: string | null
          exam_id: string
          id?: string
          max_score?: number | null
          started_at?: string | null
          status?: string | null
          student_id: string
          submitted_at?: string | null
          total_score?: number | null
          updated_at?: string | null
        }
        Update: {
          academy_id?: string
          answer_sheet_urls?: string[] | null
          created_at?: string | null
          exam_id?: string
          id?: string
          max_score?: number | null
          started_at?: string | null
          status?: string | null
          student_id?: string
          submitted_at?: string | null
          total_score?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "exam_submissions_academy_id_fkey"
            columns: ["academy_id"]
            isOneToOne: false
            referencedRelation: "academies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_submissions_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "exams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_submissions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      exams: {
        Row: {
          academy_id: string
          created_at: string | null
          created_by: string
          deadline_at: string | null
          description: string | null
          duration_minutes: number | null
          grade: number
          id: string
          scheduled_at: string | null
          status: string | null
          subject: string
          target_school_id: string | null
          title: string
          total_points: number | null
          updated_at: string | null
        }
        Insert: {
          academy_id: string
          created_at?: string | null
          created_by: string
          deadline_at?: string | null
          description?: string | null
          duration_minutes?: number | null
          grade: number
          id?: string
          scheduled_at?: string | null
          status?: string | null
          subject: string
          target_school_id?: string | null
          title: string
          total_points?: number | null
          updated_at?: string | null
        }
        Update: {
          academy_id?: string
          created_at?: string | null
          created_by?: string
          deadline_at?: string | null
          description?: string | null
          duration_minutes?: number | null
          grade?: number
          id?: string
          scheduled_at?: string | null
          status?: string | null
          subject?: string
          target_school_id?: string | null
          title?: string
          total_points?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "exams_academy_id_fkey"
            columns: ["academy_id"]
            isOneToOne: false
            referencedRelation: "academies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exams_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exams_target_school_id_fkey"
            columns: ["target_school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      grade_appeals: {
        Row: {
          academy_id: string
          answer_id: string
          created_at: string | null
          id: string
          reason: string
          review_comment: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string | null
          student_id: string
          updated_at: string | null
        }
        Insert: {
          academy_id: string
          answer_id: string
          created_at?: string | null
          id?: string
          reason: string
          review_comment?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string | null
          student_id: string
          updated_at?: string | null
        }
        Update: {
          academy_id?: string
          answer_id?: string
          created_at?: string | null
          id?: string
          reason?: string
          review_comment?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string | null
          student_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "grade_appeals_academy_id_fkey"
            columns: ["academy_id"]
            isOneToOne: false
            referencedRelation: "academies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grade_appeals_answer_id_fkey"
            columns: ["answer_id"]
            isOneToOne: false
            referencedRelation: "answers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grade_appeals_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grade_appeals_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      past_exam_questions: {
        Row: {
          academy_id: string
          achievement_standard_id: string | null
          created_at: string | null
          exam_type: string
          extracted_content: string | null
          extraction_status: string | null
          grade: number
          id: string
          question_id: string | null
          school_id: string
          semester: number
          source_image_url: string | null
          subject: string
          updated_at: string | null
          uploaded_by: string | null
          year: number
        }
        Insert: {
          academy_id: string
          achievement_standard_id?: string | null
          created_at?: string | null
          exam_type: string
          extracted_content?: string | null
          extraction_status?: string | null
          grade: number
          id?: string
          question_id?: string | null
          school_id: string
          semester: number
          source_image_url?: string | null
          subject: string
          updated_at?: string | null
          uploaded_by?: string | null
          year: number
        }
        Update: {
          academy_id?: string
          achievement_standard_id?: string | null
          created_at?: string | null
          exam_type?: string
          extracted_content?: string | null
          extraction_status?: string | null
          grade?: number
          id?: string
          question_id?: string | null
          school_id?: string
          semester?: number
          source_image_url?: string | null
          subject?: string
          updated_at?: string | null
          uploaded_by?: string | null
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "past_exam_questions_academy_id_fkey"
            columns: ["academy_id"]
            isOneToOne: false
            referencedRelation: "academies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "past_exam_questions_achievement_standard_id_fkey"
            columns: ["achievement_standard_id"]
            isOneToOne: false
            referencedRelation: "achievement_standards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "past_exam_questions_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "past_exam_questions_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "past_exam_questions_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          academy_id: string | null
          avatar_url: string | null
          created_at: string | null
          email: string
          id: string
          is_active: boolean | null
          name: string
          phone: string | null
          role: string
          updated_at: string | null
        }
        Insert: {
          academy_id?: string | null
          avatar_url?: string | null
          created_at?: string | null
          email: string
          id: string
          is_active?: boolean | null
          name: string
          phone?: string | null
          role: string
          updated_at?: string | null
        }
        Update: {
          academy_id?: string | null
          avatar_url?: string | null
          created_at?: string | null
          email?: string
          id?: string
          is_active?: boolean | null
          name?: string
          phone?: string | null
          role?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_academy_id_fkey"
            columns: ["academy_id"]
            isOneToOne: false
            referencedRelation: "academies"
            referencedColumns: ["id"]
          },
        ]
      }
      questions: {
        Row: {
          academy_id: string
          achievement_standard_id: string | null
          ai_generation: number | null
          ai_model: string | null
          ai_prompt: string | null
          ai_review_status: string | null
          answer: string
          content: string
          created_at: string | null
          created_by: string | null
          difficulty: number | null
          explanation: string | null
          grade: number
          id: string
          is_ai_generated: boolean | null
          options: Json | null
          points: number | null
          reviewed_at: string | null
          reviewed_by: string | null
          source_metadata: Json | null
          source_type: string | null
          subject: string
          type: string
          unit: string | null
          updated_at: string | null
        }
        Insert: {
          academy_id: string
          achievement_standard_id?: string | null
          ai_generation?: number | null
          ai_model?: string | null
          ai_prompt?: string | null
          ai_review_status?: string | null
          answer: string
          content: string
          created_at?: string | null
          created_by?: string | null
          difficulty?: number | null
          explanation?: string | null
          grade: number
          id?: string
          is_ai_generated?: boolean | null
          options?: Json | null
          points?: number | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_metadata?: Json | null
          source_type?: string | null
          subject: string
          type: string
          unit?: string | null
          updated_at?: string | null
        }
        Update: {
          academy_id?: string
          achievement_standard_id?: string | null
          ai_generation?: number | null
          ai_model?: string | null
          ai_prompt?: string | null
          ai_review_status?: string | null
          answer?: string
          content?: string
          created_at?: string | null
          created_by?: string | null
          difficulty?: number | null
          explanation?: string | null
          grade?: number
          id?: string
          is_ai_generated?: boolean | null
          options?: Json | null
          points?: number | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_metadata?: Json | null
          source_type?: string | null
          subject?: string
          type?: string
          unit?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "questions_academy_id_fkey"
            columns: ["academy_id"]
            isOneToOne: false
            referencedRelation: "academies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questions_achievement_standard_id_fkey"
            columns: ["achievement_standard_id"]
            isOneToOne: false
            referencedRelation: "achievement_standards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questions_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      schools: {
        Row: {
          address: string | null
          created_at: string | null
          district: string | null
          id: string
          name: string
          region: string | null
          school_type: string
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string | null
          district?: string | null
          id?: string
          name: string
          region?: string | null
          school_type: string
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string | null
          district?: string | null
          id?: string
          name?: string
          region?: string | null
          school_type?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      students: {
        Row: {
          academy_id: string
          created_at: string | null
          grade: number
          id: string
          parent_name: string | null
          parent_phone: string | null
          profile_id: string
          school_id: string | null
          updated_at: string | null
        }
        Insert: {
          academy_id: string
          created_at?: string | null
          grade: number
          id?: string
          parent_name?: string | null
          parent_phone?: string | null
          profile_id: string
          school_id?: string | null
          updated_at?: string | null
        }
        Update: {
          academy_id?: string
          created_at?: string | null
          grade?: number
          id?: string
          parent_name?: string | null
          parent_phone?: string | null
          profile_id?: string
          school_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "students_academy_id_fkey"
            columns: ["academy_id"]
            isOneToOne: false
            referencedRelation: "academies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
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
        ]
      }
      teachers: {
        Row: {
          academy_id: string
          created_at: string | null
          grades: number[] | null
          id: string
          profile_id: string
          subjects: string[] | null
          updated_at: string | null
        }
        Insert: {
          academy_id: string
          created_at?: string | null
          grades?: number[] | null
          id?: string
          profile_id: string
          subjects?: string[] | null
          updated_at?: string | null
        }
        Update: {
          academy_id?: string
          created_at?: string | null
          grades?: number[] | null
          id?: string
          profile_id?: string
          subjects?: string[] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "teachers_academy_id_fkey"
            columns: ["academy_id"]
            isOneToOne: false
            referencedRelation: "academies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teachers_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      wrong_answer_notes: {
        Row: {
          academy_id: string
          ai_recommendation: string | null
          answer_id: string | null
          correct_answer: string | null
          created_at: string | null
          id: string
          is_reviewed: boolean | null
          last_reviewed_at: string | null
          question_id: string
          review_count: number | null
          student_answer: string | null
          student_id: string
          updated_at: string | null
          weakness_tags: string[] | null
        }
        Insert: {
          academy_id: string
          ai_recommendation?: string | null
          answer_id?: string | null
          correct_answer?: string | null
          created_at?: string | null
          id?: string
          is_reviewed?: boolean | null
          last_reviewed_at?: string | null
          question_id: string
          review_count?: number | null
          student_answer?: string | null
          student_id: string
          updated_at?: string | null
          weakness_tags?: string[] | null
        }
        Update: {
          academy_id?: string
          ai_recommendation?: string | null
          answer_id?: string | null
          correct_answer?: string | null
          created_at?: string | null
          id?: string
          is_reviewed?: boolean | null
          last_reviewed_at?: string | null
          question_id?: string
          review_count?: number | null
          student_answer?: string | null
          student_id?: string
          updated_at?: string | null
          weakness_tags?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "wrong_answer_notes_academy_id_fkey"
            columns: ["academy_id"]
            isOneToOne: false
            referencedRelation: "academies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wrong_answer_notes_answer_id_fkey"
            columns: ["answer_id"]
            isOneToOne: false
            referencedRelation: "answers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wrong_answer_notes_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wrong_answer_notes_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_academy_id: { Args: never; Returns: string }
      get_user_role: { Args: never; Returns: string }
      has_any_role: { Args: { required_roles: string[] }; Returns: boolean }
      has_role: { Args: { required_role: string }; Returns: boolean }
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
