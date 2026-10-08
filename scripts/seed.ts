import { Repository } from "../src/server/repository";
import { isoToday } from "../src/domain/model";
import { monthlyDate } from "../src/domain/engine";
const repo = new Repository(process.env.DATABASE_PATH || "./data/demo.sqlite");
if (repo.accounts().length) {
  repo.close();
  throw new Error("Seed only an empty demo database");
}
const today = isoToday();
repo.atomic(() => {
  repo.saveAccount({
    id: "demo:current",
    provider: "demo",
    name: "Everyday account · fictional",
    currency: "GBP",
    balance: 285000,
    available: 285000,
    asOf: new Date().toISOString(),
  });
  repo.db.prepare("INSERT INTO settings VALUES(?,?)").run("demo", "true");
  for (const [id, name, amount, day, category, role] of [
    ["salary", "Monthly salary", 420000, 28, "Salary", "income"],
    ["rent", "Current rent", -72000, 1, "Rent", "essential"],
    ["tax", "Council tax", -15000, 3, "Council tax", "essential"],
    ["energy", "Energy budget", -9000, 8, "Utilities", "essential"],
    ["family", "Family support", -22000, 5, "Family support", "essential"],
    ["debt", "Debt repayments", -48000, 12, "Debt repayment", "debt"],
    ["food", "Groceries budget", -28000, 2, "Groceries", "essential"],
    [
      "invest",
      "Investment contribution",
      -20000,
      15,
      "Investments",
      "investment",
    ],
    ["travel", "Travel fund", -10000, 18, "Savings", "saving"],
    [
      "other",
      "Transport and lifestyle budget",
      -45000,
      2,
      "Exceptional",
      "lifestyle",
    ],
  ] as const)
    repo.savePlan({ id, name, amount, day, category, role, start: today });
});
for (let month = -3; month <= 0; month++) {
  for (const [merchant, amount, day, category, role] of [
    ["Example Energy", -9000, 8, "Utilities", "essential"],
    ["Example Streaming", -1500, 10, "Subscriptions", "lifestyle"],
    ["Example Grocer", -6500, 4, "Groceries", "essential"],
    ["Example Payroll", 420000, 28, "Salary", "income"],
  ] as const) {
    const booked = monthlyDate(today, month, day);
    if (booked > today) continue;
    repo.import(
      [],
      [
        {
          id: `demo:${merchant}:${booked}`,
          accountId: "demo:current",
          date: booked,
          amount,
          merchant,
          category,
          role,
          pending: false,
          corrected: true,
        },
      ],
    );
  }
}
repo.close();
console.log(
  "Synthetic demo created in data/demo.sqlite. Run with DATABASE_PATH=./data/demo.sqlite.",
);
