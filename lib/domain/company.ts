import type { CompanyId } from "./primitives";

export interface Company {
  id: CompanyId;
  name: string;
  plan: string;
  founded: string;
  stage: string;
  employees: number;
  arr: string;
}
