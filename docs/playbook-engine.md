# Due Diligence Playbook Engine

## Overview

Playbooks turn Company Health AI from a generic assessment platform into a
**purpose-driven due diligence assistant**.

```
Company
  → Current Assessment Goal  (persisted preference)
  → Playbook                 (registry provider)
  → Question / evidence / recommendation priorities
  → Readiness + upload guidance + report sections
```

**Evidence, question answers, findings, risks, health scores, and published
Assessment Snapshots are shared and immutable across playbooks.**

Changing the assessment goal **does not** re-extract documents or duplicate
evidence. It only recomputes:

- question ordering
- recommendation ordering
- upload priorities
- readiness / blockers
- executive-summary and report context

## Assessment Goal integration

| Layer | Role |
|-------|------|
| `company_assessment_goals.goal` | Live selected operating mode |
| `PlaybookId` | Same string id as `AssessmentGoalId` |
| `getPlaybookProvider(goal)` | Resolve interpretation strategy |

Default goal / playbook: **`run-the-company`**.

## Assessment Snapshot consistency

All playbook output for a published company should derive from **one**
Assessment Snapshot pack (`getCurrentAssessmentSnapshot` → `pack`).

Never mix:

- answers from snapshot A
- findings from snapshot B
- scores from snapshot C

Every API payload includes `provenance` with `snapshotId`, `playbookId`,
`playbookVersion`, `companyStage`, and `generatedAt`.

## Provider interface

`PlaybookProvider` (`lib/playbooks/provider.ts`) defines:

| Field / method | Purpose |
|----------------|---------|
| `id`, `name`, `objective` | Identity |
| `successCriteria` | What “ready” means |
| `applicableLifecycleStages` | Stage gating |
| `minCoveragePercent` | Gate for publishing readiness |
| `dimension / question / evidence priorities` | Static weights |
| `prioritizeQuestions()` | Ordered question ids |
| `prioritizeRecommendations()` | Reordered recommendations |
| `prioritizeUploads()` | “What should I upload next?” |
| `calculateReadiness()` | Readiness model |
| `identifyCriticalBlockers()` | High-weight gaps |
| `generateMissingEvidence()` | Missing evidence list |
| `buildExecutiveSummaryContext()` | Playbook-specific summary |
| `buildReportSections()` | Future PDF section list |

Implementations are created with `definePlaybook()` — **no consumer
`switch` on playbook id**.

## Registry

```
lib/playbooks/register.ts  → registerPlaybookProvider(...)
lib/playbooks/registry.ts  → getPlaybookProvider / listPlaybookProviders
```

Adding a playbook:

1. Create `lib/playbooks/providers/<id>.ts` with `definePlaybook({...})`
2. Register it in `register.ts`
3. Add the id to `PLAYBOOK_IDS` / assessment-goal CHECK if new
4. **Do not** change the insight / scoring engines

## Readiness model

`calculateReadiness()` returns:

| Field | Meaning |
|-------|---------|
| `readinessAvailable` | `evidenceCoveragePercent >= minCoveragePercent` |
| `readinessPercent` | Weighted supported / applicable (null if not available) |
| `evidenceCoveragePercent` | Question coverage |
| `criticalBlockers` | High-weight contradicted / insufficient answers |
| `unsupportedQuestions` | Not yet supported applicable questions |
| `highPriorityUploads` | Top required/recommended uploads |
| `topRecommendations` | Playbook-ordered actions |
| `confidence` | From coverage / health |
| `snapshotId` | Provenance |
| `generatedAt` | Provenance |

**Do not publish readiness % when coverage is below the playbook minimum.**

Stage interaction:

- Answers with `stageLevel === "not_applicable"` never create blockers
- Upload items filter by `applicableStages`
- IPO playbook applies fully only from Growth / Scale / Exit Ready
- Idea-stage companies under **Run the Company** are not failed for IPO bars

## Upload prioritization

Each upload recommendation includes:

- `evidenceCategory`
- `priority` / `level` (required | recommended | optional)
- `why`
- `questionsItCouldAnswer`
- `expectedCoverageImpact`
- `applicableStages`
- `evidenceTypes` (satisfied → hidden from “upload next”)

## API

`GET /api/company/playbook`

Returns:

- `playbook` (full dashboard context)
- `availablePlaybooks`
- `readiness`
- `criticalBlockers`
- `uploadPriorities`
- `prioritizedQuestions`
- `prioritizedRecommendations`
- `reportSections`
- `provenance`

No demo/mock fallback when empty — empty interpretation only.

## Supported playbooks

| Id | Focus |
|----|-------|
| `run-the-company` | Protect / Grow / Operate / Prepare / Decide |
| `raise-capital` | Financial quality, growth, cap table, investor materials |
| `sell-the-company` | Legal, IP, contracts, board approvals, data room |
| `acquire-a-company` | Downside, QoE, concentration, integration |
| `board-readiness` | Cadence, minutes, approvals, accountability |
| `enterprise-sales` | Security, privacy, IR, vendor diligence |
| `annual-audit` | Statements, controls, schedules, PBC |
| `ipo-readiness` | Controls, governance, audit, disclosure |

## Migration

`019_playbook_engine.sql` adds `analysis_snapshots.playbook_version` for
publish provenance. Playbook definitions live in code.

## Extension guide

1. Copy an existing provider under `lib/playbooks/providers/`
2. Fill priorities, uploads, readiness minimum, stages, report sections
3. Register in `register.ts`
4. Add tests asserting reorder vs another playbook
5. Ship — reasoning engine untouched
