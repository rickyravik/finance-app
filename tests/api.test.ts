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
