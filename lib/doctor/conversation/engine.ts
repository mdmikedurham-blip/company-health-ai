/**
 * Company Doctor Conversation Engine — primary product experience orchestrator.
 */

import { randomUUID } from "node:crypto";
import type { AppSupabaseClient } from "@/lib/supabase/client";
import type { CompanyHealthSnapshot } from "@/lib/domain";
import type { AssessmentGoalId } from "@/lib/domain/assessment-goal";
import { DEFAULT_ASSESSMENT_GOAL } from "@/lib/domain/assessment-goal";
import type {
  DoctorConversation,
  DoctorHomeView,
  DoctorInvestigation,
} from "@/lib/domain/doctor-conversation";
import { getCompanyAssessmentGoal } from "@/lib/assessment-goals";
import { getCompanyClassification } from "@/lib/classification/persist";
import { getCurrentAssessmentSnapshot } from "@/lib/assessment-snapshots";
import { loadTenantDoctorSnapshot } from "../load-tenant-snapshot";
import {
  getActiveDoctorConversation,
  listDoctorInvestigations,
  upsertActiveDoctorConversation,
  upsertDoctorInvestigation,
} from "./persist";
import {
  advanceInvestigation,
  buildDoctorHomeView,
  buildTopObservation,
  selectNextInvestigationTemplate,
} from "./workflow";

function emptyConversation(input: {
  companyId: string;
  snapshotId: string | null;
  assessmentGoal: AssessmentGoalId;
  companyStage: string | null;
  createdBy?: string | null;
}): DoctorConversation {
  const now = new Date().toISOString();
  return {
    id: randomUUID(),
    companyId: input.companyId,
    snapshotId: input.snapshotId,
    assessmentGoal: input.assessmentGoal,
    companyStage: input.companyStage,
    status: "active",
    currentTopic: null,
    currentInvestigationId: null,
    currentHypothesis: null,
    confidence: 0,
    unansweredQuestions: [],
    requestedEvidence: [],
    completedInvestigationIds: [],
    conversationHistory: [],
    recentlyLearned: [],
    topObservation: null,
    nextAction: null,
    createdBy: input.createdBy ?? null,
    createdAt: now,
    updatedAt: now,
  };
}

function openInvestigation(input: {
  conversationId: string;
  companyId: string;
  snapshotId: string | null;
  template: NonNullable<ReturnType<typeof selectNextInvestigationTemplate>>;
  priority: number;
}): DoctorInvestigation {
  const now = new Date().toISOString();
  return {
    id: randomUUID(),
    conversationId: input.conversationId,
    companyId: input.companyId,
    templateId: input.template.id,
    title: input.template.title,
    businessQuestion: input.template.businessQuestion,
    hypotheses: input.template.hypotheses,
    requiredEvidence: input.template.requiredEvidence,
    confidence: 15,
    blockingUnknowns: [],
    status: "open",
    priority: input.priority,
    currentQuestion: input.template.highValueQuestion,
    evidenceRequest: null,
    recommendation: { ...input.template.recommendationTemplate },
    explainability: {
      findingIds: [],
      questionIds: [],
      evidenceIds: [],
      documentIds: [],
    },
    snapshotId: input.snapshotId,
    openedAt: now,
    completedAt: null,
    updatedAt: now,
  };
}

/**
 * Load or create the active conversation and advance one mentor cycle.
 * Never responds with only "upload more documents".
 */
