# Validation record

Verified with synthetic fixtures on 8 October 2026.

- 34 automated tests: exact signed money, real calendar dates, month-end clamping, rule priority, deletion and correction preservation, refund/transfer/pending semantics, recurrence grouping, daily lows, housing replacement, reserves, CSV parsing and repeated imports, atomic rollback, fixed-host read-only Starling calls, safe provider errors, local access gate, controlled Ollama tool calls, API preview/commit, scenario execution, plan editing, manual balance adjustments, reserve policy persistence and audit log retrieval.
- TypeScript check passes (`npm run typecheck`).
- Next.js production build passes (`npm run build`).
- Dependency audit reports zero known vulnerabilities after upgrading csv-parse to 7.0.3.
- Browser verified local unlock, fictional dashboard, responsive overview at 1440px and 390px, and a calculated housing/one-off scenario with inspectable evidence. The local origin check was corrected after this live browser test, with a regression assertion added.
- Independent visual review checked overview and scenario captures. It found unreadable SVG labels on mobile; labels were moved to normal-size HTML, the plot gained a stable height and an explicit £0 guide. The reviewer scored the chart correction resolved and returned a bounded ship disposition for the previously reviewed overview/scenario scope.

Not exercised: a real Starling token/account, a real Bank of Scotland export, or a running local Ollama installation/model. Their adapter and protocol boundaries are mock-tested. No private source amounts are seeded. Current forecasts are deterministic plan-based projections, not statistical predictions.

