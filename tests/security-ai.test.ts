import { it, expect, vi, afterEach } from "vitest";
import { authorised } from "../src/server/security";
import { Repository } from "../src/server/repository";
import { executeTool } from "../src/server/tools";
import { askLocalAI } from "../src/server/ollama";
afterEach(() => vi.unstubAllEnvs());
it("requires the local secret, local host and same-origin requests", () => {
  vi.stubEnv("APP_ACCESS_KEY", "secret");
  const req = (url: string, headers: Record<string, string>) =>
    new Request(url, { method: "POST", headers });
  expect(
    authorised(
      req("http://127.0.0.1:3000/api/control", { "x-app-key": "secret" }),
    ),
  ).toBe(true);
  expect(
    authorised(
      req("http://localhost:3000/api/control", {
        host: "127.0.0.1:3000",
        origin: "http://127.0.0.1:3000",
        "x-app-key": "secret",
      }),
    ),
  ).toBe(true);
  expect(
    authorised(
      req("http://127.0.0.1:3000/api/control", { "x-app-key": "wrong" }),
    ),
  ).toBe(false);
  expect(
    authorised(
      req("http://127.0.0.1:3000/api/control", {
        "x-app-key": "secret",
        origin: "https://evil.test",
      }),
    ),
  ).toBe(false);
  expect(
    authorised(req("http://evil.test/api/control", { "x-app-key": "secret" })),
  ).toBe(false);
  vi.stubEnv("APP_ACCESS_KEY", "");
  expect(authorised(req("http://localhost/api/control", {}))).toBe(false);
});
it("rejects SQL and unvalidated tool arguments", () => {
  const repo = new Repository(":memory:");
  expect(() => executeTool(repo, "sql", { query: "select *" })).toThrow(
    "Unknown tool",
  );
  expect(() => executeTool(repo, "balances", { sql: "anything" })).toThrow();
  expect(() =>
    executeTool(repo, "forecast", {
      from: "2026-10-01",
      days: 999,
      reserve: 0,
    }),
  ).toThrow();
  repo.close();
});
it("runs tool calls and returns deterministic evidence", async () => {
  vi.stubEnv("OLLAMA_MODEL", "qwen3:8b");
  const repo = new Repository(":memory:");
  const mock = vi
    .fn()
    .mockResolvedValueOnce(
      Response.json({
        message: {
          role: "assistant",
          content: "",
          tool_calls: [{ function: { name: "balances", arguments: {} } }],
        },
      }),
    )
    .mockResolvedValueOnce(
      Response.json({
        message: { role: "assistant", content: "No accounts are connected." },
      }),
    );
  const r = await askLocalAI(repo, "What is my balance?", mock as typeof fetch);
  expect(r.evidence[0]).toMatchObject({
    tool: "balances",
    result: { balance: 0 },
  });
  expect(mock.mock.calls[0][0]).toBe("http://127.0.0.1:11434/api/chat");
  expect(JSON.stringify(mock.mock.calls)).not.toContain("Authorization");
  repo.close();
});
it("refuses cloud model names and blocks arbitrary tools", async () => {
  const repo = new Repository(":memory:");
  vi.stubEnv("OLLAMA_MODEL", "model:cloud");
  await expect(askLocalAI(repo, "hi")).rejects.toThrow("locally installed");
  vi.stubEnv("OLLAMA_MODEL", "local");
  const mock = vi
    .fn()
    .mockResolvedValue(
      Response.json({
        message: {
          role: "assistant",
          content: "",
          tool_calls: [{ function: { name: "executeSQL", arguments: {} } }],
        },
      }),
    );
  await expect(askLocalAI(repo, "hi", mock as typeof fetch)).rejects.toThrow(
    "Unknown tool",
  );
  repo.close();
});
