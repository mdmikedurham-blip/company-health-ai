/**
 * Register all assessment goal providers once (side-effect import).
 */

import { registerGoalProvider } from "./registry";
import { runTheCompanyProvider } from "./providers/run-the-company";
import {
  acquireACompanyProvider,
  annualAuditProvider,
  boardReadinessProvider,
  enterpriseSalesProvider,
  ipoReadinessProvider,
  raiseCapitalProvider,
  sellTheCompanyProvider,
} from "./providers/stubs";

let registered = false;

export function ensureGoalProvidersRegistered(): void {
  if (registered) return;
  registerGoalProvider(runTheCompanyProvider);
  registerGoalProvider(raiseCapitalProvider);
  registerGoalProvider(sellTheCompanyProvider);
  registerGoalProvider(acquireACompanyProvider);
  registerGoalProvider(boardReadinessProvider);
  registerGoalProvider(enterpriseSalesProvider);
  registerGoalProvider(annualAuditProvider);
  registerGoalProvider(ipoReadinessProvider);
  registered = true;
}

ensureGoalProvidersRegistered();
