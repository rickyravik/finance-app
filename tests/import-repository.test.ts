import { it, expect } from "vitest";
import { importBos } from "../src/providers/bos";
import { Repository } from "../src/server/repository";
const account = {
  id: "bos:a",
  provider: "bos" as const,
  name: "Bank",
  currency: "GBP" as const,
  balance: 10000,
  available: 10000,
  asOf: "2026-10-01T00:00:00Z",
};
it("parses quoted descriptions, UK dates, credits and debits", () => {
  const r = importBos(
    'Transaction Date,Transaction Description,Debit Amount,Credit Amount\n01/10/2026,"Shop, local",12.34,\n02/10/2026,Refund,,2.10',
    "bos:a",
  );
  expect(r.errors).toEqual([]);
  expect(r.transactions.map((t) => t.amount)).toEqual([-1234, 210]);
});
it("reports bad rows without silently committing a partial file", () => {
  const r = importBos(
    "Date,Description,Amount\n2026-02-30,X,10\n2026-10-01,Y,1.234",
    "bos:a",
  );
  expect(r.errors).toHaveLength(2);
  expect(r.transactions).toHaveLength(0);
});
it("preserves identical legitimate rows and makes repeated imports idempotent", () => {
  const rows = importBos(
    "Date,Description,Amount\n2026-10-01,Shop,-10\n2026-10-01,Shop,-10",
    "bos:a",
  ).transactions;
  expect(rows[0].id).not.toBe(rows[1].id);
  const repo = new Repository(":memory:");
  expect(repo.import([account], rows).inserted).toBe(2);
  expect(repo.import([account], rows).skipped).toBe(2);
  expect(repo.transactions()).toHaveLength(2);
  repo.close();
});
it("keeps category corrections through provider updates and new rules", () => {
  const repo = new Repository(":memory:");
  const rows = importBos(
    "Date,Description,Amount\n2026-10-01,Shop,-10",
    "bos:a",
  ).transactions;
  repo.import([account], rows);
  repo.correct(rows[0].id, "Gifts", "lifestyle");
  repo.saveRule({
    id: "r",
    match: "Shop",
    category: "Groceries",
    role: "essential",
    priority: 10,
  });
  repo.import(
    [],
    rows.map((t) => ({ ...t, amount: -2000 })),
    true,
  );
  expect(repo.transactions()[0]).toMatchObject({
    category: "Gifts",
    corrected: true,
    amount: -2000,
  });
  repo.close();
});
it("rolls back accounts and all rows when an import fails", () => {
  const repo = new Repository(":memory:");
  const rows = importBos(
    "Date,Description,Amount\n2026-10-01,Shop,-10",
    "missing",
  ).transactions;
  expect(() => repo.import([account], rows)).toThrow();
  expect(repo.accounts()).toEqual([]);
  expect(repo.transactions()).toEqual([]);
  repo.close();
});
