/**
 * Goal provider registry / factory.
 * Register providers at module load; resolve by id without switch statements.
 */

import type { AssessmentGoalId } from "@/lib/domain/assessment-goal";
import { DEFAULT_ASSESSMENT_GOAL } from "@/lib/domain/assessment-goal";
import type { AssessmentGoalProvider } from "./provider";
import { toGoalMeta } from "./provider";

const registry = new Map<AssessmentGoalId, AssessmentGoalProvider>();

export function registerGoalProvider(provider: AssessmentGoalProvider): void {
  registry.set(provider.id, provider);
}

export function getGoalProvider(
  goalId: AssessmentGoalId | null | undefined,
): AssessmentGoalProvider {
  const id = goalId ?? DEFAULT_ASSESSMENT_GOAL;
  const provider = registry.get(id) ?? registry.get(DEFAULT_ASSESSMENT_GOAL);
  if (!provider) {
    throw new Error(
      `Assessment goal provider not registered for "${id}" (and no default).`,
    );
  }
  return provider;
}

export function listGoalProviders(): AssessmentGoalProvider[] {
  return Array.from(registry.values());
}

export function listGoalMetas() {
  return listGoalProviders().map(toGoalMeta);
}

export function hasGoalProvider(goalId: AssessmentGoalId): boolean {
  return registry.has(goalId);
}

/** Test helper — clear registry between suites if needed. */
export function __resetGoalProviderRegistryForTests(): void {
  registry.clear();
}
