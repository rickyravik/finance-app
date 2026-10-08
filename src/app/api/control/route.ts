import "server-only";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { repository } from "@/server/repository";
import { authorised } from "@/server/security";
import {
  categories,
  roles,
  date,
  isoToday,
  pence,
  planSchema,
  scenarioSchema,
} from "@/domain/model";
import { forecast, recurring } from "@/domain/engine";
import { importBos } from "@/providers/bos";
import { StarlingAdapter } from "@/providers/starling";
import { askLocalAI } from "@/server/ollama";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const command = z.discriminatedUnion("action", [
  z.object({ action: z.literal("overview") }),
  z.object({
    action: z.literal("import"),
    csv: z.string().max(2_000_000),
    accountId: z.string().min(1).max(100),
    commit: z.boolean(),
    balance: pence.optional(),
  }),
  z.object({
    action: z.literal("correct"),
    id: z.string(),
    category: z.enum(categories),
    role: z.enum(roles),
  }),
  z.object({
    action: z.literal("rule"),
    match: z.string().trim().min(2).max(100),
    category: z.enum(categories),
    role: z.enum(roles),
    priority: z.number().int().min(0).max(1000),
  }),
  z.object({ action: z.literal("plan"), plan: planSchema }),
  z.object({ action: z.literal("deletePlan"), id: z.string() }),
  z.object({
    action: z.literal("scenario"),
    input: scenarioSchema,
    save: z.boolean().optional(),
  }),
  z.object({ action: z.literal("sync"), from: date, to: date }),
  z.object({
    action: z.literal("ask"),
    question: z.string().trim().min(1).max(1500),
  }),
]);
let busy = false;
export async function POST(request: Request) {
  if (!authorised(request))
    return Response.json(
      {
        error:
          "Access denied. Use the local address and configured access key.",
      },
      { status: 403 },
    );
  if (busy)
    return Response.json(
      { error: "A request is already running; retry shortly." },
      { status: 429 },
    );
  busy = true;
  try {
    const raw = await request.text();
    if (Buffer.byteLength(raw) > 2_100_000)
      return Response.json({ error: "Request too large" }, { status: 413 });
    const cmd = command.parse(JSON.parse(raw));
    const repo = repository();
    switch (cmd.action) {
      case "overview":
        return Response.json({
          accounts: repo.accounts(),
          transactions: repo.transactions(),
          rules: repo.rules(),
          plans: repo.plans(),
          recurring: recurring(repo.transactions(), isoToday()),
          demo: repo.demo(),
          today: isoToday(),
          starlingConfigured: !!process.env.STARLING_PERSONAL_TOKEN,
        });
      case "import": {
        if (repo.demo())
          throw new Error(
            "Use a separate empty database for real data; demo cannot mix with bank data",
          );
        const accountId = "bos:" + cmd.accountId;
        const parsed = importBos(cmd.csv, accountId);
        if (!cmd.commit)
          return Response.json({
            ...parsed,
            transactions: parsed.transactions.slice(0, 25),
            total: parsed.transactions.length,
          });
        if (parsed.errors.length)
          throw new Error("Fix every CSV row error before importing");
        const old = repo.accounts().find((a) => a.id === accountId);
        if (!old && cmd.balance === undefined)
          throw new Error("Enter a current balance to create this account");
        return Response.json(
          repo.import(
            [
              {
                id: accountId,
                provider: "bos",
                name: "Bank of Scotland (manual)",
                currency: "GBP",
                balance: cmd.balance ?? old!.balance,
                available: cmd.balance ?? old!.available,
                asOf:
                  cmd.balance !== undefined
                    ? new Date().toISOString()
                    : old!.asOf,
              },
            ],
            parsed.transactions,
          ),
        );
      }
      case "correct":
        repo.correct(cmd.id, cmd.category, cmd.role);
        return Response.json({ ok: true });
      case "rule":
        repo.saveRule({ id: randomUUID(), ...cmd });
        return Response.json({ ok: true });
      case "plan":
        repo.atomic(() => {
          repo.savePlan(cmd.plan);
          repo.audit("plan-update", 1);
        });
        return Response.json({ ok: true });
      case "deletePlan":
        repo.atomic(() => {
          repo.db.prepare("DELETE FROM plans WHERE id=?").run(cmd.id);
          repo.audit("plan-delete", 1);
        });
        return Response.json({ ok: true });
      case "scenario": {
        const opening = repo.accounts().reduce((s, a) => s + a.available, 0);
        const result = forecast(opening, repo.plans(), cmd.input);
        const baseline = forecast(opening, repo.plans(), {
          ...cmd.input,
          housing: undefined,
          purchase: undefined,
        });
        return Response.json({
          result,
          baseline,
          delta: result.closing - baseline.closing,
          id: cmd.save ? repo.saveScenario(cmd.input) : undefined,
        });
      }
      case "sync": {
        if (repo.demo())
          throw new Error(
            "Use a separate empty database for real Starling data",
          );
        if (
          cmd.from > cmd.to ||
          (Date.parse(cmd.to) - Date.parse(cmd.from)) / 86400000 > 366 ||
          cmd.to > isoToday()
        )
          throw new Error("Choose a past interval of at most 366 days");
        const snapshot = await new StarlingAdapter(
          process.env.STARLING_PERSONAL_TOKEN ?? "",
        ).snapshot(cmd.from, cmd.to);
        return Response.json(
          repo.import(snapshot.accounts, snapshot.transactions, true),
        );
      }
      case "ask":
        return Response.json(await askLocalAI(repo, cmd.question));
    }
  } catch (e) {
    if (e instanceof z.ZodError)
      return Response.json(
        {
          error:
            "Invalid request or provider data; check dates, amounts and required fields",
        },
        { status: 400 },
      );
    if (e instanceof SyntaxError)
      return Response.json({ error: "Invalid input format" }, { status: 400 });
    // Never return provider response bodies, raw exceptions, tokens or SQL.
    const allowed = [
      "Starling",
      "Configure",
      "Local Ollama",
      "Use a separate",
      "Fix every",
      "Enter a current",
      "Choose a past",
      "Transaction not found",
      "Unknown tool",
      "CSV exceeds",
      "Amount must",
    ];
    const message = e instanceof Error ? e.message : "";
    return Response.json(
      {
        error: allowed.some((s) => message.startsWith(s))
          ? message
          : "Operation failed. Check the input and local service configuration.",
      },
      { status: 400 },
    );
  } finally {
    busy = false;
  }
}
