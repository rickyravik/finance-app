# Personal finance control centre

Local Next.js + TypeScript modular monolith, SQLite and optional local Ollama. No paid hosting or AI API required. The working initial slice includes a protected dashboard, manual Bank of Scotland import preview/commit, category rules and corrections, recurring candidates, editable monthly plans, 90-day housing/one-off comparisons, read-only Starling sync and a controlled AI toolbox. All example amounts are fictional.

## Run on Windows
Requires Node.js 24+ (built-in SQLite). From this folder:

```powershell
npm ci
Copy-Item .env.example .env.local
```

Set `APP_ACCESS_KEY` in `.env.local` to a long random secret. Generate one locally:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Keep the key private. Leave `STARLING_PERSONAL_TOKEN` empty until ready. Default database `./data/finance.sqlite` starts empty. Run:

```powershell
npm run dev
```

Open [the local dashboard](http://127.0.0.1:3000) and enter your access key. Use that address consistently for origin checks. Do not bind to a public network or deploy this initial version.

## Try synthetic data first

```powershell
npm run seed
```

Set `DATABASE_PATH=./data/demo.sqlite` in `.env.local`, then restart the app. Demo seeding is explicit; it never copies the Bastille brief's financial amounts. Demo databases refuse bank sync/import. For real data, switch back to a fresh `./data/finance.sqlite` and restart. The seed command defaults to demo.sqlite and refuses a populated database. Shell environment values override `.env.local`; check them if the wrong workspace opens.

## Import Bank of Scotland
In Connections choose a CSV, a stable account identifier and the available account balance at import time. Preview, fix every error, then confirm. Accepted headers:

```csv
Date,Description,Amount
2026-10-01,Example rent,-720.00
2026-10-02,Example refund,12.00
```

Or `Transaction Date,Transaction Description,Debit Amount,Credit Amount`, with `DD/MM/YYYY` dates. UK GBP statements only. Exact live export variants still need verification; adapt the parser to a redacted sample if necessary. A fixture is provided in `examples/bos-synthetic.csv`. Correct internal transfers and refunds before relying on spend totals. Duplicate full-file imports are skipped; identical transactions in overlapping partial exports need manual review.

## Starling read-only setup
Create a personal token for your own account in the [Starling developer portal](https://developer.starlingbank.com/personal/token), requesting only account, balance and transaction read permissions. Set `STARLING_PERSONAL_TOKEN` in `.env.local`; never use `NEXT_PUBLIC_` or paste a token into the UI or chat. Restart, then use Connections to sync a bounded date range. Revoke the token in the bank's developer portal when finished. No bank passwords or payment APIs exist in this app.

Reference: [Starling personal access and permissions](https://developer-sandbox.starlingbank.com/permissions), [Starling API docs](https://developer.starlingbank.com/docs). Mock-tested; live access has not been verified. GBP default current-account feeds only; Starling Spaces are not yet included.

## Plans and forecasts
Create salary, rent, council tax, utilities, family support, debt repayments, investment contributions and realistic variable-spend plans. Amounts leaving cash are negative. Add explicit start/end dates. Recurring detection is a review aid; it does not add plans for you. Enter transfer plans only when cash genuinely leaves the accounts included in your forecast.

Run a baseline by leaving scenario inputs blank. To compare a move, enter rent, council tax and utilities plus housing start date; they replace those current categories. Add a deposit, rent overlap or travel as a one-off. Safe-to-spend depends on the accuracy and completeness of these assumptions and balance freshness. It is not a personalised recommendation. No real Bastille figures are prefilled.

## Local AI (optional)
Install [Ollama](https://ollama.com), pull a tool-capable local model appropriate for your machine (for example `ollama pull qwen3:8b`) and set `OLLAMA_MODEL=qwen3:8b`. A smaller local model may be needed on limited hardware. Keep Ollama's cloud functionality disabled and use a downloaded local model. The app fixes requests to `http://127.0.0.1:11434/api/chat` and rejects cloud-labelled model names. Ollama must already be running; this project does not install models or start it.

Ask for balances, spending by category, recurring candidates or a daily forecast. Numerical evidence comes from validated TypeScript tools. No direct DB access, payment tools or remote AI API. Inspect the evidence because model prose can misstate it. [Ollama native chat/tool API](https://docs.ollama.com/api/chat).

## Verify and build

```powershell
npm test
npm run typecheck
npm run build
npm start
```

See [implementation roadmap](docs/PLAN.md), [architecture, schema and known limitations](docs/ARCHITECTURE.md), and [security notes](docs/SECURITY.md). Pinning and the lockfile make installation reproducible. Private local databases are excluded from source control. Back them up securely outside the repository before upgrading.

## Repo structure
```text
src/app/             dashboard, layout, styles, protected control API
src/domain/          canonical schemas, exact money, categorisation, recurrence, forecast
src/providers/       replaceable adapter contract, Starling reads, CSV normalisation
src/server/          SQLite repository, access gate, tool dispatcher, Ollama coordinator
scripts/seed.ts      explicit synthetic demo only
tests/               domain, persistence, adapter and security tests
examples/            fictional CSV fixture
docs/                roadmap, architecture/data model and security
data/                ignored local databases (created at runtime)
```
