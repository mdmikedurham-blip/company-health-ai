# Company Doctor Conversation Engine

## Overview

Doctor is the primary product experience: an experienced CEO mentor that

```
Observe → Diagnose → Ask ONE question → Request ONE evidence → Learn → Recommend ONE action
```

Upload Documents remains available as a **tool** Doctor can request — never as a wall of “upload everything.”

## Architecture

```
Company
  → Assessment Goal / Playbook (priorities)
  → Company Stage (applicability)
  → Assessment Snapshot (evidence SSOT)
  → Doctor Conversation (mutable mentor state)
       → one active Investigation
```

## Persistence (migration 020)

| Table | Role |
|-------|------|
| `doctor_conversations` | One **active** conversation per company; history, confidence, requested evidence |
| `doctor_investigations` | Focused investigations with hypotheses, evidence requests, recommendations, explainability |

## Workflow

`loadDoctorHome()` / `runDoctorCycleInMemory()`:

1. Load tenant snapshot + goal + stage
2. Select next investigation (stage-aware, goal-weighted)
3. Advance one step only (ask **or** evidence **or** recommend)
4. Never emit only “Upload more documents”

## API

- `GET /api/doctor/conversation` — home state
- `POST /api/doctor/conversation` — `{ completeCurrent?, message? }`
- Existing `POST /api/doctor` — free-form Q&A (still available in chat)

## UI

`/doctor` shows `DoctorHomePanel` (investigation, observation, confidence, next action, requested evidence, recently learned) above the existing chat. Upload link stays on evidence requests.

## Extending

1. Add a template to `lib/doctor/investigations/catalog.ts`
2. Set `applicableStages` + `goalWeights`
3. No changes to the insight/scoring engines
