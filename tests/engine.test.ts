import { describe, it, expect } from "vitest";
import {
  money,
  date,
  scenarioSchema,
  type Transaction,
  type Plan,
} from "../src/domain/model";
import {
  categorise,
  forecast,
  monthlyDate,
  recurring,
  spending,
} from "../src/domain/engine";
const tx = (changes: Partial<Transaction> = {}): Transaction => ({
  id: "t",
  accountId: "a",
  date: "2026-10-01",
  amount: -1000,
  merchant: "Grocer",
  category: "Groceries",
  role: "essential",
  pending: false,
  corrected: false,
  ...changes,
});
const plan = (changes: Partial<Plan> = {}): Plan => ({
  id: "p",
  name: "rent",
  amount: -10000,
  day: 31,
  category: "Rent",
  role: "essential",
  start: "2026-01-01",
  ...changes,
});
describe("exact money and dates", () => {
  it("parses signed pence without binary decimal arithmetic", () => {
    expect(money("£1,234.56")).toBe(123456);
    expect(money("-0.29")).toBe(-29);
    expect(() => money("1.005")).toThrow();
  });
  it("rejects overflow and impossible dates", () => {
    expect(() => money("9999999999999")).toThrow();
    expect(() => date.parse("2026-02-30")).toThrow();
  });
  it("clamps month ends including leap years", () => {
    expect(monthlyDate("2026-01-31", 1, 31)).toBe("2026-02-28");
    expect(monthlyDate("2028-01-31", 1, 31)).toBe("2028-02-29");
  });
});
describe("categorisation and spending", () => {
  it("gives corrections precedence over rules", () => {
    expect(
      categorise(tx({ corrected: true }), [
        {
          id: "r",
          match: "grocer",
          category: "Dining",
          role: "lifestyle",
          priority: 99,
        },
      ]).category,
    ).toBe("Groceries");
  });
  it("uses ordered case-insensitive rules", () => {
    expect(
      categorise(tx(), [
        {
          id: "a",
          match: "GROCER",
          category: "Dining",
          role: "lifestyle",
          priority: 1,
        },
        {
          id: "b",
          match: "grocer",
          category: "Groceries",
          role: "essential",
          priority: 2,
        },
      ]).category,
    ).toBe("Groceries");
  });
  it("nets refunds and excludes transfers, salary and pending", () => {
    expect(
      spending(
        [
          tx(),
          tx({ amount: 200 }),
          tx({ role: "transfer" }),
          tx({ pending: true }),
          tx({ role: "income", amount: 50000 }),
        ],
        "2026-10-01",
        "2026-10-31",
      ),
    ).toEqual({ Groceries: 800 });
  });
});
describe("recurring candidates", () => {
  it("requires three observations and keeps accounts separate", () => {
    const ts = ["2026-07-31", "2026-08-31", "2026-09-30"].map((date) =>
      tx({ date }),
    );
    expect(recurring(ts, "2026-10-01")[0].next).toBe("2026-10-30");
    expect(recurring(ts.slice(0, 2), "2026-10-01")).toEqual([]);
    expect(
      recurring(
        ts.map((t, i) => ({ ...t, accountId: String(i) })),
        "2026-10-01",
      ),
    ).toEqual([]);
  });
  it("rejects irregular cadence, opposite directions, amount spikes and pending", () => {
    expect(
      recurring(
        [
          tx({ date: "2026-07-01" }),
          tx({ date: "2026-08-01" }),
          tx({ date: "2026-09-01", amount: -10000 }),
        ],
        "2026-10-01",
      ),
    ).toEqual([]);
    expect(
      recurring(
        [
          tx({ date: "2026-07-01" }),
          tx({ date: "2026-08-01" }),
          tx({ date: "2026-09-01", pending: true }),
        ],
        "2026-10-01",
      ),
    ).toEqual([]);
  });
});
describe("cash-flow scenarios", () => {
  it("rejects one-off costs outside the forecast rather than silently omitting them", () => {
    expect(() =>
      scenarioSchema.parse({
        from: "2026-10-01",
        days: 30,
        reserve: 0,
        purchase: { amount: 1000, date: "2026-09-30" },
      }),
    ).toThrow();
    expect(() =>
      scenarioSchema.parse({
        from: "2026-10-01",
        days: 30,
        reserve: 0,
        purchase: { amount: 1000, date: "2026-10-31" },
      }),
    ).toThrow();
  });
  it("uses month-end plans and honours start/end dates", () => {
    const r = forecast(50000, [plan({ end: "2026-02-28" })], {
      from: "2026-02-01",
      days: 60,
      reserve: 10000,
    });
    expect(r.closing).toBe(40000);
    expect(r.events).toHaveLength(1);
  });
  it("replaces housing rather than double-counting and includes one-off costs", () => {
    const r = forecast(50000, [plan({ day: 1 })], {
      from: "2026-10-01",
      days: 31,
      reserve: 10000,
      housing: {
        rent: 20000,
        councilTax: 2000,
        utilities: 3000,
        start: "2026-10-01",
      },
      purchase: { amount: 10000, date: "2026-10-02" },
    });
    expect(r.closing).toBe(15000);
    expect(r.safeToSpend).toBe(5000);
  });
  it("includes within-day low points even when salary arrives that day", () => {
    const r = forecast(
      5000,
      [
        plan({ day: 1 }),
        plan({
          id: "income",
          amount: 40000,
          day: 1,
          category: "Salary",
          role: "income",
        }),
      ],
      { from: "2026-10-01", days: 1, reserve: 0 },
    );
    expect(r.closing).toBe(35000);
    expect(r.minimum).toBe(-5000);
    expect(r.safeToSpend).toBe(0);
  });
  it("never returns negative safe-to-spend", () => {
    expect(
      forecast(-100, [], { from: "2026-10-01", days: 1, reserve: 1000 })
        .safeToSpend,
    ).toBe(0);
  });
});
