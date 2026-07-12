# Company Factory

Offline generators for fictional companies and regression corpus artifacts.

```
company-factory/
  profiles/          # canonical profiles
  generators/        # artifact builders
  validators/        # consistency checks
  golden-truth/      # independent expectations
  schemas/           # TypeScript types
  corpus/            # generated output (synthetic-*)
  regression/        # generate / validate / evaluate
  seed.ts
  README.md
```

## Safety

- All ids use `synthetic-` prefix
- Metadata: `synthetic: true`, `dataClass: "factory-corpus"`
- Do not load into production tenants
- Future persist requires `SYNTHETIC_CORPUS_INGEST=1`

## Vertical slice

`synthetic-northstar-growth-saas` — Growth B2B SaaS with concentration risk.

```bash
npm run corpus:generate
npm run corpus:validate
npm run corpus:evaluate
```
