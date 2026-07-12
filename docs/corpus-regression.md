# Corpus Regression

## Commands

| Script | Purpose |
|--------|---------|
| `npm run corpus:generate` | Deterministic generation from seed |
| `npm run corpus:validate` | Cross-document + schema validation |
| `npm run corpus:evaluate` | Pipeline extract vs golden truth |

## Smoke vs full

- **Smoke (PR):** `company-factory/regression/smoke.test.ts` — one company, in-memory, no disk required beyond generate in beforeAll when needed.
- **Full:** `npm run corpus:evaluate` over all generated companies (expands after slice).

Unit `npm test` includes the smoke suite only; it does **not** generate the full 8-company corpus.

## Failure interpretation

| Signal | Meaning |
|--------|---------|
| Consistency failure | Factory bug — fix generators before trusting evaluate |
| Missing financial facts | XLSX/CSV labeling drift vs extractor rules |
| Risk mismatch | Golden truth vs extracted risk titles (use semantic aliases) |
| Score off-by-one | Use `expectedRange` — do not fail on ±1 |

## Adding coverage

1. Add profile/scenario under `company-factory/`
2. Register generators in the artifact manifest builder
3. Hand-author or derive golden truth **without** calling the insight engine for expectations
4. Run validate → evaluate
