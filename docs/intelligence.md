# Company Health Insight Engine

## Overview

The Insight Engine turns normalized **Evidence** into actionable company health intelligence:

```
Connector adapters
       ↓  connect()
       ↓  sync() → RawConnectorData
       ↓  normalize(raw) → Evidence[]
   Evidence[]
       ↓
  lib/application (company-analysis-service)
       ↓  runInsightEngine()
 Insights → Findings → Risks → HealthScore → Recommendations
       ↓
 CompanyHealthSnapshot
       ↓
 UI (via lib/data)
```

There is **exactly one ingestion path**. Every external system (Google Drive, HubSpot, Carta, Box, QuickBooks, Slack, BambooHR, Salesforce, Jira, …) implements the same `ConnectorAdapter` interface and outputs the same `Evidence` shape. No connector may bypass the engine or write scores/risks directly into the UI.

## Layering rules

| Layer | Responsibility | May import |
|-------|----------------|------------|
| `lib/connectors` | Sync + normalize → `Evidence`; document persistence | `lib/domain`, `lib/supabase` (persistence only) |
| `lib/intelligence` | Insight Engine / rules only | `lib/domain` only |
| `lib/application` | Orchestrate connector ingest → engine → snapshot (+ optional persist) | connectors + intelligence + domain + supabase |
| `lib/data` | Read API for pages (cached snapshots) | application + connectors + domain + company profile |
| `app/` / `components/` | Presentation | `lib/data` (and UI helpers) |

**Forbidden:** connectors → intelligence, intelligence → data/application, UI → connectors/engine internals.

## Evidence lifecycle

1. **Connect** — `ConnectorAdapter.connect()` establishes auth / marks the system connected.
2. **Sync** — `ConnectorAdapter.sync()` returns `RawConnectorData` from an external API (or mock seed).
3. **Normalize** — `ConnectorAdapter.normalize(raw)` produces `Evidence[]` with:
   - identity (`id`, `sourceSystem`, `sourceType`, `title`)
   - narrative (`contentSummary`)
   - structured `extractedFacts` (what rules read)
   - `dimensionIds`, timestamps, `reliability`, `citation`
4. **Ingest** — `runConnectorPipeline()` merges all adapters into one `Evidence[]` + `EvidenceCatalog`.
5. **Analyze** — `lib/application` calls `runInsightEngine({ evidence })` (connectors never do this).
6. **Link** — Engine writes reverse links (`findingIds`, `linkedRiskIds`) onto evidence.
7. **Present** — `lib/data` exports snapshot slices; pages never recompute scores.

`health()` reports connection readiness; `disconnect()` tears the link down (status → pending).

Missing evidence **reduces confidence**. The engine never invents conclusions to fill gaps.

### `extractedFacts` keys (current policy)

| Fact key | Rule family |
|----------|-------------|
| `top3CustomerArrShare` | Customer concentration |
| `agreementsMissingIpAssignment`, `totalContractorAgreements` | IP assignment gaps |
| `optionGrantsMissingBoardApproval`, `materialActionsMissingBoardApproval` | Board approvals |
| `cashRunwayMonths` | Cash runway |
| `recurringRevenueShare`, `netRevenueRetention` | Revenue quality |
| `openCriticalControls`, `mfaCoverage` | Security readiness |
| `voluntaryAttritionRate`, `singleOwnerCriticalFunctions` | People health |

An LLM can later populate the same keys from free text without changing the domain model or UI.

## Connector adapter interface

Canonical contract:

```ts
interface ConnectorAdapter {
  connect(): Promise<void>;
  sync(): Promise<RawConnectorData>;
  normalize(raw: RawConnectorData): Promise<Evidence[]>;
  health(): Promise<ConnectorHealth>;
  disconnect(): Promise<void>;
}
```

Display metadata (`connectorId`, `name`, `system`, `status`) is also on the adapter for the evidence catalog.

Flow:

1. `connect()` authenticates / enables the connector.
2. `sync()` pulls opaque `RawConnectorData` from the external system (or mock seed).
3. `normalize(raw)` turns that payload into `Evidence[]`.
4. `runConnectorPipeline()` merges all adapters and builds the catalog.
5. `runInsightEngine({ evidence })` derives intelligence.
6. `health()` / `disconnect()` manage readiness and teardown.