export async function loadDoctorHome(input: {
  client: AppSupabaseClient;
  companyId: string;
  userId?: string | null;
  /** When true, mark current recommended investigation completed and open next. */
  completeCurrent?: boolean;
  userMessage?: string | null;
}): Promise<DoctorHomeView> {
  const snapshot = await loadTenantDoctorSnapshot({
    client: input.client,
    companyId: input.companyId,
  });

  const [goalRow, classification, currentSnap] = await Promise.all([
    getCompanyAssessmentGoal({
      client: input.client,
      companyId: input.companyId,
    }).catch(() => null),
    getCompanyClassification(input.client, input.companyId).catch(() => null),
    getCurrentAssessmentSnapshot({
      client: input.client,
      companyId: input.companyId,
    }).catch(() => null),
  ]);

  const goal = (goalRow?.goal ?? DEFAULT_ASSESSMENT_GOAL) as AssessmentGoalId;
  const stage =
    classification?.stage ??
    (currentSnap?.companyStage as string | null) ??
    null;
  const snapshotId = currentSnap?.snapshotId ?? null;

  let conversation =
    (await getActiveDoctorConversation({
      client: input.client,
      companyId: input.companyId,
    }).catch(() => null)) ??
    emptyConversation({
      companyId: input.companyId,
      snapshotId,
      assessmentGoal: goal,
      companyStage: stage,
      createdBy: input.userId ?? null,
    });

  // Refresh pinned context when goal/stage/snapshot change — do not re-extract.
  conversation = {
    ...conversation,
    snapshotId: snapshotId ?? conversation.snapshotId,
    assessmentGoal: goal,
    companyStage: stage,
  };

  let investigations = conversation.id
    ? await listDoctorInvestigations({
        client: input.client,
        companyId: input.companyId,
        conversationId: conversation.id,
      }).catch(() => [])
    : [];

  // In-memory path when migration 020 is not applied yet.
  const persistEnabled = await canPersist(input.client);

  if (input.completeCurrent && conversation.currentInvestigationId) {
    const current = investigations.find(
      (i) => i.id === conversation.currentInvestigationId,
    );
    if (current) {
      const completed: DoctorInvestigation = {
        ...current,
        status: "completed",
        completedAt: new Date().toISOString(),
      };
      investigations = investigations.map((i) =>
        i.id === completed.id ? completed : i,
      );
      conversation.completedInvestigationIds = [
        ...new Set([
          ...conversation.completedInvestigationIds,
          completed.templateId,
        ]),
      ];
      conversation.currentInvestigationId = null;
      conversation.currentTopic = null;
      conversation.currentHypothesis = null;
      conversation.requestedEvidence = [];
      conversation.nextAction = null;
    }
  }

  if (input.userMessage?.trim()) {
    conversation.conversationHistory = [
      ...conversation.conversationHistory,
      {
        id: randomUUID(),
        role: "user" as const,
        content: input.userMessage.trim(),
        createdAt: new Date().toISOString(),
        investigationId: conversation.currentInvestigationId,
      },
    ].slice(-40);
  }

  let current =
    investigations.find((i) => i.id === conversation.currentInvestigationId) ??
    investigations.find(
      (i) =>
        i.status === "open" ||
        i.status === "asking" ||
        i.status === "awaiting_evidence" ||
        i.status === "recommended",
    ) ??
    null;

  if (!current) {
    const template = selectNextInvestigationTemplate({
      goal,
      stage,
      snapshot,
      completedTemplateIds: conversation.completedInvestigationIds,
    });
    if (template) {
      current = openInvestigation({
        conversationId: conversation.id,
        companyId: input.companyId,
        snapshotId,
        template,
        priority: template.basePriority,
      });
      investigations = [...investigations, current];
    }
  }

  const observation = buildTopObservation(snapshot, goal);
  conversation.topObservation = observation;

  let mentorMessage = observation;
  let phase: DoctorHomeView["workflowPhase"] = "observe";
  let requestedEvidence = conversation.requestedEvidence;
  let nextAction = conversation.nextAction;

  if (current) {
    const advanced = advanceInvestigation({
      investigation: current,
      snapshot,
    });
    current = advanced.investigation;
    investigations = investigations.map((i) =>
      i.id === current!.id ? current! : i,
    );
    conversation.recentlyLearned = [
      ...advanced.learned,
      ...conversation.recentlyLearned,
    ].slice(0, 12);
    conversation.currentInvestigationId = current.id;
    conversation.currentTopic = current.title;
    conversation.currentHypothesis = current.hypotheses[0] ?? null;
    conversation.confidence = Math.max(
      conversation.confidence,
      current.confidence,
      snapshot.healthScore.confidence || 0,
    );
    conversation.unansweredQuestions = current.currentQuestion
      ? [current.currentQuestion]
      : [];
    conversation.requestedEvidence = advanced.requestedEvidence;
    conversation.nextAction = advanced.nextAction;
    mentorMessage = `${observation}\n\n${advanced.mentorMessage}`;
    phase = advanced.phase;
    requestedEvidence = advanced.requestedEvidence;
    nextAction = advanced.nextAction;
  } else {
    mentorMessage = [
      observation,
      "There is no open investigation right now.",
      "Share the one decision you need to make this week, and I will start there.",
    ].join(" ");
    phase = "diagnose";
  }

  conversation.conversationHistory = [
    ...conversation.conversationHistory,
    {
      id: randomUUID(),
      role: "assistant" as const,
      content: mentorMessage,
      createdAt: new Date().toISOString(),
      investigationId: current?.id ?? null,
    },
  ].slice(-40);
  conversation.updatedAt = new Date().toISOString();

  if (persistEnabled) {
    conversation = await upsertActiveDoctorConversation({
      client: input.client,
      conversation,
    });
    if (current) {
      current = await upsertDoctorInvestigation({
        client: input.client,
        investigation: { ...current, conversationId: conversation.id },
      });
    }
  }

  const completed = investigations.filter((i) => i.status === "completed");

  return buildDoctorHomeView({
    conversation,
    currentInvestigation: current,
    completedInvestigations: completed,
    snapshot,
    mentorMessage,
    phase,
    requestedEvidence,
    nextAction,
  });
}

