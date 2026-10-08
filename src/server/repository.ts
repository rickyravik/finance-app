import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { categorise } from "../domain/engine";
import type { Account, Plan, Rule, Transaction } from "../domain/model";
export class Repository {
  readonly db: DatabaseSync;
  constructor(path: string) {
    if (path !== ":memory:")
      mkdirSync(dirname(resolve(path)), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec(`PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL;
      CREATE TABLE IF NOT EXISTS schema_version(version INTEGER PRIMARY KEY);
      INSERT OR IGNORE INTO schema_version VALUES(1);
      CREATE TABLE IF NOT EXISTS accounts(id TEXT PRIMARY KEY, body TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS transactions(id TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES accounts(id), body TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS rules(id TEXT PRIMARY KEY, body TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS plans(id TEXT PRIMARY KEY, body TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS scenarios(id TEXT PRIMARY KEY, body TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS audit(id TEXT PRIMARY KEY, at TEXT NOT NULL, action TEXT NOT NULL, count INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY, value TEXT NOT NULL);`);
  }
  private read<T>(table: string): T[] {
    return (
      this.db.prepare(`SELECT body FROM ${table}`).all() as { body: string }[]
    ).map((r) => JSON.parse(r.body));
  }
  accounts() {
    return this.read<Account>("accounts");
  }
  transactions() {
    return this.read<Transaction>("transactions").sort((a, b) =>
      b.date.localeCompare(a.date),
    );
  }
  rules() {
    return this.read<Rule>("rules");
  }
  plans() {
    return this.read<Plan>("plans");
  }
  demo() {
    return (
      this.db.prepare("SELECT value FROM settings WHERE key='demo'").get()
        ?.value === "true"
    );
  }
  audit(action: string, count: number) {
    this.db
      .prepare("INSERT INTO audit VALUES(?,?,?,?)")
      .run(randomUUID(), new Date().toISOString(), action, count);
  }
  atomic<T>(fn: () => T): T {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const result = fn();
      this.db.exec("COMMIT");
      return result;
    } catch (e) {
      this.db.exec("ROLLBACK");
      throw e;
    }
  }
  saveAccount(a: Account) {
    this.db
      .prepare(
        "INSERT INTO accounts VALUES(?,?) ON CONFLICT(id) DO UPDATE SET body=excluded.body",
      )
      .run(a.id, JSON.stringify(a));
  }
  savePlan(p: Plan) {
    this.db
      .prepare(
        "INSERT INTO plans VALUES(?,?) ON CONFLICT(id) DO UPDATE SET body=excluded.body",
      )
      .run(p.id, JSON.stringify(p));
  }
  import(accounts: Account[], transactions: Transaction[], update = false) {
    return this.atomic(() => {
      for (const a of accounts) this.saveAccount(a);
      let inserted = 0;
      let updated = 0;
      const rules = this.rules();
      for (const t of transactions) {
        const existing = this.db
          .prepare("SELECT body FROM transactions WHERE id=?")
          .get(t.id) as { body: string } | undefined;
        if (existing && !update) continue;
        const old = existing
          ? (JSON.parse(existing.body) as Transaction)
          : undefined;
        const item = old?.corrected
          ? { ...t, category: old.category, role: old.role, corrected: true }
          : categorise(t, rules);
        this.db
          .prepare(
            "INSERT INTO transactions VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET body=excluded.body",
          )
          .run(t.id, t.accountId, JSON.stringify(item));
        if (existing) updated++;
        else inserted++;
      }
      this.audit(update ? "provider-sync" : "csv-import", inserted + updated);
      return {
        inserted,
        updated,
        skipped: transactions.length - inserted - updated,
      };
    });
  }
  correct(
    id: string,
    category: Transaction["category"],
    role: Transaction["role"],
  ) {
    const existing = this.transactions().find((t) => t.id === id);
    if (!existing) throw new Error("Transaction not found");
    this.atomic(() => {
      this.db
        .prepare("UPDATE transactions SET body=? WHERE id=?")
        .run(
          JSON.stringify({ ...existing, category, role, corrected: true }),
          id,
        );
      this.audit("category-correction", 1);
    });
  }
  saveRule(r: Rule) {
    this.atomic(() => {
      this.db
        .prepare(
          "INSERT INTO rules VALUES(?,?) ON CONFLICT(id) DO UPDATE SET body=excluded.body",
        )
        .run(r.id, JSON.stringify(r));
      const rules = this.rules();
      for (const t of this.transactions())
        this.db
          .prepare("UPDATE transactions SET body=? WHERE id=?")
          .run(JSON.stringify(categorise(t, rules)), t.id);
      this.audit("rule-update", 1);
    });
  }
  saveScenario(input: unknown) {
    const id = randomUUID();
    this.db
      .prepare("INSERT INTO scenarios VALUES(?,?)")
      .run(id, JSON.stringify(input));
    this.audit("scenario-saved", 1);
    return id;
  }
  close() {
    this.db.close();
  }
}
let instance: Repository | undefined;
export function repository() {
  return (instance ??= new Repository(
    process.env.DATABASE_PATH || "./data/finance.sqlite",
  ));
}