Mock adapters also implement `syncSync` / `normalizeSync` / `healthSync` so the static app snapshot can assemble at module init. Production OAuth adapters use the async path only (`buildCompanyHealthSnapshot` in `@/lib/application`).

### Adding a connector (checklist)

1. Create `lib/connectors/<system>/adapter.ts` implementing `ConnectorAdapter` (use `createMockConnector` + `createEvidence` for prototypes). Add `auth.ts` / `crawler.ts` when the system needs them (see `google-drive/`).
2. Export the connector from `lib/connectors/<system>/index.ts`.
3. Register in `lib/connectors/registry.ts`.
4. Ensure `normalize()` fills the `extractedFacts` keys your rules need.
5. No UI, domain, or intelligence changes required unless you add a **new rule**.

Pending connectors (`status: "pending"`) are listed in the catalog but contribute **zero** evidence (`normalize` returns `[]`).

## Engine stages

| Stage | Module | Input → Output |
|-------|--------|----------------|
| 1 | `evidence-analyzer.ts` | Evidence → Insights (`ruleId` + statement) |
| 2 | `finding-engine.ts` | Insights → Findings (via `FINDING_POLICY`) |
| 3 | `risk-engine.ts` | Negative findings → Risks |
| 4 | `scoring-engine.ts` | Findings → dimension + overall HealthScore |
| 5 | `recommendation-engine.ts` | Risks → ranked Recommendations |
| 6 | `insight-engine.ts` | Orchestration + evidence linking + timeline |

Insights carry a stable **`ruleId`**. Findings never parse statement text for severity.

## Scoring methodology

All numbers live in `lib/intelligence/rules.ts` (the policy engine).

1. Every health dimension starts at `BASELINE_DIMENSION_SCORE` (85).
2. Each finding applies `scoreImpact` from `FINDING_POLICY`.
3. Scores are clamped to 0–100.
4. Overall health is the **weighted** average of dimensions (`DIMENSION_WEIGHTS`).
5. Status bands: healthy ≥ `STATUS_HEALTHY_MIN`, watch ≥ `STATUS_WATCH_MIN`, else at-risk.
6. Confidence blends evidence **reliability**, **quantity**, and **freshness** (`CONFIDENCE_*` constants). Empty evidence → `CONFIDENCE_EMPTY`.
7. Every score change is explained with finding and evidence IDs (`scoreExplanations` / `scoreChange.drivers`).

## Recommendation generation

For each open risk:

```
priorityScore =
  estimatedScoreImprovement
  × SEVERITY_MULTIPLIER[severity]
  × (confidence / 100)
  ÷ EFFORT_MULTIPLIER[effort]
```

Priority labels use `PRIORITY_HIGH_MIN` / `PRIORITY_MEDIUM_MIN`. Results are sorted highest `priorityScore` first.

## Policy engine (`rules.ts`)

Change behavior by editing `lib/intelligence/rules.ts`:

- Detection thresholds (concentration, runway, NRR, MFA, attrition, …)
- Finding materiality and score impacts (`FINDING_POLICY`)
- Risk severity cutoffs
- Recommendation priority bands and effort/severity multipliers
- Confidence model weights and freshness buckets
- Dimension weights and baseline score

Do **not** scatter magic numbers in analyzers.

## Extension guide — new rule

1. Add thresholds / `FINDING_POLICY` entry (and `RuleId`) in `rules.ts`.
2. Emit an insight with that `ruleId` in `evidence-analyzer.ts`.
3. Ensure `finding-engine.ts` groups the rule (or add to the remaining-rules list / merge group).
4. Add risk + recommendation templates if the finding is negative.
5. Add unit tests for thresholds and end-to-end engine behavior.
6. Document any new `extractedFacts` keys in this file.

## Public API

```ts
runInsightEngine({
  companyId: string;
  evidence: Evidence[];
  previousHealthScore?: HealthScore;
  dimensionProfiles?: HealthDimension[];
  asOf?: Date | string; // fixed clock — same evidence + asOf ⇒ identical output
}): {
  insights, findings, risks, healthScore,
  recommendations, timelineEvents,
  dimensions, scoreChange, evidence
}
```

Determinism: the engine never reads wall clock. Pass `asOf` (or rely on `DEFAULT_AS_OF`) so confidence freshness and timeline stamps are stable and replayable.

Application entry points:

