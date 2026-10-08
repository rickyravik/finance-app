import { it, expect, vi } from "vitest";
import { StarlingAdapter } from "../src/providers/starling";
const uid = "00000000-0000-4000-8000-000000000001";
const item = "00000000-0000-4000-8000-000000000002";
it("uses only fixed-host GET reads and normalises signed settled/pending feed data", async () => {
  const mock = vi
    .fn()
    .mockResolvedValueOnce(
      Response.json({
        accounts: [{ accountUid: uid, defaultCategory: uid, currency: "GBP" }],
      }),
    )
    .mockResolvedValueOnce(
      Response.json({
        clearedBalance: { currency: "GBP", minorUnits: 12000 },
        effectiveBalance: { currency: "GBP", minorUnits: 11000 },
      }),
    )
    .mockResolvedValueOnce(
      Response.json({
        feedItems: [
          {
            feedItemUid: item,
            amount: { currency: "GBP", minorUnits: 1000 },
            direction: "OUT",
            transactionTime: "2026-10-01T10:00:00Z",
            status: "PENDING",
            counterPartyName: "Shop",
          },
        ],
      }),
    );
  const result = await new StarlingAdapter(
    "test-token",
    mock as typeof fetch,
  ).snapshot("2026-09-01", "2026-10-01");
  expect(result.transactions[0]).toMatchObject({
    amount: -1000,
    pending: true,
  });
  expect(result.accounts[0].available).toBe(11000);
  for (const [url, init] of mock.mock.calls) {
    expect(url).toMatch(/^https:\/\/api.starlingbank.com\/api\/v2\//);
    expect(init.method).toBe("GET");
    expect(init.redirect).toBe("error");
  }
});
it("never exposes failed provider response bodies or credentials", async () => {
  const mock = vi
    .fn()
    .mockResolvedValue(new Response("secret bank details", { status: 401 }));
  await expect(
    new StarlingAdapter("secret-token", mock as typeof fetch).snapshot(
      "2026-09-01",
      "2026-10-01",
    ),
  ).rejects.toThrow("Starling read failed (401)");
});
