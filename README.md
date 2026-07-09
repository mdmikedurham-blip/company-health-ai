# Company Health AI

Evidence-backed company health intelligence. Connectors normalize source data into a shared domain model; the Insight Engine turns that evidence into findings, risks, health scores, and prioritized recommendations.

## Architecture

```
Connectors (Drive, Box, QuickBooks, Carta, HubSpot, …)
        │  Evidence[]
        ▼
 Insight Engine
        │  Findings → Risks → HealthScore
        │  Risks → Recommendations
        │  Findings → Insights
        ▼
   CompanyDNA  ──►  UI /api/company-dna
```

- **Domain model** (`lib/domain`): `Evidence`, `Insight`, `Finding`, `Risk`, `Recommendation`, `HealthDimension`, `HealthScore`, `TimelineEvent`, `CompanyDNA`
- **Connectors** (`lib/connectors`): `EvidenceConnector` contract + registry. Fixture connectors stand in for OAuth integrations; swapping them does not change the UI.
- **Insight Engine** (`lib/insight-engine`): deterministic pipeline with confidence scores and evidence references
- **UI**: landing page and `/dashboard` both consume `loadCompanyDNA()` — no hardcoded health/risk demo arrays

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Intelligence view: [http://localhost:3000/dashboard](http://localhost:3000/dashboard). JSON: [http://localhost:3000/api/company-dna](http://localhost:3000/api/company-dna).

```bash
npm test
npm run build
```

## Adding a connector

Implement `EvidenceConnector`, register it on `ConnectorRegistry`, and emit `Evidence`. The engine and UI pick up the new source automatically.
