/**
 * Company Doctor — evidence-backed Q&A over the Insight Engine snapshot.
 *
 * Pipeline: question → classify → retrieve → context → LLM → structured answer
 */
export type {
  ClassifiedQuery,
  DoctorActionRef,
  DoctorAnswer,
  DoctorAskRequest,
  DoctorAskResponse,
  DoctorContext,
  DoctorEvidenceCitation,
  DoctorFindingRef,
  DoctorQueryIntent,
  DoctorRiskRef,
  RankedItem,
  RetrievalResult,
} from "./types";

export { classifyQuery } from "./query-classifier";
export { retrieveRelevantContext, RELEVANCE_FLOOR } from "./retriever";
export {
  buildDoctorContext,
  evidenceHref,
  toEvidenceCitation,
} from "./context-builder";
export {
  askDoctor,
  doctorSuggestedPrompts,
  enforceCitationIntegrity,
  getDefaultLLMProvider,
  getDoctorExplainPrompt,
  getDoctorSuggestedPrompts,
  setDefaultLLMProvider,
} from "./doctor-service";