async function canPersist(client: AppSupabaseClient): Promise<boolean> {
  const { error } = await client
    .from("doctor_conversations")
    .select("id")
    .limit(1);
  if (!error) return true;
  return !/does not exist|PGRST|schema cache/i.test(error.message);
}

/** Pure helper for tests — advance without DB. */
export function runDoctorCycleInMemory(input: {
  snapshot: CompanyHealthSnapshot;
  goal?: AssessmentGoalId;
  stage?: string | null;
  completedTemplateIds?: string[];
  existing?: DoctorInvestigation | null;
}): DoctorHomeView {
  const goal = input.goal ?? DEFAULT_ASSESSMENT_GOAL;
  const conversation = emptyConversation({
    companyId: input.snapshot.company.id,
    snapshotId: null,
    assessmentGoal: goal,
    companyStage: input.stage ?? null,
  });
  conversation.topObservation = buildTopObservation(input.snapshot, goal);
  conversation.completedInvestigationIds = input.completedTemplateIds ?? [];

  let current = input.existing ?? null;
  if (!current) {
    const template = selectNextInvestigationTemplate({
      goal,
      stage: input.stage ?? null,
      snapshot: input.snapshot,
      completedTemplateIds: conversation.completedInvestigationIds,
    });
    if (template) {
      current = openInvestigation({
        conversationId: conversation.id,
        companyId: conversation.companyId,
        snapshotId: null,
        template,
        priority: template.basePriority,
      });
    }
  }

  if (!current) {
    return buildDoctorHomeView({
      conversation,
      currentInvestigation: null,
      completedInvestigations: [],
      snapshot: input.snapshot,
      mentorMessage: conversation.topObservation!,
      phase: "observe",
      requestedEvidence: [],
      nextAction: null,
    });
  }

  const advanced = advanceInvestigation({
    investigation: current,
    snapshot: input.snapshot,
  });
  conversation.currentInvestigationId = advanced.investigation.id;
  conversation.currentTopic = advanced.investigation.title;
  conversation.currentHypothesis =
    advanced.investigation.hypotheses[0] ?? null;
  conversation.confidence = advanced.investigation.confidence;
  conversation.requestedEvidence = advanced.requestedEvidence;
  conversation.nextAction = advanced.nextAction;
  conversation.recentlyLearned = advanced.learned;

  return buildDoctorHomeView({
    conversation,
    currentInvestigation: advanced.investigation,
    completedInvestigations: [],
    snapshot: input.snapshot,
    mentorMessage: `${conversation.topObservation}\n\n${advanced.mentorMessage}`,
    phase: advanced.phase,
    requestedEvidence: advanced.requestedEvidence,
    nextAction: advanced.nextAction,
  });
}
