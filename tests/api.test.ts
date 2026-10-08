import { it, expect, vi, beforeAll, afterAll } from "vitest";
vi.mock("server-only", () => ({}));
import { POST } from "../src/app/api/control/route";
import { repository } from "../src/server/repository";
beforeAll(() => {
  vi.stubEnv("APP_ACCESS_KEY", "test-local-key");
  vi.stubEnv("DATABASE_PATH", ":memory:");
});
afterAll(() => {
  repository().close();
  vi.unstubAllEnvs();
});
const send = (body: unknown, key = "test-local-key") =>
  POST(
    new Request("http://127.0.0.1:3000/api/control", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-app-key": key },
      body: JSON.stringify(body),
    }),
  );
it("protects the live API before loading any ledger", async () => {
  expect((await send({ action: "overview" }, "wrong")).status).toBe(403);
});
it("previews CSV without writing and atomically confirms it", async () => {
  const input = {
    action: "import",
    accountId: "test",
    csv: "Date,Description,Amount\n2026-10-01,Shop,-10",
    balance: 10000,
    commit: false,
  };
  expect((await send(input)).status).toBe(200);
  expect(repository().transactions()).toHaveLength(0);
  expect(await (await send({ ...input, commit: true })).json()).toMatchObject({
    inserted: 1,
  });
  expect(await (await send({ ...input, commit: true })).json()).toMatchObject({
    inserted: 0,
    skipped: 1,
  });
});
it("rejects a partially invalid import without committing valid rows", async () => {
  const before = repository().transactions().length;
  const response = await send({
    action: "import",
    accountId: "test",
    csv: "Date,Description,Amount\n2026-10-02,Valid,-10\n2026-02-30,Invalid,-5",
    balance: 10000,
    commit: true,
  });
  expect(response.status).toBe(400);
  expect(repository().transactions()).toHaveLength(before);
});
it("creates plans and calculates baseline and replacement scenarios", async () => {
  await send({
    action: "plan",
    plan: {
      id: "rent",
      name: "Rent",
      amount: -1000,
      day: 1,
      category: "Rent",
      role: "essential",
      start: "2026-10-01",
    },
  });
  const response = await send({
    action: "scenario",
    input: {
      from: "2026-10-01",
      days: 2,
      reserve: 0,
      housing: { rent: 2000, councilTax: 0, utilities: 0, start: "2026-10-01" },
    },
  });
  const r = await response.json();
  expect(r.baseline.closing).toBe(9000);
  expect(r.result.closing).toBe(8000);
  expect(r.delta).toBe(-1000);
});
it("returns controlled errors for invalid payloads", async () => {
  expect(
    (
      await send({
        action: "scenario",
        input: { from: "2026-02-30", days: 90, reserve: 0 },
      })
    ).status,
  ).toBe(400);
});
it("returns reserve policy and audit log in overview", async () => {
  const response = await send({ action: "overview" });
  expect(response.status).toBe(200);
  const data = await response.json();
  expect(typeof data.reservePolicy).toBe("number");
  expect(Array.isArray(data.audit)).toBe(true);
  expect(data.audit.length).toBeGreaterThan(0);
});
it("deletes rules, adjusts accounts, and updates reserve policy via API", async () => {
  await send({
    action: "rule",
    match: "TestRule",
    category: "Groceries",
    role: "essential",
    priority: 5,
  });
  const rule = repository().rules().find((r) => r.match === "TestRule")!;
  expect(rule).toBeDefined();

  const delRes = await send({ action: "deleteRule", id: rule.id });
  expect(delRes.status).toBe(200);
  expect(repository().rules().find((r) => r.id === rule.id)).toBeUndefined();

  const adjRes = await send({
    action: "adjustAccount",
    id: "bos:test",
    balance: 55000,
  });
  expect(adjRes.status).toBe(200);
  expect(repository().accounts().find((a) => a.id === "bos:test")?.balance).toBe(
    55000,
  );

  const polRes = await send({
    action: "setReservePolicy",
    reserve: 80000,
  });
  expect(polRes.status).toBe(200);
  expect(repository().reservePolicy()).toBe(80000);
});
it("creates, retrieves, and deletes goals and assets/liabilities via API", async () => {
  const goalRes = await send({
    action: "goal",
    goal: {
      id: "goal-api",
      name: "Emergency Fund",
      targetAmount: 500000,
      currentAmount: 200000,
      targetDate: "2027-12-01",
      category: "Savings",
    },
  });
  expect(goalRes.status).toBe(200);

  const alRes = await send({
    action: "assetLiability",
    item: {
      id: "al-api",
      name: "Mortgage",
      type: "liability",
      amount: 15000000,
      category: "Mortgage",
      asOf: "2026-10-01",
    },
  });
  expect(alRes.status).toBe(200);

  const overviewRes = await send({ action: "overview" });
  const overviewData = await overviewRes.json();
  expect(overviewData.goals.some((g: { id: string }) => g.id === "goal-api")).toBe(true);
  expect(overviewData.assetsLiabilities.some((al: { id: string }) => al.id === "al-api")).toBe(true);
  expect(typeof overviewData.netWorth).toBe("object");

  const delGoal = await send({ action: "deleteGoal", id: "goal-api" });
  expect(delGoal.status).toBe(200);
  const delAl = await send({ action: "deleteAssetLiability", id: "al-api" });
  expect(delAl.status).toBe(200);
});
it("exports and restores encrypted backups via API", async () => {
  const exportRes = await send({
    action: "exportBackup",
    passphrase: "password1234",
  });
  expect(exportRes.status).toBe(200);
  const { encrypted } = await exportRes.json();
  expect(typeof encrypted).toBe("string");

  const restoreRes = await send({
    action: "restoreBackup",
    encrypted,
    passphrase: "password1234",
  });
  expect(restoreRes.status).toBe(200);

  const badRestoreRes = await send({
    action: "restoreBackup",
    encrypted,
    passphrase: "wrong-password-999",
  });
  expect(badRestoreRes.status).toBe(400);
});
