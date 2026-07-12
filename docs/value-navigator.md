# Company Value Navigator (Phase 10)

Primary executive experience: **enterprise value creation**, with Company Health as an input.

The platform answers:

1. How valuable is my company today?
2. How valuable could it become?
3. What is preventing that?
4. What actions create the highest return?

**Never fabricate valuation precision.** Every estimate is a range with confidence, assumptions, data completeness, and missing inputs.

---

## Pre-implementation report

### Existing architecture (before Phase 10)

| Layer | Status |
|-------|--------|
| Financial facts | Reuse `financial-facts` + Doctor `financial-diagnosis` |
| Health / findings / risks | Reuse snapshot pack |
| Assessment goals | Reuse IDs; Value Navigator reweights drivers per goal |
| Valuation / EV / multiples | **Did not exist** — invented in this phase |
| Dashboard | Extended with Value Navigator cards above health |

### Required migration

`021_company_value_navigator.sql`

| Table | Purpose |
|-------|---------|
| `company_value_navigators` | Persisted EV ranges per company + snapshot |
| `company_value_drivers` | Ranked drivers with explainability |
| `company_value_scenarios` | Isolated what-ifs; never overwrite assessment SSOT |

RLS: member select / writer insert+update via `is_company_member` / `is_company_writer`.

### Provider interfaces

```ts
ValuationProvider.estimate(input) → ValuationEstimate
// ranges + assumptions + confidence + dataCompleteness + missingInputs

ValueDriverEngine → rankValueDrivers(...)
ScenarioEngine → applyScenario(...) // isolated copy; never mutates base
```

Plugins:

| Id | Role |
|----|------|
| `market-multiples` | Primary when revenue exists (SaaS revenue × band) |
| `income-heuristic` | EBITDA capitalization band |
| `asset-heuristic` | Cash floor |
| `rule-based` | Empty / insufficient inputs |
| `ml-future` | Reserved stub — emits no fabricated values |

### Scenario architecture

- Catalog of named scenarios (growth, margin, churn, NRR, burn, raise, hire, product, acquire, governance, SOC2, concentration).
- Each scenario clones valuation inputs, recomputes estimate, returns risks + actions.
- `isolatedFromAssessment: true` always — assessment snapshot SSOT unchanged.
- API: `POST /api/company/value-navigator` with `{ scenarioKey }`.

### Deployment order

1. Apply migration **021** in Supabase.
2. Deploy app (dashboard + `/api/company/value-navigator` + Doctor value boost).
3. No new env vars required for core navigator.

### Risks

- Over-precision → always ranges + confidence + assumptions.
- Heuristic multiples → documented as assumptions, not live market quotes.

---

## Architecture

```
Evidence (financial facts)
    → ValuationInput
    → ValuationProvider (pluggable)
    → CompanyValueNavigator
         ├── current / potential EV ranges
         ├── valueGap = potential − current
         ├── drivers (ranked)
         ├── evidence request (value-framed)
         └── scenarios (isolated)
```

Runtime modules: `lib/value-navigator/*`  
Domain types: `lib/domain/value-navigator.ts`  
Dashboard: `ValueNavigatorPanel` on `/dashboard`  
API: `GET|POST /api/company/value-navigator`

### Persisted fields (navigator)

- `currentEstimatedEnterpriseValueRange`
- `potentialEnterpriseValueRange`
- `probabilityOfAchievingPotential`
- `valueGap`
- `valuationConfidence`
- `valuationMethod`
- `snapshotId`
- `generatedAt`

---

## Assumptions & confidence

- Multiples and capitalization bands are **heuristic assumptions**, not live comps.
- Confidence rises with data completeness (more financial facts → higher confidence).
- Missing inputs are always listed; empty estimates return zero ranges with low/zero confidence.
- Midpoints are for ranking/timeline only — UI presents ranges.

---

## Value Gap (primary KPI)

```
Value Gap = Potential Enterprise Value − Current Enterprise Value
```

Expressed as a range (conservative low / optimistic high).

---

## Value Drivers

Each driver includes: title, estimated value impact range, confidence, difficulty, estimated time, required evidence, supporting evidence, business rationale, assumptions, dependencies, status, current/target metrics.

Examples: customer concentration, recurring revenue, gross margin, cash runway, revenue growth, governance, SOC2, leadership, sales efficiency, product execution, pricing.

Drivers are reweighted by **Assessment Goal** (e.g. Enterprise Sales elevates SOC2; Sell elevates concentration).

---

## Scenario engine

Scenarios recompute estimated value, confidence, major risks, and recommended next actions. They never overwrite the current assessment.

---

## Company Doctor integration

Doctor investigation priority includes a **value boost** from ranked Value Drivers so Doctor prioritizes highest expected enterprise value creation, not only health score.

Evidence requests are framed as:

- Expected value impact
- Expected confidence increase
- Estimated time
- Why this matters

Never “please upload documents” as the primary ask — request **evidence**.

---

## Dashboard cards (order)

1. Enterprise Value (Today / Potential / Value Gap / Confidence)
2. Top 5 Value Drivers
3. Current Investigation
4. Highest ROI Action
5. Value Timeline (EV mid, coverage, confidence, health)

Health remains available below as an input, not the hero KPI.

---

## Assessment Goals → value intent

| Goal | Intent |
|------|--------|
| Run the Company | maximize enterprise value |
| Raise Capital | maximize investor readiness |
| Sell Company | maximize exit value |
| Acquire Company | maximize acquisition quality |
| Enterprise Sales | maximize enterprise trust |
| IPO | maximize public-company readiness |

---

## Future ML integration

`ml-future` provider is registered but returns no estimates until a trained model is approved. Wire it via `estimateEnterpriseValue(..., "ml-future")` only after validation gates exist.
