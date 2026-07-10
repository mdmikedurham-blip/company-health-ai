/**
 * Generated-style Database types for the Company Health schema.
 * Keep in sync with supabase/migrations/001_company_health_schema.sql
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
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      users: {
        Row: {
          id: string;
          company_id: string | null;
          email: string;
          full_name: string | null;
          role: UserRole;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          company_id?: string | null;
          email: string;
          full_name?: string | null;
          role?: UserRole;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string | null;
          email?: string;
          full_name?: string | null;
          role?: UserRole;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "users_company_id_fkey";
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
          /** Logical path / name within the source system. */
          path: string | null;
          modified_at: string | null;
          owner: string | null;
          mime_type: string | null;
          /** Content fingerprint (e.g. Drive md5Checksum / sha1Checksum). */
          content_hash: string | null;
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
          path?: string | null;
          modified_at?: string | null;
          owner?: string | null;
          mime_type?: string | null;
          content_hash?: string | null;
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
          path?: string | null;
          modified_at?: string | null;
          owner?: string | null;
          mime_type?: string | null;
          content_hash?: string | null;
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
          status: "healthy" | "watch" | "at-risk";
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
          status: "healthy" | "watch" | "at-risk";
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
          status?: "healthy" | "watch" | "at-risk";
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
            referencedRelation: "users";
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
