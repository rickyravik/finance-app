import { parse } from "csv-parse/sync";
import { createHash } from "node:crypto";
import {
  date,
  money,
  transactionSchema,
  type Transaction,
} from "../domain/model";
export interface ImportResult {
  transactions: Transaction[];
  errors: { row: number; message: string }[];
}
export function importBos(csv: string, accountId: string): ImportResult {
  if (Buffer.byteLength(csv) > 2_000_000) throw new Error("CSV exceeds 2 MB");
  const rows: Record<string, string>[] = parse(csv, {
    columns: true,
    bom: true,
    skip_empty_lines: true,
    trim: true,
  });
  if (rows.length > 10000) throw new Error("CSV exceeds 10,000 rows");
  const seen = new Map<string, number>();
  const transactions: Transaction[] = [];
  const errors: ImportResult["errors"] = [];
  for (const [i, row] of rows.entries())
    try {
      const raw = row["Transaction Date"] ?? row.Date;
      if (!raw) throw new Error("Expected Date or Transaction Date column");
      const booked = date.parse(
        /^\d{2}\/\d{2}\/\d{4}$/.test(raw)
          ? raw.split("/").reverse().join("-")
          : raw,
      );
      const merchant = row["Transaction Description"] ?? row.Description;
      if (!merchant?.trim()) throw new Error("Missing transaction description");
      const amount =
        row.Amount !== undefined
          ? money(row.Amount)
          : money(row["Credit Amount"] || "0") -
            money(row["Debit Amount"] || "0");
      if (
        row.Amount === undefined &&
        row["Credit Amount"] === undefined &&
        row["Debit Amount"] === undefined
      )
        throw new Error(
          "Missing Amount or Debit Amount / Credit Amount columns",
        );
      if (
        row.Amount === undefined &&
        money(row["Credit Amount"] || "0") !== 0 &&
        money(row["Debit Amount"] || "0") !== 0
      )
        throw new Error("Both debit and credit are populated");
      // Occurrence index preserves repeated identical purchases within the same file.
      const key = JSON.stringify([accountId, booked, merchant, amount]);
      const occurrence = seen.get(key) ?? 0;
      seen.set(key, occurrence + 1);
      const id =
        "bos:" +
        createHash("sha256")
          .update(key + ":" + occurrence)
          .digest("hex");
      transactions.push(
        transactionSchema.parse({
          id,
          accountId,
          date: booked,
          merchant,
          amount,
          category: "Uncategorised",
          role: amount > 0 ? "income" : "lifestyle",
          pending: false,
          corrected: false,
        }),
      );
    } catch (e) {
      errors.push({
        row: i + 2,
        message: e instanceof Error ? e.message : "Invalid row",
      });
    }
  return { transactions, errors };
}
