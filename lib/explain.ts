import type { ExplainPayload } from "./types";
import {
  buildDimensionExplainPayload,
  buildRiskExplainPayload,
  getDimensionIdByName,
} from "./domain/explain";
import { companySnapshot } from "./data";

export function buildRiskExplainPayloadForApp(riskId: string): ExplainPayload | null {
  return buildRiskExplainPayload(companySnapshot, riskId);
}

export function buildDimensionExplainPayloadForApp(
  dimensionId: string,
): ExplainPayload | null {
  return buildDimensionExplainPayload(companySnapshot, dimensionId);
}

export {
  buildRiskExplainPayloadForApp as buildRiskExplainPayload,
  buildDimensionExplainPayloadForApp as buildDimensionExplainPayload,
};

export function getDimensionIdByNameForApp(name: string): string | undefined {
  return getDimensionIdByName(companySnapshot, name);
}

export { getDimensionIdByNameForApp as getDimensionIdByName };

export function getAllDimensionIds(): string[] {
  return companySnapshot.dimensions.map((d) => d.id);
}

export function getAllRiskIds(): string[] {
  return companySnapshot.risks.map((r) => r.id);
}
