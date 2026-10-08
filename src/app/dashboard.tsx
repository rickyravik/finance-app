"use client";
import { useState } from "react";
import {
  categories,
  roles,
  money,
  type Account,
  type Plan,
  type Rule,
  type Transaction,
} from "@/domain/model";
import type { forecast, recurring } from "@/domain/engine";
type Data = {
  accounts: Account[];
  transactions: Transaction[];
  plans: Plan[];
  rules: Rule[];
  recurring: ReturnType<typeof recurring>;
  demo: boolean;
  today: string;
  starlingConfigured: boolean;
};
type ForecastResult = {
  result: ReturnType<typeof forecast>;
  baseline: ReturnType<typeof forecast>;
  delta: number;
};
const gbp = (p: number) =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(
    p / 100,
  );
const tabs = [
  "Overview",
  "Transactions",
  "Plans & scenarios",
  "Connections",
  "Local assistant",
] as const;
function Choices({
  name,
  values,
  initial,
}: {
  name: string;
  values: readonly string[];
  initial?: string;
}) {
  return (
    <select name={name} defaultValue={initial}>
      {values.map((v) => (
        <option key={v}>{v}</option>
      ))}
    </select>
  );
}
export default function Dashboard() {
  const [key, setKey] = useState("");
  const [data, setData] = useState<Data>();
  const [tab, setTab] = useState<(typeof tabs)[number]>("Overview");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<{
    csv: string;
    accountId: string;
    balance: number;
    errors: { row: number; message: string }[];
    transactions: Transaction[];
    total: number;
  }>();
  const [prediction, setPrediction] = useState<ForecastResult>();
  const [answer, setAnswer] = useState<{
    answer: string;
    evidence: unknown[];
  }>();
  async function api(payload: unknown) {
    const response = await fetch("/api/control", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-app-key": key },
      body: JSON.stringify(payload),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error);
    return result;
  }
  async function refresh() {
    setData(await api({ action: "overview" }));
  }
  async function run(work: () => Promise<void>) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await work();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Operation failed");
    } finally {
      setBusy(false);
    }
  }
  const total = data?.accounts.reduce((s, a) => s + a.available, 0) ?? 0;
  const monthlyIncome =
    data?.plans.filter((p) => p.amount > 0).reduce((s, p) => s + p.amount, 0) ??
    0;
  const monthlyOut =
    data?.plans.filter((p) => p.amount < 0).reduce((s, p) => s - p.amount, 0) ??
    0;
  function fields(form: HTMLFormElement) {
    return Object.fromEntries(new FormData(form));
  }
  if (!data)
    return (
      <main className="unlock">
        <div className="wordmark">Finance / personal</div>
        <h1>
          Your money.
          <br />A clearer view.
        </h1>
        <p>
          A private control centre for spending, commitments and the decisions
          ahead.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void run(refresh);
          }}
        >
          <label>
            Local access key
            <input
              type="password"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              autoComplete="off"
              required
            />
          </label>
          <button disabled={busy}>
            {busy ? "Opening…" : "Open control centre"}
          </button>
        </form>
        <p className="muted">
          Use the APP_ACCESS_KEY in your local settings. Your key stays in
          memory for this session.
        </p>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
      </main>
    );
  return (
    <div className="shell">
      <aside>
        <div className="wordmark">Finance / personal</div>
        <nav aria-label="Main navigation">
          {tabs.map((t) => (
            <button
              key={t}
              className={tab === t ? "active" : ""}
              onClick={() => setTab(t)}
            >
              {t}
            </button>
          ))}
        </nav>
        <div className="sidebar-foot">
          <strong>On your computer</strong>
          <p>
            Read-only bank access
            <br />
            Local calculations and AI
          </p>
          <button
            onClick={() => {
              setData(undefined);
              setKey("");
              setPreview(undefined);
              setAnswer(undefined);
              setPrediction(undefined);
            }}
          >
            Lock session
          </button>
        </div>
      </aside>
      <main>
        <header>
          <div>
            <h1>{tab === "Overview" ? "Your financial picture" : tab}</h1>
            <p className="muted">
              {data.today} ·{" "}
              {data.demo
                ? "Fictional demonstration data"
                : "Personal local ledger"}
            </p>
          </div>
          <button
            className="secondary"
            disabled={busy}
            onClick={() => void run(refresh)}
          >
            Refresh view
          </button>
        </header>
        {data.demo && (
          <p className="banner">
            Demo workspace. All balances and transactions are fictional. Use a
            separate database for your real accounts.
          </p>
        )}
        <div aria-live="polite">
          {notice && <p className="success">{notice}</p>}
          {busy && <p>Working…</p>}
        </div>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        {tab === "Overview" && (
          <>
            <section className="summary" aria-label="Financial summary">
              <div>
                <span>Available cash</span>
                <strong>{gbp(total)}</strong>
                <small>
                  {data.accounts.length} connected or manual accounts
                </small>
              </div>
              <div>
                <span>Planned monthly outflow</span>
                <strong>{gbp(monthlyOut)}</strong>
                <small>Includes saving and investments</small>
              </div>
              <div>
                <span>Planned monthly headroom</span>
                <strong>{gbp(monthlyIncome - monthlyOut)}</strong>
                <small>Nominal totals of all saved plans</small>
              </div>
            </section>
            <div className="columns">
              <section>
                <h2>Your accounts</h2>
                {data.accounts.length ? (
                  data.accounts.map((a) => (
                    <div className="ledger-row" key={a.id}>
                      <div>
                        <strong>{a.name}</strong>
                        <small>
                          Balance checked{" "}
                          {new Date(a.asOf).toLocaleString("en-GB")}
                        </small>
                      </div>
                      <strong>{gbp(a.available)}</strong>
                    </div>
                  ))
                ) : (
                  <div className="empty">
                    <h3>Start with one account</h3>
                    <p>
                      Import a statement or connect Starling to build your
                      picture.
                    </p>
                    <button onClick={() => setTab("Connections")}>
                      Add financial data
                    </button>
                  </div>
                )}
                <p className="muted">
                  Manual balances need updating separately. Current-account sync
                  excludes Starling Spaces.
                </p>
              </section>
              <section>
                <h2>Recurring candidates</h2>
                <p className="muted">
                  Patterns to review, not confirmed bills. Add expected payments
                  in Plans.
                </p>
                {data.recurring.length ? (
                  data.recurring.map((r, i) => (
                    <div className="ledger-row" key={i}>
                      <div>
                        <strong>{r.merchant}</strong>
                        <small>
                          {r.cadence} · {r.observations} observations ·{" "}
                          {r.stale ? "overdue estimate" : `next ${r.next}`}
                        </small>
                      </div>
                      <strong>{gbp(r.amount)}</strong>
                    </div>
                  ))
                ) : (
                  <p>
                    No recurring patterns yet. At least three observations are
                    needed.
                  </p>
                )}
                <button
                  className="secondary"
                  onClick={() => setTab("Plans & scenarios")}
                >
                  Review cash-flow plans
                </button>
              </section>
            </div>
            <section className="decision">
              <div>
                <h2>What would a move change?</h2>
                <p>
                  Compare rent, council tax, heating and moving costs against
                  your current plans.
                </p>
              </div>
              <button onClick={() => setTab("Plans & scenarios")}>
                Explore a scenario
              </button>
            </section>
          </>
        )}
        {tab === "Transactions" && (
          <>
            <section>
              <h2>Category rules</h2>
              <p>
                Rules match merchant text, highest priority first. Your
                individual corrections always win.
              </p>
              <form
                className="form-grid"
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = fields(e.currentTarget);
                  void run(async () => {
                    await api({
                      action: "rule",
                      ...f,
                      priority: Number(f.priority),
                    });
                    await refresh();
                    setNotice(
                      "Rule saved and uncorrected transactions updated.",
                    );
                  });
                }}
              >
                <label>
                  Merchant contains
                  <input name="match" required minLength={2} />
                </label>
                <label>
                  Category
                  <Choices name="category" values={categories} />
                </label>
                <label>
                  Financial role
                  <Choices name="role" values={roles} initial="essential" />
                </label>
                <label>
                  Priority
                  <input
                    name="priority"
                    type="number"
                    defaultValue="10"
                    min="0"
                    max="1000"
                    required
                  />
                </label>
                <button disabled={busy}>Save rule</button>
              </form>
              {data.rules.map((r) => (
                <p key={r.id} className="muted">
                  {r.match} → {r.category} / {r.role} (priority {r.priority})
                </p>
              ))}
            </section>
            <section>
              <h2>Transaction ledger</h2>
              <p className="muted">
                {data.transactions.length} entries. Showing the latest 200.
                Pending entries are excluded from spending and recurrence.
              </p>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Date / merchant</th>
                      <th>Amount</th>
                      <th>Category correction</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.transactions.slice(0, 200).map((t) => (
                      <tr key={t.id}>
                        <td>
                          <strong>{t.merchant}</strong>
                          <small>
                            {t.date}
                            {t.pending ? " · pending" : ""}
                            {t.corrected ? " · corrected" : ""}
                          </small>
                        </td>
                        <td className="amount">{gbp(t.amount)}</td>
                        <td>
                          <form
                            className="inline"
                            onSubmit={(e) => {
                              e.preventDefault();
                              const f = fields(e.currentTarget);
                              void run(async () => {
                                await api({
                                  action: "correct",
                                  id: t.id,
                                  ...f,
                                });
                                await refresh();
                                setNotice("Correction saved.");
                              });
                            }}
                          >
                            <label className="sr-only" htmlFor={`cat-${t.id}`}>
                              Category for {t.merchant}
                            </label>
                            <select
                              id={`cat-${t.id}`}
                              name="category"
                              defaultValue={t.category}
                            >
                              {categories.map((c) => (
                                <option key={c}>{c}</option>
                              ))}
                            </select>
                            <label className="sr-only" htmlFor={`role-${t.id}`}>
                              Role for {t.merchant}
                            </label>
                            <select
                              id={`role-${t.id}`}
                              name="role"
                              defaultValue={t.role}
                            >
                              {roles.map((r) => (
                                <option key={r}>{r}</option>
                              ))}
                            </select>
                            <button disabled={busy}>Save</button>
                          </form>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!data.transactions.length && (
                <p>Import a CSV to start reviewing transactions.</p>
              )}
            </section>
          </>
        )}
        {tab === "Plans & scenarios" && (
          <>
            <section>
              <h2>Monthly cash-flow plans</h2>
              <p>
                Enter income as positive amounts and outflows as negative
                amounts. Budget variable spending here too. Plans drive
                forecasts; detected patterns do not enter automatically.
              </p>
              <form
                className="form-grid"
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = fields(e.currentTarget);
                  void run(async () => {
                    await api({
                      action: "plan",
                      plan: {
                        id: crypto.randomUUID(),
                        name: f.name,
                        amount: money(String(f.amount)),
                        day: Number(f.day),
                        category: f.category,
                        role: f.role,
                        start: f.start,
                        ...(f.end ? { end: f.end } : {}),
                      },
                    });
                    await refresh();
                    setNotice("Monthly plan saved.");
                  });
                }}
              >
                <label>
                  Name
                  <input name="name" required maxLength={100} />
                </label>
                <label>
                  Monthly amount (£)
                  <input name="amount" placeholder="-150.00" required />
                </label>
                <label>
                  Day of month
                  <input
                    name="day"
                    type="number"
                    min="1"
                    max="31"
                    defaultValue="1"
                    required
                  />
                </label>
                <label>
                  Category
                  <Choices name="category" values={categories} />
                </label>
                <label>
                  Role
                  <Choices name="role" values={roles} initial="essential" />
                </label>
                <label>
                  Starts
                  <input
                    name="start"
                    type="date"
                    defaultValue={data.today}
                    required
                  />
                </label>
                <label>
                  Ends (optional)
                  <input name="end" type="date" />
                </label>
                <button disabled={busy}>Add monthly plan</button>
              </form>
              {data.plans.map((p) => (
                <div className="ledger-row" key={p.id}>
                  <div>
                    <strong>{p.name}</strong>
                    <small>
                      Day {p.day} · {p.category} · from {p.start}
                      {p.end ? ` to ${p.end}` : ""}
                    </small>
                  </div>
                  <strong>{gbp(p.amount)}</strong>
                  <button
                    className="secondary"
                    disabled={busy}
                    onClick={() =>
                      void run(async () => {
                        await api({ action: "deletePlan", id: p.id });
                        await refresh();
                      })
                    }
                  >
                    Remove
                  </button>
                </div>
              ))}
            </section>
            <section>
              <h2>Explore the next 90 days</h2>
              <p>
                Start at your balance date. A housing change replaces Rent,
                Council tax and Utilities plans from the chosen start date.
                Enter all three replacement costs. Costs are charged together on
                that date each month.
              </p>
              <form
                className="form-grid"
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = fields(e.currentTarget);
                  void run(async () => {
                    const input = {
                      from: f.from,
                      days: 90,
                      reserve: money(String(f.reserve)),
                      ...(f.rent !== ""
                        ? {
                            housing: {
                              rent: money(String(f.rent)),
                              councilTax: money(String(f.tax)),
                              utilities: money(String(f.energy)),
                              start: f.moveDate,
                            },
                          }
                        : {}),
                      ...(f.purchase !== ""
                        ? {
                            purchase: {
                              amount: money(String(f.purchase)),
                              date: f.purchaseDate,
                            },
                          }
                        : {}),
                    };
                    setPrediction(
                      await api({ action: "scenario", input, save: true }),
                    );
                    setNotice("Scenario calculated and saved.");
                  });
                }}
              >
                <label>
                  Forecast begins
                  <input
                    name="from"
                    type="date"
                    defaultValue={data.today}
                    required
                  />
                </label>
                <label>
                  Cash reserve (£)
                  <input name="reserve" defaultValue="500" required />
                </label>
                <label>
                  New rent (£, optional)
                  <input name="rent" placeholder="1000" />
                </label>
                <label>
                  New council tax (£)
                  <input name="tax" defaultValue="190" />
                </label>
                <label>
                  New utilities (£)
                  <input name="energy" defaultValue="140" />
                </label>
                <label>
                  Housing start
                  <input
                    name="moveDate"
                    type="date"
                    defaultValue={data.today}
                  />
                </label>
                <label>
                  One-off cost (£, optional)
                  <input
                    name="purchase"
                    placeholder="Deposit, moving or travel"
                  />
                </label>
                <label>
                  One-off date
                  <input
                    name="purchaseDate"
                    type="date"
                    defaultValue={data.today}
                  />
                </label>
                <button disabled={busy}>Calculate scenario</button>
              </form>
              {prediction && (
                <div className="forecast">
                  <div className="summary">
                    <div>
                      <span>Lowest forecast balance</span>
                      <strong>{gbp(prediction.result.minimum)}</strong>
                    </div>
                    <div>
                      <span>Safe to spend*</span>
                      <strong>{gbp(prediction.result.safeToSpend)}</strong>
                    </div>
                    <div>
                      <span>Change vs baseline at day 90</span>
                      <strong>{gbp(prediction.delta)}</strong>
                    </div>
                  </div>
                  <CashChart result={prediction} />
                  <p className="muted">
                    *Cash above your reserve at the lowest point, conditional on
                    every saved plan. Missing food, fuel, debt or irregular
                    costs will overstate this figure. This is a planning
                    estimate.
                  </p>
                  <details>
                    <summary>Daily calculation and events</summary>
                    <pre>
                      {JSON.stringify(
                        {
                          assumptions: prediction.result.assumptions,
                          events: prediction.result.events,
                          points: prediction.result.points,
                        },
                        null,
                        2,
                      )}
                    </pre>
                  </details>
                </div>
              )}
            </section>
          </>
        )}
        {tab === "Connections" && (
          <>
            <div className="columns">
              <section>
                <h2>Bank of Scotland</h2>
                <p>
                  Import an exported CSV. Preview the dates and signed amounts
                  before confirming.
                </p>
                <form
                  className="stack"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const form = e.currentTarget;
                    void run(async () => {
                      const f = new FormData(form);
                      const file = f.get("file") as File;
                      const csv = await file.text();
                      const balance = money(String(f.get("balance")));
                      const accountId = String(f.get("account"));
                      const result = await api({
                        action: "import",
                        csv,
                        accountId,
                        balance,
                        commit: false,
                      });
                      setPreview({ csv, accountId, balance, ...result });
                    });
                  }}
                >
                  <label>
                    Account label (stable identifier)
                    <input name="account" defaultValue="current" required />
                  </label>
                  <label>
                    Current available balance (£)
                    <input
                      name="balance"
                      required
                      placeholder="Balance at time of import"
                    />
                  </label>
                  <label>
                    CSV statement
                    <input
                      name="file"
                      type="file"
                      accept=".csv,text/csv"
                      required
                    />
                  </label>
                  <button disabled={busy || data.demo}>Preview import</button>
                </form>
                <p className="muted">
                  Supported columns: Date, Description, Amount; or Transaction
                  Date, Transaction Description, Debit Amount, Credit Amount.
                  Dates: YYYY-MM-DD or DD/MM/YYYY.
                </p>
                {preview && (
                  <div>
                    <h3>
                      {preview.total} valid rows · {preview.errors.length}{" "}
                      errors
                    </h3>
                    {preview.errors.map((r) => (
                      <p key={r.row} className="error">
                        Row {r.row}: {r.message}
                      </p>
                    ))}
                    <ul>
                      {preview.transactions.slice(0, 5).map((t) => (
                        <li key={t.id}>
                          {t.date} · {t.merchant} · {gbp(t.amount)}
                        </li>
                      ))}
                    </ul>
                    <button
                      disabled={busy || !!preview.errors.length}
                      onClick={() =>
                        void run(async () => {
                          const result = await api({
                            action: "import",
                            csv: preview.csv,
                            accountId: preview.accountId,
                            balance: preview.balance,
                            commit: true,
                          });
                          await refresh();
                          setPreview(undefined);
                          setNotice(
                            `Imported ${result.inserted} entries; skipped ${result.skipped} duplicates.`,
                          );
                        })
                      }
                    >
                      Confirm import
                    </button>
                  </div>
                )}
              </section>
              <section>
                <h2>Starling</h2>
                <p>
                  A personal access token stays in your server environment. Only
                  account, balance and transaction reads are used.
                </p>
                <p className="status">
                  {data.starlingConfigured
                    ? "Token configured on server"
                    : "Add STARLING_PERSONAL_TOKEN to .env.local"}
                </p>
                <form
                  className="stack"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const f = fields(e.currentTarget);
                    void run(async () => {
                      const result = await api({
                        action: "sync",
                        from: f.from,
                        to: f.to,
                      });
                      await refresh();
                      setNotice(
                        `Starling synced: ${result.inserted} new entries, ${result.updated} refreshed.`,
                      );
                    });
                  }}
                >
                  <label>
                    From
                    <input name="from" type="date" required />
                  </label>
                  <label>
                    To
                    <input
                      name="to"
                      type="date"
                      defaultValue={data.today}
                      max={data.today}
                      required
                    />
                  </label>
                  <button
                    disabled={busy || data.demo || !data.starlingConfigured}
                  >
                    Sync read-only data
                  </button>
                </form>
                <p className="muted">
                  Manual sync · GBP current accounts only · no payment access.
                  Re-sync overlapping dates to reconcile pending entries.
                </p>
              </section>
            </div>
          </>
        )}
        {tab === "Local assistant" && (
          <section className="assistant">
            <h2>Ask about your finances</h2>
            <p>
              Your local model requests controlled tools. Calculations run in
              TypeScript and the evidence is shown below. Explanations can be
              wrong; use the structured results as the source of figures.
            </p>
            <form
              className="stack"
              onSubmit={(e) => {
                e.preventDefault();
                const f = fields(e.currentTarget);
                void run(async () => {
                  setAnswer(await api({ action: "ask", question: f.question }));
                });
              }}
            >
              <label>
                Your question
                <textarea
                  name="question"
                  rows={4}
                  required
                  maxLength={1500}
                  placeholder={`What is my spending by category this month? Or forecast 90 days from ${data.today} with a £500 reserve.`}
                />
              </label>
              <button disabled={busy}>Ask local assistant</button>
            </form>
            {answer && (
              <div className="answer">
                <p>{answer.answer}</p>
                <details open>
                  <summary>Calculation evidence (GBP pence)</summary>
                  <pre>{JSON.stringify(answer.evidence, null, 2)}</pre>
                </details>
              </div>
            )}
            <p className="muted">
              Requires a local tool-capable Ollama model. No bank token, account
              number or raw transaction descriptions are supplied to it.
              Questions themselves are sent to your local model.
            </p>
          </section>
        )}
        <footer>
          Private by design · GBP amounts · Forecasts depend on your plans and
          balance freshness
        </footer>
      </main>
    </div>
  );
}
function CashChart({ result }: { result: ForecastResult }) {
  const all = [...result.result.points, ...result.baseline.points].map(
    (p) => p.balance,
  );
  const low = Math.min(...all, 0),
    high = Math.max(...all, 1);
  const range = Math.max(1, high - low);
  function line(points: { balance: number }[]) {
    return points
      .map(
        (p, i) =>
          `${40 + (i / (points.length - 1)) * 720},${200 - ((p.balance - low) / range) * 165}`,
      )
      .join(" ");
  }
  return (
    <figure>
      <div className="cash-plot">
        <div className="cash-scale" aria-hidden="true">
          <span>{gbp(high)}</span>
          <span>{gbp(low)}</span>
        </div>
        <svg
          className="cash-svg"
          preserveAspectRatio="none"
          viewBox="0 0 800 240"
          role="img"
          aria-label={`90-day cash-flow chart. Scenario minimum ${gbp(result.result.minimum)}, closing ${gbp(result.result.closing)}. Baseline closing ${gbp(result.baseline.closing)}.`}
        >
          <line x1="40" x2="760" y1="200" y2="200" stroke="#c5c9c4" />
          <line
            x1="40"
            x2="760"
            y1={200 - ((0 - low) / range) * 165}
            y2={200 - ((0 - low) / range) * 165}
            stroke="#a36022"
            strokeDasharray="3 4"
            vectorEffect="non-scaling-stroke"
          />
          <polyline
            points={line(result.baseline.points)}
            fill="none"
            stroke="#939f9b"
            strokeWidth="2"
            strokeDasharray="6 5"
            vectorEffect="non-scaling-stroke"
          />
          <polyline
            points={line(result.result.points)}
            fill="none"
            stroke="#1f5946"
            strokeWidth="3"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      </div>
      <div className="cash-dates">
        <span>{result.result.points[0].date}</span>
        <span>{result.result.points.at(-1)!.date}</span>
      </div>
      <figcaption>
        Green solid: scenario · Grey dashed: current plans · Ochre horizontal
        guide: £0. Daily closing balances; minimum also includes within-day
        debits.
      </figcaption>
    </figure>
  );
}