```ts
await buildCompanyHealthSnapshot(platformInput) // @/lib/application — connectors + engine
getCompanyHealthSnapshot(companyId)             // registered company read (lib/data)
await buildCompanyHealthSnapshotFor(companyId)  // async rebuild + cache (lib/data → application)
listRegisteredCompanyIds()                      // multi-tenant registry keys
invalidateCompanySnapshot(companyId)            // drop cached snapshot (rebuild on next read)
```

Pages read only from `@/lib/data`. Register additional tenants with `registerCompanyPlatform(input)`.

Evidence UI aliases (`documentName`, `confidence`, …) live only on `EvidenceRecordView` — projected in `lib/data`, never on domain `Evidence`.

Sync ingest (`syncSync` / `buildCompanyHealthSnapshotFromSyncAdapters`) is **internal** to mock module-init via `@/lib/application` and is not part of the public `@/lib/connectors` API. Connectors never call `runInsightEngine`.

## Persistence (Supabase PostgreSQL)

Canonical tables (migration `supabase/migrations/001_company_health_schema.sql`):

| Table | Domain / role |
|-------|----------------|
| `companies` | `Company` |
| `users` | App profiles linked to `auth.users` + `company_id` |
| `documents` | Raw connector items (`RawConnectorItem`) before normalize — file id (`external_id`), path, modified (`modified_at`), owner, mime type, hash (`content_hash`) |
| `evidence` | `Evidence` |
| `findings` | `Finding` |
| `risks` | `Risk` |
| `recommendations` | `Recommendation` |
| `health_scores` | Point-in-time `HealthScore` + dimensions JSON |
| `timeline_events` | `TimelineEvent` |
| `connector_syncs` | Ingest run audit (`startConnectorSync` / `finishConnectorSync`) |
| `connector_credentials` | OAuth refresh tokens (encrypted) + connection status per company/connector |

### Google Drive OAuth + scheduled sync

Flow:

1. **Connect** — `GET /api/connectors/google-drive/authorize` → Google consent (`drive.readonly`, `access_type=offline`).
2. **Callback** — `GET /api/connectors/google-drive/callback` exchanges the code, encrypts the refresh token (`TOKEN_ENCRYPTION_KEY`), upserts `connector_credentials`.
3. **Sync** — `syncGoogleDriveForCompany()` crawls Drive (`files.list`), upserts `documents`, writes `connector_syncs`.
4. **Schedule** — Vercel Cron hits `GET /api/cron/sync-connectors` daily (`vercel.json`, auth via `CRON_SECRET`).

**Supported file types** (default crawl filter via `GOOGLE_DRIVE_SUPPORTED_MIME_TYPES`): PDF, DOCX, Google Docs, Google Sheets, Google Slides, TXT, Markdown, CSV.

Each supported file is downloaded/exported and parsed into a shared `ExtractedDocument`:

```ts
interface ExtractedDocument {
  text: string;
  title: string;
  metadata: Record<string, string | number | boolean | null>;
  sections: DocumentSection[];
}
```

Format extractors live in `lib/connectors/extraction/`. Drive wiring: `download.ts` + `extract.ts` → `createGoogleDriveAdapter.sync()` attaches `extractedDocuments` and text previews on raw items.

Env: see `.env.example` (`GOOGLE_CLIENT_*`, `GOOGLE_OAUTH_REDIRECT_URI`, `TOKEN_ENCRYPTION_KEY`, `CRON_SECRET`, `DEFAULT_COMPANY_ID`). Apply migration `002_connector_credentials.sql`. The mock `googleDriveConnector` remains for the static Acme demo; production uses `createGoogleDriveAdapter` / `syncGoogleDriveForCompany`.

Client + mappers live in `lib/supabase`. Server jobs use `createServiceClient()`; browser reads use `createBrowserClient()` (RLS: members see their company only).

```ts
import { createServiceClient, persistEngineResult } from "@/lib/supabase";

await persistEngineResult(createServiceClient(), {
  companyId,
  evidence, findings, risks, recommendations,
  healthScore, dimensions, scoreChange, timelineEvents,
});
```

Apply the migration in the Supabase SQL editor or via the Supabase CLI. Copy `.env.example` → `.env.local` with project URL and keys.

## Testing

```bash
npm test
```

Coverage targets: every detection threshold, score/confidence math, recommendation ranking, and connector normalize/ingest paths under `lib/intelligence/*.test.ts`.
