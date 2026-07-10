import type { DoctorAnswer, DoctorContext } from "@/lib/doctor/types";

/**
 * Pluggable LLM backend for Company Doctor.
 * Swap MockLLMProvider for OpenAI (or another) without changing doctor-service.
 */
export interface LLMProvider {
  readonly name: string;
  generateDoctorAnswer(context: DoctorContext): Promise<DoctorAnswer>;
}

export type { DoctorAnswer, DoctorContext };
