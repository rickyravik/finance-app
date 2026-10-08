# Implementation plan and roadmap

## First vertical slice
1. Establish a local Next.js/TypeScript modular monolith and SQLite ledger. Integer GBP pence, explicit signed cash flows, ISO dates, transaction identity and atomic imports.
2. Build a dashboard with synthetic demo data, CSV preview/confirmation, category corrections and ordered merchant rules.
3. Detect candidate weekly/monthly commitments. Require review rather than silently asserting a bill. Forecast daily balances from explicit plans with date-clamped monthly payments; compare housing and one-off scenarios against the same baseline.
4. Add an environment-only, read-only Starling personal API adapter with response validation, settled/pending updates, atomic persistence and freshness indicators.
5. Give local Ollama only allowlisted, validated read/calculation tools. Return structured evidence alongside explanations. No SQL, arbitrary URLs, payment tools or credentials.
6. Verify domain and adapter edge cases, API protections, TypeScript and a production build; document limitations.

## Next milestones
- Confirm a redacted real Bank of Scotland export format and Starling sandbox fixtures. Review account transfer pairs and Starling Spaces coverage before trusting consolidated balances.
- Add editing for plans, reserve policies, opening balances, goals and assets/liabilities; encrypted backup/restore; local session authentication; audit review UI. Add scheduler and incremental sync with reconciliation and retry/backoff.
- Gather 6–12 months of clean data. Add transparent variable-spend estimates and empirically calibrated ranges, salary variability, confidence decay and debt amortisation/promo expiry modelling.
- Add deterministic goal projections and seeded Monte Carlo only after validating assumptions. Consider PostgreSQL through a replacement repository implementation; keep one application process initially.

## Acceptance boundaries
This is a personal, loopback-only initial MVP, not a hosted multi-user service. £0 recurring software/API subscriptions using existing hardware; electricity, hardware and internet are still costs. No bank login credentials, payment initiation, paid AI or automatic external deployment. Real data starts empty; demo seeding is explicit and forbidden once the database has accounts. The synced reference material is never modified or copied into fixtures.
