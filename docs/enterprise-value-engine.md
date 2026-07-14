# Enterprise Value Opportunity (v1)

Pluggable valuation with **ranges**, **assumptions**, **provenance**, **confidence**, and a **transparent discount engine**. Never present valuation as a point estimate.

## Outputs

| Field | Meaning |
|-------|---------|
| Estimated EV Today | Discounted current enterprise value **range** |
| Potential EV | Scenario-based upside **range** (default 36-month horizon) |
| EV Opportunity | Potential − Current (**range**) |
| Confidence | 0–100 score; lower confidence **widens** ranges |

## Providers

| Id | When |
|----|------|
| `market-multiples` | Revenue present |
| `income-heuristic` | EBITDA present (no revenue path) |
| `asset-heuristic` | Cash only |
| `rule-based` / unavailable | Missing unlock inputs |
| Future | External comps provider |

Built on Phase 10 `lib/value-navigator` plugins; transparent layer in `lib/enterprise-value`.

Dashboard and Company Doctor both use `estimateTransparentEnterpriseValue` so the same company shows the same Opportunity model.

## Minimum inputs

At least one of: **revenue**, **ebitda**, **cashBalance**.

Otherwise: `available: false` → “Preliminary valuation unavailable” + the one missing unlock input. No demo/placeholder values.

## Transparent discount engine

Each unresolved issue reduces **current** value. Every discount displays:

- title
- estimated value impact range
- explanation
- evidence supporting the discount **or** missing evidence
- recommended next action

| Kind | Meaning |
|------|---------|
| **Business** | Observed weakness (concentration, low growth, short runway, churn, margin) |
| **Evidence** | Uncertainty from missing data (no concentration export, no churn, incomplete history) |

Same issue is never counted in both. Concentration is **not** also haircut into the revenue multiple (avoids double-counting).

## Confidence & ranges

- Starts from provider completeness
- Evidence discounts reduce **confidence**
- Business discounts reduce **presented current EV**
- Presented ranges widen as confidence falls (`widenRangeForConfidence`)
- Filling evidence gaps raises confidence without inventing intrinsic operating improvement
- Missing evidence is ranked by expected confidence gain (`missingEvidencePriorities`)

## Company Doctor recommendations

Every recommendation estimates:

- expected enterprise value increase (range)
- confidence improvement
- evidence required
- estimated effort

## Provenance

```
Valuation → assumption/discount → fact key → evidence id → document
```

If evidence IDs are missing, the engine states provenance is limited — never fabricates citations.

## Extension points

- Add providers in `lib/value-navigator/providers/`
- Discount rules in `lib/enterprise-value/engine.ts`
- Persist discount columns via migration **022** on `company_value_navigators`
