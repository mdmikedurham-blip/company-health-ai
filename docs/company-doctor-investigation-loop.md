# Company Doctor Investigation Loop (Phase 11)

Primary demo experience: observe → diagnose → one investigation → one question → one evidence request → re-analyze → explain what changed.

## Investigation selection

Uses the **current Assessment Snapshot only** plus:

- structured financial facts
- findings / risks / recommendations
- company stage + assessment goal
- materiality / confidence
- expected enterprise value impact (Value Navigator drivers)

Does **not** manufacture a problem to fill the page. If no high-confidence issue exists, observation says so and labels remaining uncertainty.

Low-confidence hypotheses are prefixed as possibilities, not conclusions.

## One active investigation

`doctor_conversations` enforces one active conversation per company. The engine keeps a single primary investigation in `open | asking | awaiting_evidence | recommended`.

## One next action

Exactly one evidence request or recommendation is surfaced. Requests already satisfied by present evidence are skipped (`evidenceRequestSatisfied`).

Each action includes why it matters, expected learning, effort, confidence gain, EV impact range, and why it ranks above alternatives.

## Persistence

- Core conversation/investigation: migration **020**
- Phase 11 investigation fields: migration **022** (optional; in-memory enrichment always runs)
- Upsert falls back to 020 columns if 022 is not applied

## Extension points

- Investigation catalog: `lib/doctor/investigations/catalog.ts`
- Selection scoring: `selectNextInvestigationTemplate` in `workflow.ts`
- Enrichment: `lib/doctor/conversation/enrich-investigation.ts`
- Transparent EV: `lib/enterprise-value/`

## Demo limitations

- No mock/demo values in authenticated production tenants
- Valuation suppressed when revenue/EBITDA/cash are all absent
- Company Factory synthetic data must never load into a real tenant
