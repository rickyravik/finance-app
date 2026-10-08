import { z } from "zod";
import { date, scenarioSchema } from "../domain/model";
import { forecast, recurring, spending } from "../domain/engine";
import type { Repository } from "./repository";
const schemas = {
  balances: z.object({}).strict(),
  spending: z
    .object({ from: date, to: date })
    .strict()
    .refine((v) => v.from <= v.to, "Invalid interval"),
  recurring: z.object({ asOf: date }).strict(),
  forecast: scenarioSchema,
};
export const toolDefinitions = [
  {
    name: "balances",
    description: "Read current GBP account balance totals and freshness.",
    parameters: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "spending",
    description:
      "Read signed net spending by category, excluding internal transfers and pending entries.",
    parameters: {
      type: "object",
      properties: {
        from: { type: "string", description: "YYYY-MM-DD" },
        to: { type: "string", description: "YYYY-MM-DD" },
      },
      required: ["from", "to"],
      additionalProperties: false,
    },
  },
  {
    name: "recurring",
    description:
      "Read candidate recurring payments for review; never guaranteed bills.",
    parameters: {
      type: "object",
      properties: { asOf: { type: "string", description: "YYYY-MM-DD" } },
      required: ["asOf"],
      additionalProperties: false,
    },
  },
  {
    name: "forecast",
    description:
      "Calculate daily cash flow and safe-to-spend from saved monthly plans, optionally comparing housing or a purchase. Amounts are integer GBP pence. Opening cash is the current available balance; use today's start date.",
    parameters: {
      type: "object",
      properties: {
        from: { type: "string" },
        days: { type: "integer", minimum: 1, maximum: 366 },
        reserve: { type: "integer", minimum: 0 },
        housing: {
          type: "object",
          properties: {
            rent: { type: "integer", minimum: 0 },
            councilTax: { type: "integer", minimum: 0 },
            utilities: { type: "integer", minimum: 0 },
            start: { type: "string", description: "YYYY-MM-DD" },
          },
          required: ["rent", "councilTax", "utilities", "start"],
          additionalProperties: false,
        },
        purchase: {
          type: "object",
          properties: {
            amount: { type: "integer", minimum: 0 },
            date: { type: "string", description: "YYYY-MM-DD" },
          },
          required: ["amount", "date"],
          additionalProperties: false,
        },
      },
      required: ["from", "days", "reserve"],
      additionalProperties: false,
    },
  },
].map((fn) => ({ type: "function", function: fn }));
export function executeTool(
  repo: Repository,
  name: string,
  args: unknown,
): unknown {
  if (!Object.hasOwn(schemas, name)) throw new Error("Unknown tool");
  const parsed = schemas[name as keyof typeof schemas].parse(args);
  switch (name) {
    case "balances":
      return {
        currency: "GBP",
        balance: repo.accounts().reduce((s, a) => s + a.balance, 0),
        available: repo.accounts().reduce((s, a) => s + a.available, 0),
        freshness: repo
          .accounts()
          .map((a) => ({ provider: a.provider, asOf: a.asOf })),
        demo: repo.demo(),
      };
    case "spending": {
      const v = parsed as { from: string; to: string };
      return spending(repo.transactions(), v.from, v.to);
    }
    case "recurring":
      return recurring(
        repo.transactions(),
        (parsed as { asOf: string }).asOf,
      ).map(({ merchant, accountId, ...rest }) => ({
        ...rest,
        merchant: "Redacted recurring merchant",
      }));
    case "forecast":
      return forecast(
        repo.accounts().reduce((s, a) => s + a.available, 0),
        repo.plans(),
        scenarioSchema.parse(parsed),
      );
  }
}
