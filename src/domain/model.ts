import { z } from "zod";
export const categories = [
  "Uncategorised",
  "Salary",
  "Photography income",
  "Rent",
  "Council tax",
  "Utilities",
  "Groceries",
  "Transport",
  "Family support",
  "Child maintenance",
  "Debt repayment",
  "Insurance",
  "Subscriptions",
  "Investments",
  "Savings",
  "Travel",
  "Gifts",
  "Dining",
  "Transfers",
  "Exceptional",
] as const;
export const roles = [
  "income",
  "essential",
  "lifestyle",
  "debt",
  "saving",
  "investment",
  "transfer",
  "exceptional",
] as const;
export type Category = (typeof categories)[number];
export type Role = (typeof roles)[number];
export const pence = z
  .number()
  .int()
  .safe()
  .min(-1_000_000_000)
  .max(1_000_000_000);
export const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (s) =>
      !Number.isNaN(Date.parse(s)) &&
      new Date(s).toISOString().slice(0, 10) === s,
    "Invalid calendar date",
  );
export const transactionSchema = z.object({
  id: z.string().min(1),
  accountId: z.string().min(1),
  date,
  amount: pence,
  merchant: z.string().min(1).max(300),
  category: z.enum(categories),
  role: z.enum(roles),
  pending: z.boolean(),
  corrected: z.boolean(),
});
export type Transaction = z.infer<typeof transactionSchema>;
export interface Account {
  id: string;
  provider: "starling" | "bos" | "demo";
  name: string;
  currency: "GBP";
  balance: number;
  available: number;
  asOf: string;
}
export interface Rule {
  id: string;
  match: string;
  category: Category;
  role: Role;
  priority: number;
}
export interface AuditEntry {
  id: string;
  at: string;
  action: string;
  count: number;
}
export const planSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1).max(100),
    amount: pence,
    day: z.number().int().min(1).max(31),
    category: z.enum(categories),
    role: z.enum(roles),
    start: date,
    end: date.optional(),
  })
  .refine((p) => !p.end || p.end >= p.start, "End precedes start");
export type Plan = z.infer<typeof planSchema>;
export const scenarioSchema = z
  .object({
    from: date,
    days: z.number().int().min(1).max(366),
    reserve: pence.nonnegative(),
    housing: z
      .object({
        rent: pence.nonnegative(),
        councilTax: pence.nonnegative(),
        utilities: pence.nonnegative(),
        start: date,
      })
      .strict()
      .optional(),
    purchase: z
      .object({ amount: pence.nonnegative(), date })
      .strict()
      .optional(),
  })
  .strict()
  .refine(
    (v) =>
      !v.purchase ||
      (v.purchase.date >= v.from && v.purchase.date < addDays(v.from, v.days)),
    "One-off cost must be inside the forecast window",
  );
export type Scenario = z.infer<typeof scenarioSchema>;
export function money(value: string): number {
  const v = value.trim().replace(/£/g, "").replace(/,/g, "");
  if (!/^-?\d+(\.\d{1,2})?$/.test(v))
    throw new Error("Amount must have at most two decimal places");
  const negative = v.startsWith("-");
  const [whole, decimal = ""] = v.replace("-", "").split(".");
  return pence.parse(
    (Number(whole) * 100 + Number(decimal.padEnd(2, "0"))) *
      (negative ? -1 : 1),
  );
}
export const isoToday = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
export const addDays = (s: string, n: number) =>
  new Date(Date.parse(s) + n * 86400000).toISOString().slice(0, 10);
