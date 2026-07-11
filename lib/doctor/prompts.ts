/**
 * Client-safe Doctor prompts — no lib/data or server imports.
 */

export const doctorSuggestedPrompts = [
  "What are the biggest risks?",
  "Why is governance scoring low?",
  "What should I fix before fundraising?",
  "Generate a board update.",
  "Show evidence for customer concentration.",
] as const;

export function getDoctorExplainPromptFallback(): string {
  return "Explain this risk, its evidence, and what to do next.";
}
