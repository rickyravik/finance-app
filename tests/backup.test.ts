import { it, expect } from "vitest";
import { encryptBackup, decryptBackup } from "../src/server/backup";
import type { BackupPayload } from "../src/domain/model";

const samplePayload: BackupPayload = {
  version: 1,
  exportedAt: "2026-10-08T10:00:00Z",
  accounts: [
    {
      id: "bos:current",
      provider: "bos",
      name: "Bank of Scotland",
      currency: "GBP",
      balance: 150000,
      available: 150000,
      asOf: "2026-10-08T10:00:00Z",
    },
  ],
  transactions: [
    {
      id: "tx-1",
      accountId: "bos:current",
      date: "2026-10-01",
      amount: -1250,
      merchant: "Tesco Express",
      category: "Groceries",
      role: "essential",
      pending: false,
      corrected: false,
    },
  ],
  rules: [
    {
      id: "rule-1",
      match: "Tesco",
      category: "Groceries",
      role: "essential",
      priority: 10,
    },
  ],
  plans: [
    {
      id: "plan-1",
      name: "Salary",
      amount: 250000,
      day: 28,
      category: "Salary",
      role: "income",
      start: "2026-10-01",
    },
  ],
  goals: [
    {
      id: "goal-1",
      name: "Emergency Fund",
      targetAmount: 300000,
      currentAmount: 150000,
      targetDate: "2027-10-01",
      category: "Savings",
    },
  ],
  assetsLiabilities: [
    {
      id: "al-1",
      name: "Vanguard ISA",
      type: "asset",
      amount: 500000,
      category: "Investments",
      asOf: "2026-10-01",
    },
    {
      id: "al-2",
      name: "Credit Card",
      type: "liability",
      amount: 45000,
      category: "Credit Card",
      asOf: "2026-10-01",
    },
  ],
  settings: {
    reserve_policy: "60000",
  },
};

it("encrypts and decrypts a backup payload with correct passphrase", () => {
  const encrypted = encryptBackup(samplePayload, "my-secure-passphrase-123");
  expect(typeof encrypted).toBe("string");
  const decrypted = decryptBackup(encrypted, "my-secure-passphrase-123");
  expect(decrypted).toEqual(samplePayload);
});

it("rejects decryption with an incorrect passphrase", () => {
  const encrypted = encryptBackup(samplePayload, "correct-passphrase-123");
  expect(() => decryptBackup(encrypted, "wrong-passphrase-456")).toThrow(
    "Invalid backup passphrase or corrupted file",
  );
});

it("rejects decryption when ciphertext has been tampered with", () => {
  const encrypted = encryptBackup(samplePayload, "my-secure-passphrase-123");
  const envelope = JSON.parse(encrypted);
  envelope.data = "deadbeef" + envelope.data.slice(8);
  expect(() =>
    decryptBackup(JSON.stringify(envelope), "my-secure-passphrase-123"),
  ).toThrow("Invalid backup passphrase or corrupted file");
});

it("rejects passphrases shorter than 8 characters", () => {
  expect(() => encryptBackup(samplePayload, "short")).toThrow(
    "Passphrase must be at least 8 characters",
  );
});
