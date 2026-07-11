/**
 * Register all playbook providers once (side-effect import).
 */

import { registerPlaybookProvider } from "./registry";
import { acquireACompanyPlaybook } from "./providers/acquire-a-company";
import { annualAuditPlaybook } from "./providers/annual-audit";
import { boardReadinessPlaybook } from "./providers/board-readiness";
import { enterpriseSalesPlaybook } from "./providers/enterprise-sales";
import { ipoReadinessPlaybook } from "./providers/ipo-readiness";
import { raiseCapitalPlaybook } from "./providers/raise-capital";
import { runTheCompanyPlaybook } from "./providers/run-the-company";
import { sellTheCompanyPlaybook } from "./providers/sell-the-company";

let registered = false;

export function ensurePlaybookProvidersRegistered(): void {
  if (registered) return;
  registerPlaybookProvider(runTheCompanyPlaybook);
  registerPlaybookProvider(raiseCapitalPlaybook);
  registerPlaybookProvider(sellTheCompanyPlaybook);
  registerPlaybookProvider(acquireACompanyPlaybook);
  registerPlaybookProvider(enterpriseSalesPlaybook);
  registerPlaybookProvider(boardReadinessPlaybook);
  registerPlaybookProvider(annualAuditPlaybook);
  registerPlaybookProvider(ipoReadinessPlaybook);
  registered = true;
}

ensurePlaybookProvidersRegistered();
