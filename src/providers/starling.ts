import { z } from "zod";
import { date, pence, transactionSchema } from "../domain/model";
import type { BankAdapter, BankSnapshot } from "./adapter";
const amount = z.object({ currency: z.literal("GBP"), minorUnits: pence });
const accountsSchema = z.object({
  accounts: z.array(
    z.object({
      accountUid: z.uuid(),
      defaultCategory: z.uuid(),
      currency: z.literal("GBP"),
      name: z.string().optional(),
    }),
  ),
});
const balanceSchema = z.object({
  clearedBalance: amount,
  effectiveBalance: amount,
});
const feedSchema = z.object({
  feedItems: z.array(
    z.object({
      feedItemUid: z.uuid(),
      amount,
      direction: z.enum(["IN", "OUT"]),
      transactionTime: z.iso.datetime({ offset: true }),
      status: z.string(),
      counterPartyName: z.string().optional(),
      reference: z.string().optional(),
    }),
  ),
});
export class StarlingAdapter implements BankAdapter {
  readonly provider = "starling";
  constructor(
    private token: string,
    private request: typeof fetch = fetch,
  ) {
    if (!token.trim()) throw new Error("Starling token is not configured");
  }
  private async get(path: string) {
    const response = await this.request(
      "https://api.starlingbank.com/api/v2" + path,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${this.token}`,
          Accept: "application/json",
          "User-Agent": "LocalFinanceCentre/0.1",
        },
        cache: "no-store",
        signal: AbortSignal.timeout(20000),
        redirect: "error",
      },
    );
    if (!response.ok)
      throw new Error(
        `Starling read failed (${response.status}); check token permissions or retry later`,
      );
    return response.json();
  }
  async snapshot(from: string, to: string): Promise<BankSnapshot> {
    date.parse(from);
    date.parse(to);
    if (from > to) throw new Error("Invalid sync interval");
    const source = accountsSchema.parse(await this.get("/accounts"));
    const accounts: BankSnapshot["accounts"] = [],
      transactions: BankSnapshot["transactions"] = [];
    for (const a of source.accounts) {
      const b = balanceSchema.parse(
        await this.get(`/accounts/${a.accountUid}/balance`),
      );
      const feed = feedSchema.parse(
        await this.get(
          `/feed/account/${a.accountUid}/category/${a.defaultCategory}/transactions-between?minTransactionTimestamp=${encodeURIComponent(from + "T00:00:00Z")}&maxTransactionTimestamp=${encodeURIComponent(to + "T23:59:59.999Z")}`,
        ),
      );
      const id = "starling:" + a.accountUid;
      accounts.push({
        id,
        provider: "starling",
        name: a.name ?? "Starling current account",
        currency: "GBP",
        balance: b.clearedBalance.minorUnits,
        available: b.effectiveBalance.minorUnits,
        asOf: new Date().toISOString(),
      });
      for (const t of feed.feedItems) {
        if (!["SETTLED", "PENDING"].includes(t.status)) continue;
        if (t.amount.minorUnits < 0)
          throw new Error("Unexpected negative provider amount");
        transactions.push(
          transactionSchema.parse({
            id: `starling:${a.accountUid}:${t.feedItemUid}`,
            accountId: id,
            date: t.transactionTime.slice(0, 10),
            amount: t.amount.minorUnits * (t.direction === "OUT" ? -1 : 1),
            merchant: t.counterPartyName || t.reference || "Unknown merchant",
            category: "Uncategorised",
            role: t.direction === "IN" ? "income" : "lifestyle",
            pending: t.status !== "SETTLED",
            corrected: false,
          }),
        );
      }
    }
    return { accounts, transactions };
  }
}
