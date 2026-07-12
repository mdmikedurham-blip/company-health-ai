# Company Factory (Phase 9)

Reusable generators for **fictional** companies whose documents, risks, and golden-truth assessments all derive from one canonical profile.

## Pre-implementation report

### Reusable infrastructure

| Area | Reuse |
|------|--------|
| Extraction | `lib/connectors/extraction` (`extractDocument`) |
| Evidence pipeline | `lib/connectors/documents/pipeline` |
| Insight engine | `lib/intelligence` (evaluate only; golden truth does **not** call it to define expectations) |
| Lifecycle stages | `lib/domain/company-classification` |
| Financial fact keys | `lib/connectors/extraction/financial-facts` |
| OOXML fixtures | store-zip pattern from extraction tests |
| Demo guards | `isDemoCompanyId` / Acme contamination scripts |

### Schemas (factory-owned)

- `CanonicalCompanyProfile` — identity, financials, customers, governance, security, strategy, risks
- `ScenarioConfig` — seeded scenario flags (`healthy`, `high_customer_concentration`, …)
- `ArtifactManifest` — generated files + quality variant + source metric bindings
- `GoldenTruth` — independent expected classification, Q&A, risks, Doctor first moves, ranges

### Artifact libraries

Vertical slice: CSV/TXT + minimal XLSX (store-zip). PDF/DOCX/PPTX generators deferred until slice passes (optional `pdf-lib` / `docx` / `pptxgenjs` later).

### New npm packages

**None required for the vertical slice.** Full multi-format generation later may add `exceljs`, `docx`, `pptxgenjs`, `pdf-lib` as **devDependencies**.

### Supabase migration

**Not required** for offline corpus generation + in-memory evaluation. Synthetic data must never write to production tenants without an explicit ingest flag (not shipped in this slice).

### Estimated corpus size (full Phase 9)

| Scope | Approx. |
|-------|---------|
| 8 companies × 12–25 docs | 96–200 artifacts |
| Manifests + golden truth JSON | ~1–2 MB text |
| Binary OOXML/PDF | tens of MB if committed; prefer generate-on-demand |

### Implementation phases

1. **Vertical slice** (this PR work): one Growth SaaS + ≥12 docs + golden truth + validate + evaluate smoke
2. Expand generators (PDF/DOCX/PPTX) + quality variants
3. Remaining 7 companies
4. Full regression metrics + optional CI smoke job

### Overfitting risks

- Tuning extractors only to factory wording
- Encoding engine bugs into golden truth
- Stage matrix collapsing to synthetic-only coverage

Mitigations: independent golden truth, semantic tolerances, keep real upload fixtures, ban production names/facts.

---

## How to run (vertical slice)

```bash
npm run corpus:generate   # write Northstar Growth SaaS under company-factory/corpus/
npm run corpus:validate   # consistency + schema checks
npm run corpus:evaluate   # extract + compare to golden truth (tolerances)
```

See also: [reference-corpus.md](./reference-corpus.md), [corpus-regression.md](./corpus-regression.md).
