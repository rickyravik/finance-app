import {
  addDays,
  type Plan,
  type Rule,
  type Scenario,
  type Transaction,
} from "./model";
export function categorise(t: Transaction, rules: Rule[]): Transaction {
  if (t.corrected) return t;
  const rule = [...rules]
    .sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id))
    .find((r) => t.merchant.toLowerCase().includes(r.match.toLowerCase()));
  return rule
    ? { ...t, category: rule.category, role: rule.role }
    : {
        ...t,
        category: "Uncategorised",
        role: t.amount > 0 ? "income" : "lifestyle",
      };
}
export function spending(
  transactions: Transaction[],
  from: string,
  to: string,
) {
  const totals: Record<string, number> = {};
  for (const t of transactions)
    if (
      !t.pending &&
      t.date >= from &&
      t.date <= to &&
      t.role !== "transfer" &&
      t.role !== "income"
    )
      totals[t.category] = (totals[t.category] ?? 0) - t.amount;
  return totals;
}
export function recurring(transactions: Transaction[], asOf: string) {
  const groups = new Map<string, Transaction[]>();
  for (const t of transactions.filter(
    (t) => !t.pending && t.role !== "transfer" && t.date <= asOf,
  )) {
    const key = `${t.accountId}:${t.merchant.trim().toLowerCase()}:${Math.sign(t.amount)}`;
    groups.set(key, [...(groups.get(key) ?? []), t]);
  }
  return [...groups.values()].flatMap((items) => {
    items.sort((a, b) => a.date.localeCompare(b.date));
    if (items.length < 3) return [];
    const gaps = items
      .slice(1)
      .map(
        (t, i) => (Date.parse(t.date) - Date.parse(items[i].date)) / 86400000,
      );
    const weekly = gaps.every((g) => g >= 6 && g <= 8);
    const monthly = gaps.every((g) => g >= 26 && g <= 35);
    if (!weekly && !monthly) return [];
    const last = items.at(-1)!;
    const average = Math.round(
      items.reduce((s, t) => s + t.amount, 0) / items.length,
    );
    const spread = Math.max(...items.map((t) => Math.abs(t.amount - average)));
    if (spread > Math.max(100, Math.abs(average) * 0.25)) return [];
    const cadence = weekly ? "weekly" : "monthly";
    const next = weekly
      ? addDays(last.date, 7)
      : monthlyDate(last.date, 1, Number(last.date.slice(8)));
    return [
      {
        merchant: last.merchant,
        accountId: last.accountId,
        amount: average,
        category: last.category,
        role: last.role,
        cadence,
        next,
        stale: next < asOf,
        observations: items.length,
        confidence: spread === 0 ? "consistent" : "variable",
        lastDate: last.date,
      },
    ];
  });
}
export function monthlyDate(from: string, months: number, day: number) {
  const d = new Date(from);
  const y = d.getUTCFullYear(),
    m = d.getUTCMonth() + months;
  const max = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m, Math.min(day, max)))
    .toISOString()
    .slice(0, 10);
}
export function forecast(opening: number, plans: Plan[], input: Scenario) {
  let balance = opening;
  let minimum = opening;
  const points = [];
  const events: { date: string; name: string; amount: number }[] = [];
  const housingCategories = new Set(["Rent", "Council tax", "Utilities"]);
  for (let n = 0; n < input.days; n++) {
    const day = addDays(input.from, n);
    const scenarioActive = !!input.housing && day >= input.housing.start;
    for (const plan of plans) {
      if (
        day < plan.start ||
        (plan.end && day > plan.end) ||
        (scenarioActive && housingCategories.has(plan.category))
      )
        continue;
      if (monthlyDate(day, 0, plan.day) === day)
        events.push({ date: day, name: plan.name, amount: plan.amount });
    }
    if (
      scenarioActive &&
      monthlyDate(day, 0, Number(input.housing!.start.slice(8))) === day
    )
      events.push({
        date: day,
        name: "Scenario housing",
        amount: -(
          input.housing!.rent +
          input.housing!.councilTax +
          input.housing!.utilities
        ),
      });
    if (input.purchase?.date === day)
      events.push({
        date: day,
        name: "One-off scenario",
        amount: -input.purchase.amount,
      });
    // Conservative within-day order: debits precede credits.
    for (const e of events
      .filter((e) => e.date === day)
      .sort((a, b) => a.amount - b.amount)) {
      balance += e.amount;
      minimum = Math.min(minimum, balance);
    }
    points.push({ date: day, balance });
  }
  return {
    opening,
    closing: balance,
    minimum,
    safeToSpend: Math.max(0, minimum - input.reserve),
    reserve: input.reserve,
    points,
    events,
    assumptions:
      "Daily GBP cash forecast from explicit monthly plans; debits first. Variable spending must be budgeted in plans. No statistical confidence interval.",
  };
}
