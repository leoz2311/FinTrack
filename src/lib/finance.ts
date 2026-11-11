import type { Account, Investment, LedgerEntry, Transaction } from '@/types/finance'
import { localDateKey } from './dates'

export interface FinancialSummary {
  netWorthCents: number
  liquidCents: number
  checkingAndCashCents: number
  savingsCents: number
  investmentCents: number
  liabilitiesCents: number
  incomeCents: number
  expenseCents: number
  netCashFlowCents: number
  todayExpenseCents: number
}

export function accountBalance(openingBalanceCents: number, entries: Pick<LedgerEntry, 'amount_cents'>[]): number {
  return entries.reduce((total, entry) => total + entry.amount_cents, openingBalanceCents)
}

export function assertBalanced(entries: Pick<LedgerEntry, 'amount_cents'>[]): boolean {
  return entries.length >= 2 && entries.reduce((sum, entry) => sum + entry.amount_cents, 0) === 0
}

export function transactionAmount(transaction: Pick<Transaction, 'kind' | 'transaction_entries'>): number {
  if (transaction.kind === 'expense') {
    return transaction.transaction_entries.filter((entry) => entry.kind === 'expense').reduce((sum, entry) => sum + entry.amount_cents, 0)
  }
  if (transaction.kind === 'income') {
    return Math.abs(transaction.transaction_entries.filter((entry) => entry.kind === 'income').reduce((sum, entry) => sum + entry.amount_cents, 0))
  }
  return Math.abs(transaction.transaction_entries.find((entry) => entry.kind === 'account')?.amount_cents ?? 0)
}

export function latestInvestmentValue(investment: Investment): number {
  const valuations = [...(investment.investment_valuations ?? [])].sort((a, b) => b.valued_at.localeCompare(a.valued_at))
  return valuations[0]?.market_value_cents ?? 0
}

export function calculateFinancialSummary(
  accounts: Account[],
  transactions: Transaction[],
  investments: Investment[],
  today = new Date()
): FinancialSummary {
  const assets = accounts.filter((account) => !['credit_card', 'other_liability'].includes(account.type))
  const liabilities = accounts.filter((account) => ['credit_card', 'other_liability'].includes(account.type))
  const investmentCents = investments.filter((item) => !item.archived_at).reduce((sum, item) => sum + latestInvestmentValue(item), 0)
  const assetCents = assets.reduce((sum, account) => sum + account.balance_cents, 0)
  const liabilityContribution = liabilities.reduce((sum, account) => sum + account.balance_cents, 0)
  const incomeCents = transactions.filter((tx) => tx.kind === 'income').reduce((sum, tx) => sum + transactionAmount(tx), 0)
  const expenseCents = transactions.filter((tx) => tx.kind === 'expense').reduce((sum, tx) => sum + transactionAmount(tx), 0)
  const todayKey = localDateKey(today.toISOString())
  const todayExpenseCents = transactions
    .filter((tx) => tx.kind === 'expense' && localDateKey(tx.occurred_at) === todayKey)
    .reduce((sum, tx) => sum + transactionAmount(tx), 0)

  return {
    netWorthCents: assetCents + liabilityContribution + investmentCents,
    liquidCents: accounts.filter((account) => ['checking', 'cash', 'savings'].includes(account.type)).reduce((sum, account) => sum + account.balance_cents, 0),
    checkingAndCashCents: accounts.filter((account) => ['checking', 'cash'].includes(account.type)).reduce((sum, account) => sum + account.balance_cents, 0),
    savingsCents: accounts.filter((account) => account.type === 'savings').reduce((sum, account) => sum + account.balance_cents, 0),
    investmentCents,
    liabilitiesCents: Math.abs(liabilityContribution),
    incomeCents,
    expenseCents,
    netCashFlowCents: incomeCents - expenseCents,
    todayExpenseCents
  }
}

export function groupExpensesByDate(transactions: Transaction[]): Array<{ date: string; amount: number }> {
  const totals = new Map<string, number>()
  transactions.filter((tx) => tx.kind === 'expense').forEach((tx) => {
    const key = localDateKey(tx.occurred_at)
    totals.set(key, (totals.get(key) ?? 0) + transactionAmount(tx))
  })
  return [...totals.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, amount]) => ({ date, amount: amount / 100 }))
}
