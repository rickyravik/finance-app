import type { Account, Transaction } from "../domain/model";
export interface BankSnapshot {
  accounts: Account[];
  transactions: Transaction[];
}
export interface BankAdapter {
  readonly provider: string;
  snapshot(from: string, to: string): Promise<BankSnapshot>;
}
