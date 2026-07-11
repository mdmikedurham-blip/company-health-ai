/**
 * Generated-style Database types for the Company Health schema.
 * Keep in sync with supabase/migrations/*.sql
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type UserRole = "owner" | "admin" | "member" | "viewer";
export type ConnectorSyncStatus = "running" | "succeeded" | "failed" | "partial";
export type ConnectorCredentialStatus = "pending" | "connected" | "error";
export type AnalysisSnapshotStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed";

export type Database = {
  public: {
    Tables: {
      companies: {
        Row: {
          id: string;
          name: string;
          plan: string;
          founded: string | null;
          stage: string | null;
          employees: number | null;
          arr: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          plan?: string;
          founded?: string | null;
          stage?: string | null;
          employees?: number | null;
          arr?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          plan?: string;
          founded?: string | null;
          stage?: string | null;
          employees?: number | null;
          arr?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "companies_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      company_assessment_goals: {
        Row: {
          company_id: string;
          goal: string;
          selected_by: string | null;
          selected_at: string;
          last_updated: string;
          updated_at: string;
        };
        Insert: {
          company_id: string;
          goal?: string;
          selected_by?: string | null;
          selected_at?: string;
          last_updated?: string;
          updated_at?: string;
        };
        Update: {
          company_id?: string;
          goal?: string;
          selected_by?: string | null;
          selected_at?: string;
          last_updated?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "company_assessment_goals_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: true;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "company_assessment_goals_selected_by_fkey";
            columns: ["selected_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      company_classifications: {
        Row: {
          id: string;
          company_id: string;
          snapshot_id: string | null;
          stage: string | null;
          industry: string | null;
          business_model: string | null;
          revenue_model: string | null;
          annual_revenue_range: string | null;
          employee_count_range: string | null;
          customer_count_range: string | null;
          funding_status: string | null;
          outside_investors: boolean | null;
          jurisdiction_entity_type: string | null;
          board_required: boolean | null;
          board_present: boolean | null;
          audit_expected: boolean | null;
          security_maturity_expected: string | null;
          confidence: number;
          source_evidence_ids: string[];
          generated_at: string;
          field_provenance: Json;
          inferred: Json;
          inference_rationale: string | null;
          assumptions: Json;
          confirmed: Json;
          confirmed_at: string | null;
          confirmed_by: string | null;
          evidence_coverage_pct: number;
          dimension_coverage: Json;
          missing_required: Json;
          missing_recommended: Json;
          optional_remaining: Json;
          health_score_available: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          snapshot_id?: string | null;
          stage?: string | null;
          industry?: string | null;
          business_model?: string | null;
          revenue_model?: string | null;
          annual_revenue_range?: string | null;
          employee_count_range?: string | null;
          customer_count_range?: string | null;
          funding_status?: string | null;
          outside_investors?: boolean | null;
          jurisdiction_entity_type?: string | null;
          board_required?: boolean | null;
          board_present?: boolean | null;
          audit_expected?: boolean | null;
          security_maturity_expected?: string | null;
          confidence?: number;
          source_evidence_ids?: string[];
          generated_at?: string;
          field_provenance?: Json;
          inferred?: Json;
          inference_rationale?: string | null;
          assumptions?: Json;
          confirmed?: Json;
          confirmed_at?: string | null;
          confirmed_by?: string | null;
          evidence_coverage_pct?: number;
          dimension_coverage?: Json;
          missing_required?: Json;
          missing_recommended?: Json;
          optional_remaining?: Json;
          health_score_available?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string;
          snapshot_id?: string | null;
          stage?: string | null;
          industry?: string | null;
          business_model?: string | null;
          revenue_model?: string | null;
          annual_revenue_range?: string | null;
          employee_count_range?: string | null;
          customer_count_range?: string | null;
          funding_status?: string | null;
          outside_investors?: boolean | null;
          jurisdiction_entity_type?: string | null;
          board_required?: boolean | null;
          board_present?: boolean | null;
          audit_expected?: boolean | null;
          security_maturity_expected?: string | null;
          confidence?: number;
          source_evidence_ids?: string[];
          generated_at?: string;
          field_provenance?: Json;
          inferred?: Json;
          inference_rationale?: string | null;
          assumptions?: Json;
          confirmed?: Json;
          confirmed_at?: string | null;
          confirmed_by?: string | null;
          evidence_coverage_pct?: number;
          dimension_coverage?: Json;
          missing_required?: Json;
          missing_recommended?: Json;
          optional_remaining?: Json;
          health_score_available?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "company_classifications_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: true;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
        ];
      };
      user_preferences: {
        Row: {
          user_id: string;
          active_company_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          active_company_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          active_company_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_preferences_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_preferences_active_company_id_fkey";
            columns: ["active_company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
        ];
      };
      oauth_state_nonces: {
        Row: {
          nonce: string;
          user_id: string;
          company_id: string;
          expires_at: string;
          consumed_at: string | null;
          created_at: string;
        };
        Insert: {
          nonce: string;
          user_id: string;
          company_id: string;
          expires_at: string;
          consumed_at?: string | null;
          created_at?: string;
        };
        Update: {
          nonce?: string;
          user_id?: string;
          company_id?: string;
          expires_at?: string;
          consumed_at?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "oauth_state_nonces_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "oauth_state_nonces_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      question_answers: {
        Row: {
          id: string;
          company_id: string;
          snapshot_id: string | null;
          question_id: string;
          answer_state: string;
          confidence: number;
          supporting_evidence_ids: string[];
          missing_evidence: string[];
          reasoning: string;
          stage_level: string;
          effective_importance: number;
          last_updated: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          snapshot_id?: string | null;
          question_id: string;
          answer_state: string;
          confidence?: number;
          supporting_evidence_ids?: string[];
          missing_evidence?: string[];
          reasoning?: string;
          stage_level?: string;
          effective_importance?: number;
          last_updated?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string;
          snapshot_id?: string | null;
          question_id?: string;
          answer_state?: string;
          confidence?: number;
          supporting_evidence_ids?: string[];
          missing_evidence?: string[];
          reasoning?: string;
          stage_level?: string;
          effective_importance?: number;
          last_updated?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "question_answers_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "question_answers_snapshot_id_fkey";
            columns: ["snapshot_id"];
            isOneToOne: false;
            referencedRelation: "analysis_snapshots";
            referencedColumns: ["id"];
          },
        ];
      };
      company_business_concepts: {
        Row: {
          id: string;
          company_id: string;
          snapshot_id: string | null;
          concept_id: string;
          state: string;
          confidence: number;
          coverage: number;
          supporting_evidence_ids: string[];
          supporting_fact_keys: string[];
          supporting_fact_ids: string[];
          supporting_document_ids: string[];
          contradicting_evidence_ids: string[];
          contradicting_fact_keys: string[];
          reasoning: string;
          fact_values: Record<string, unknown>;
          last_updated: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          snapshot_id?: string | null;
          concept_id: string;
          state?: string;
          confidence?: number;
          coverage?: number;
          supporting_evidence_ids?: string[];
          supporting_fact_keys?: string[];
          supporting_fact_ids?: string[];
          supporting_document_ids?: string[];
          contradicting_evidence_ids?: string[];
          contradicting_fact_keys?: string[];
          reasoning?: string;
          fact_values?: Record<string, unknown>;
          last_updated?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string;
          snapshot_id?: string | null;
          concept_id?: string;
          state?: string;
          confidence?: number;
          coverage?: number;
          supporting_evidence_ids?: string[];
          supporting_fact_keys?: string[];
          supporting_fact_ids?: string[];
          supporting_document_ids?: string[];
          contradicting_evidence_ids?: string[];
          contradicting_fact_keys?: string[];
          reasoning?: string;
          fact_values?: Record<string, unknown>;
          last_updated?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "company_business_concepts_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "company_business_concepts_snapshot_id_fkey";
            columns: ["snapshot_id"];
            isOneToOne: false;
            referencedRelation: "analysis_snapshots";
            referencedColumns: ["id"];
          },
        ];
      };
      company_members: {
        Row: {
          id: string;
          company_id: string;
          user_id: string;
          role: UserRole;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          user_id: string;
          role?: UserRole;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string;
          user_id?: string;
          role?: UserRole;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "company_members_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "company_members_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      analysis_snapshots: {
        Row: {
          id: string;
          company_id: string;
          status: AnalysisSnapshotStatus;
          payload: Json;
          error_message: string | null;
          as_of: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          status?: AnalysisSnapshotStatus;
          payload?: Json;
          error_message?: string | null;
          as_of?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string;
          status?: AnalysisSnapshotStatus;
          payload?: Json;
          error_message?: string | null;
          as_of?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "analysis_snapshots_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
        ];
      };
      documents: {
        Row: {
          id: string;
          company_id: string;
          connector_id: string;
          /** Connector-native file id (e.g. Google Drive file id). */
          external_id: string;
          title: string;
          /** Original filename for manual uploads (falls back to title). */
          filename: string | null;
          /** Logical path / name within the source system. */
          path: string | null;
          modified_at: string | null;
          owner: string | null;
          mime_type: string | null;
          /** Content fingerprint (e.g. Drive md5Checksum / sha1Checksum). */
          content_hash: string | null;
          /** Byte size for manual uploads. */
          byte_size: number | null;
          /** Private Storage object key when uploaded manually. */
          storage_path: string | null;
          uploaded_by: string | null;
          /** UPLOADED | QUEUED | PROCESSING | EXTRACTED | ANALYZING | PROCESSED | FAILED | DELETING | STALE | OCR_REQUIRED */
          status: string;
          processing_started_at: string | null;
          processing_completed_at: string | null;
          error_message: string | null;
          processing_attempts: number;
          last_stage: string | null;
          locked_at: string | null;
          lease_expires_at: string | null;
          extraction_version: string | null;
          analysis_version: string | null;
          last_successful_extraction_version: string | null;
          last_successful_analysis_version: string | null;
          reprocess_error_message: string | null;
          next_reprocess_at: string | null;
          uri: string | null;
          raw_summary: string | null;
          metadata: Json;
          synced_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          connector_id: string;
          external_id: string;
          title: string;
          filename?: string | null;
          path?: string | null;
          modified_at?: string | null;
          owner?: string | null;
          mime_type?: string | null;
          content_hash?: string | null;
          byte_size?: number | null;
          storage_path?: string | null;
          uploaded_by?: string | null;
          status?: string;
          processing_started_at?: string | null;
          processing_completed_at?: string | null;
          error_message?: string | null;
          processing_attempts?: number;
          last_stage?: string | null;
          locked_at?: string | null;
          lease_expires_at?: string | null;
          extraction_version?: string | null;
          analysis_version?: string | null;
          last_successful_extraction_version?: string | null;
          last_successful_analysis_version?: string | null;
          reprocess_error_message?: string | null;
          next_reprocess_at?: string | null;
          uri?: string | null;
          raw_summary?: string | null;
          metadata?: Json;
          synced_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string;
          connector_id?: string;
          external_id?: string;
          title?: string;
          filename?: string | null;
          path?: string | null;
          modified_at?: string | null;
          owner?: string | null;
          mime_type?: string | null;
          content_hash?: string | null;
          byte_size?: number | null;
          storage_path?: string | null;
          uploaded_by?: string | null;
          status?: string;
          processing_started_at?: string | null;
          processing_completed_at?: string | null;
          error_message?: string | null;
          processing_attempts?: number;
          last_stage?: string | null;
          locked_at?: string | null;
          lease_expires_at?: string | null;
          extraction_version?: string | null;
          analysis_version?: string | null;
          last_successful_extraction_version?: string | null;
          last_successful_analysis_version?: string | null;
          reprocess_error_message?: string | null;
          next_reprocess_at?: string | null;
          uri?: string | null;
          raw_summary?: string | null;
          metadata?: Json;
          synced_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "documents_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
        ];
      };
      evidence: {
        Row: {
          id: string;
          company_id: string;
          document_id: string | null;
          source_system: string;
          source_type: string;
          title: string;
          content_summary: string;
          extracted_facts: Json;
          dimension_ids: string[];
          dimension_id: string;
          dimension: string;
          occurred_at: string;
          collected_at: string;
          reliability: number;
          metadata: Json;
          citation: Json;
          finding_ids: string[];
          linked_risk_ids: string[];
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          document_id?: string | null;
          source_system: string;
          source_type: string;
          title: string;
          content_summary?: string;
          extracted_facts?: Json;
          dimension_ids?: string[];
          dimension_id: string;
          dimension: string;
          occurred_at: string;
          collected_at: string;
          reliability: number;
          metadata?: Json;
          citation?: Json;
          finding_ids?: string[];
          linked_risk_ids?: string[];
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string;
          document_id?: string | null;
          source_system?: string;
          source_type?: string;
          title?: string;
          content_summary?: string;
          extracted_facts?: Json;
          dimension_ids?: string[];
          dimension_id?: string;
          dimension?: string;
          occurred_at?: string;
          collected_at?: string;
          reliability?: number;
          metadata?: Json;
          citation?: Json;
          finding_ids?: string[];
          linked_risk_ids?: string[];
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "evidence_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "evidence_document_id_fkey";
            columns: ["document_id"];
            isOneToOne: false;
            referencedRelation: "documents";
            referencedColumns: ["id"];
          },
        ];
      };
      findings: {
        Row: {
          id: string;
          company_id: string;
          title: string;
          description: string;
          summary: string;
          dimension_id: string;
          dimension: string;
          insight_ids: string[];
          evidence_ids: string[];
          direction: "positive" | "negative" | "neutral";
          materiality: number;
          confidence: number;
          score_impact: number;
          source_system: string;
          extracted_at: string;
          stable_key: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          title: string;
          description: string;
          summary?: string;
          dimension_id: string;
          dimension: string;
          insight_ids?: string[];
          evidence_ids?: string[];
          direction: "positive" | "negative" | "neutral";
          materiality?: number;
          confidence?: number;
          score_impact?: number;
          source_system?: string;
          extracted_at?: string;
          stable_key?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string;
          title?: string;
          description?: string;
          summary?: string;
          dimension_id?: string;
          dimension?: string;
          insight_ids?: string[];
          evidence_ids?: string[];
          direction?: "positive" | "negative" | "neutral";
          materiality?: number;
          confidence?: number;
          score_impact?: number;
          source_system?: string;
          extracted_at?: string;
          stable_key?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "findings_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
        ];
      };
      risks: {
        Row: {
          id: string;
          company_id: string;
          title: string;
          summary: string;
          dimension_id: string;
          dimension: string;
          severity: "high" | "medium" | "low";
          likelihood: number;
          impact: number;
          finding_ids: string[];
          evidence_ids: string[];
          confidence: number;
          status: "open" | "monitoring" | "resolved" | "accepted";
          estimated_score_impact: number;
          why_it_matters: string;
          recommendation_id: string | null;
          recommendation: string;
          primary_evidence_label: string;
          explain_prompt: string;
          stable_key: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          title: string;
          summary: string;
          dimension_id: string;
          dimension: string;
          severity: "high" | "medium" | "low";
          likelihood?: number;
          impact?: number;
          finding_ids?: string[];
          evidence_ids?: string[];
          confidence?: number;
          status?: "open" | "monitoring" | "resolved" | "accepted";
          estimated_score_impact?: number;
          why_it_matters?: string;
          recommendation_id?: string | null;
          recommendation?: string;
          primary_evidence_label?: string;
          explain_prompt?: string;
          stable_key?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string;
          title?: string;
          summary?: string;
          dimension_id?: string;
          dimension?: string;
          severity?: "high" | "medium" | "low";
          likelihood?: number;
          impact?: number;
          finding_ids?: string[];
          evidence_ids?: string[];
          confidence?: number;
          status?: "open" | "monitoring" | "resolved" | "accepted";
          estimated_score_impact?: number;
          why_it_matters?: string;
          recommendation_id?: string | null;
          recommendation?: string;
          primary_evidence_label?: string;
          explain_prompt?: string;
          stable_key?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "risks_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
        ];
      };
      recommendations: {
        Row: {
          id: string;
          company_id: string;
          title: string;
          description: string;
          dimension_id: string;
          dimension: string;
          risk_ids: string[];
          evidence_ids: string[];
          finding_ids: string[];
          priority: "high" | "medium" | "low";
          effort: "low" | "medium" | "high";
          confidence: number;
          estimated_score_improvement: number;
          rationale: string;
          next_steps: string[];
          priority_score: number;
          stable_key: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          title: string;
          description: string;
          dimension_id: string;
          dimension: string;
          risk_ids?: string[];
          evidence_ids?: string[];
          finding_ids?: string[];
          priority: "high" | "medium" | "low";
          effort: "low" | "medium" | "high";
          confidence?: number;
          estimated_score_improvement?: number;
          rationale?: string;
          next_steps?: string[];
          priority_score?: number;
          stable_key?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string;
          title?: string;
          description?: string;
          dimension_id?: string;
          dimension?: string;
          risk_ids?: string[];
          evidence_ids?: string[];
          finding_ids?: string[];
          priority?: "high" | "medium" | "low";
          effort?: "low" | "medium" | "high";
          confidence?: number;
          estimated_score_improvement?: number;
          rationale?: string;
          next_steps?: string[];
          priority_score?: number;
          stable_key?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "recommendations_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
        ];
      };
      health_scores: {
        Row: {
          id: string;
          company_id: string;
          score: number;
          status: "healthy" | "watch" | "at-risk" | "insufficient" | "not_applicable";
          change: number;
          change_label: string;
          confidence: number;
          dimensions: Json;
          score_explanations: Json;
          score_change: Json | null;
          as_of: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          score: number;
          status: "healthy" | "watch" | "at-risk" | "insufficient" | "not_applicable";
          change?: number;
          change_label?: string;
          confidence?: number;
          dimensions?: Json;
          score_explanations?: Json;
          score_change?: Json | null;
          as_of?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string;
          score?: number;
          status?: "healthy" | "watch" | "at-risk" | "insufficient" | "not_applicable";
          change?: number;
          change_label?: string;
          confidence?: number;
          dimensions?: Json;
          score_explanations?: Json;
          score_change?: Json | null;
          as_of?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "health_scores_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
        ];
      };
      timeline_events: {
        Row: {
          id: string;
          company_id: string;
          event_date: string;
          month: string;
          type: string;
          title: string;
          description: string;
          summary: string | null;
          occurred_at: string | null;
          score_before: number | null;
          score_after: number | null;
          dimension_id: string | null;
          dimension: string | null;
          why_health_changed: string | null;
          source_document_id: string | null;
          evidence_ids: string[];
          finding_ids: string[];
          risk_ids: string[];
          previous_value: number | null;
          current_value: number | null;
          score_delta: number | null;
          parent_event_id: string | null;
          root_event_id: string | null;
          causal_chain_id: string | null;
          confidence: number;
          metadata: Json;
          event_key: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          event_date: string;
          month: string;
          type: string;
          title: string;
          description?: string;
          summary?: string | null;
          occurred_at?: string | null;
          score_before?: number | null;
          score_after?: number | null;
          dimension_id?: string | null;
          dimension?: string | null;
          why_health_changed?: string | null;
          source_document_id?: string | null;
          evidence_ids?: string[];
          finding_ids?: string[];
          risk_ids?: string[];
          previous_value?: number | null;
          current_value?: number | null;
          score_delta?: number | null;
          parent_event_id?: string | null;
          root_event_id?: string | null;
          causal_chain_id?: string | null;
          confidence?: number;
          metadata?: Json;
          event_key?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string;
          event_date?: string;
          month?: string;
          type?: string;
          title?: string;
          description?: string;
          summary?: string | null;
          occurred_at?: string | null;
          score_before?: number | null;
          score_after?: number | null;
          dimension_id?: string | null;
          dimension?: string | null;
          why_health_changed?: string | null;
          source_document_id?: string | null;
          evidence_ids?: string[];
          finding_ids?: string[];
          risk_ids?: string[];
          previous_value?: number | null;
          current_value?: number | null;
          score_delta?: number | null;
          parent_event_id?: string | null;
          root_event_id?: string | null;
          causal_chain_id?: string | null;
          confidence?: number;
          metadata?: Json;
          event_key?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "timeline_events_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
        ];
      };
      connector_syncs: {
        Row: {
          id: string;
          company_id: string;
          connector_id: string;
          status: ConnectorSyncStatus;
          documents_analyzed: number;
          evidence_created: number;
          error_message: string | null;
          started_at: string;
          finished_at: string | null;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          connector_id: string;
          status?: ConnectorSyncStatus;
          documents_analyzed?: number;
          evidence_created?: number;
          error_message?: string | null;
          started_at?: string;
          finished_at?: string | null;
          metadata?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string;
          connector_id?: string;
          status?: ConnectorSyncStatus;
          documents_analyzed?: number;
          evidence_created?: number;
          error_message?: string | null;
          started_at?: string;
          finished_at?: string | null;
          metadata?: Json;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "connector_syncs_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
        ];
      };
      connector_credentials: {
        Row: {
          id: string;
          company_id: string;
          connector_id: string;
          status: ConnectorCredentialStatus;
          encrypted_refresh_token: string | null;
          access_token_expires_at: string | null;
          scopes: string[];
          account_email: string | null;
          connected_by_user_id: string | null;
          last_synced_at: string | null;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          connector_id: string;
          status?: ConnectorCredentialStatus;
          encrypted_refresh_token?: string | null;
          access_token_expires_at?: string | null;
          scopes?: string[];
          account_email?: string | null;
          connected_by_user_id?: string | null;
          last_synced_at?: string | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string;
          connector_id?: string;
          status?: ConnectorCredentialStatus;
          encrypted_refresh_token?: string | null;
          access_token_expires_at?: string | null;
          scopes?: string[];
          account_email?: string | null;
          connected_by_user_id?: string | null;
          last_synced_at?: string | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "connector_credentials_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "connector_credentials_connected_by_user_id_fkey";
            columns: ["connected_by_user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: {
      current_user_company_id: {
        Args: Record<string, never>;
        Returns: string;
      };
      current_user_company_ids: {
        Args: Record<string, never>;
        Returns: string[];
      };
      is_company_member: {
        Args: { target_company_id: string };
        Returns: boolean;
      };
      claim_document_for_processing: {
        Args: {
          p_document_id: string;
          p_company_id: string;
          p_lease_seconds?: number;
        };
        Returns: Database["public"]["Tables"]["documents"]["Row"] | null;
      };
      company_analysis_lock_key: {
        Args: { p_company_id: string };
        Returns: number;
      };
      try_lock_company_analysis: {
        Args: { p_company_id: string };
        Returns: boolean;
      };
      unlock_company_analysis: {
        Args: { p_company_id: string };
        Returns: boolean;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];

export type TablesInsert<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"];

export type TablesUpdate<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"];
