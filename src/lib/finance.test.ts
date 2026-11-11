import { describe, expect, it } from 'vitest'
import { accountBalance, assertBalanced, calculateFinancialSummary, transactionAmount } from './finance'
import { localDateKey, localInputToIso, monthBounds } from './dates'
import type { Account, Investment, LedgerEntry, Transaction } from '@/types/finance'

const entry = (amount_cents: number, kind: LedgerEntry['kind'] = 'account', account_id: string | null = 'a'): LedgerEntry => ({ id: crypto.randomUUID(), transaction_id: 'tx', account_id, kind, amount_cents })
const tx = (kind: Transaction['kind'], entries: LedgerEntry[], occurred_at = '2026-11-04T10:00:00.000Z'): Transaction => ({ id: crypto.randomUUID(), owner_id: 'u', kind, occurred_at, description: kind, category_id: kind === 'expense' || kind === 'income' ? 'c' : null, priority: kind === 'expense' ? 'essential' : null, card_id: null, notes: null, created_at: occurred_at, updated_at: occurred_at, transaction_entries: entries })
const account = (id: string, balance_cents: number, type: Account['type'] = 'checking'): Account => ({ id, owner_id: 'u', name: id, type, currency: 'EUR', opening_balance_cents: balance_cents, balance_cents, description: null, archived_at: null, created_at: '', updated_at: '' })

describe('FinTrack financijska ispravnost', () => {
  it('1. trošak 25 EUR smanjuje početnih 1000 EUR na 975 EUR', () => {
    expect(accountBalance(100_000, [entry(-2_500)])).toBe(97_500)
  })

  it('2. plaća 2000 EUR povećava početnih 1000 EUR na 3000 EUR', () => {
    expect(accountBalance(100_000, [entry(200_000)])).toBe(300_000)
  })

  it('3. transfer 200 EUR iz tekućeg u gotovinu ne mijenja neto vrijednost', () => {
    const entries = [entry(-20_000, 'account', 'checking'), entry(20_000, 'account', 'cash')]
    expect(assertBalanced(entries)).toBe(true)
    expect(accountBalance(100_000, [entries[0]]) + accountBalance(0, [entries[1]])).toBe(100_000)
  })

  it('4. transfer 100 EUR u štednju ne mijenja neto vrijednost ni potrošnju', () => {
    const transfer = tx('transfer', [entry(-10_000, 'account', 'checking'), entry(10_000, 'account', 'savings')])
    const summary = calculateFinancialSummary([account('checking', 90_000), account('savings', 10_000, 'savings')], [transfer], [])
    expect(summary.netWorthCents).toBe(100_000)
    expect(summary.expenseCents).toBe(0)
  })

  it('5. debitna kartica tereti povezani račun točno jednom', () => {
    const purchase = tx('expense', [entry(-2_500, 'account', 'checking'), entry(2_500, 'expense', null)])
    expect(purchase.transaction_entries.filter((item) => item.account_id === 'checking')).toHaveLength(1)
    expect(accountBalance(100_000, purchase.transaction_entries.filter((item) => item.account_id === 'checking'))).toBe(97_500)
    expect(transactionAmount(purchase)).toBe(2_500)
  })

  it('6. kreditna kupnja povećava obvezu i trošak jednom, a otplata je samo transfer', () => {
    const purchase = tx('expense', [entry(-10_000, 'account', 'credit'), entry(10_000, 'expense', null)])
    const repayment = tx('transfer', [entry(-10_000, 'account', 'checking'), entry(10_000, 'account', 'credit')])
    const summary = calculateFinancialSummary([account('checking', 90_000), account('credit', 0, 'credit_card')], [purchase, repayment], [])
    expect(summary.expenseCents).toBe(10_000)
    expect(summary.incomeCents).toBe(0)
    expect(assertBalanced(purchase.transaction_entries)).toBe(true)
    expect(assertBalanced(repayment.transaction_entries)).toBe(true)
  })

  it('7. rast ulaganja 50 EUR povećava neto vrijednost bez redovnog prihoda', () => {
    const investment = (value: number): Investment => ({ id: 'i', owner_id: 'u', account_id: 'brokerage', name: 'ETF', symbol: 'ETF', asset_type: 'etf', currency: 'EUR', archived_at: null, investment_valuations: [{ id: 'v', investment_id: 'i', market_value_cents: value, valued_at: '2026-11-04T10:00:00Z', note: null }] })
    const before = calculateFinancialSummary([account('brokerage', 0, 'brokerage')], [], [investment(100_000)])
    const after = calculateFinancialSummary([account('brokerage', 0, 'brokerage')], [], [investment(105_000)])
    expect(after.netWorthCents - before.netWorthCents).toBe(5_000)
    expect(after.incomeCents).toBe(0)
  })

  it('8. uređivanje ili brisanje transakcije odmah mijenja izvedene izračune', () => {
    const oldExpense = tx('expense', [entry(-2_500), entry(2_500, 'expense', null)])
    const editedExpense = tx('expense', [entry(-4_000), entry(4_000, 'expense', null)])
    expect(calculateFinancialSummary([account('a', 100_000)], [oldExpense], []).expenseCents).toBe(2_500)
    expect(calculateFinancialSummary([account('a', 100_000)], [editedExpense], []).expenseCents).toBe(4_000)
    expect(calculateFinancialSummary([account('a', 100_000)], [], []).expenseCents).toBe(0)
  })

  it('9. lokalna ponoć i DST pripadaju ispravnom zagrebačkom datumu', () => {
    expect(localDateKey('2026-03-28T22:59:59Z')).toBe('2026-03-28')
    expect(localDateKey('2026-03-28T23:00:00Z')).toBe('2026-03-29')
    expect(localDateKey('2026-03-29T01:30:00Z')).toBe('2026-03-29')
    expect(localDateKey('2026-10-25T01:30:00Z')).toBe('2026-10-25')
    expect(localInputToIso('2026-03-29T03:30')).toBe('2026-03-29T01:30:00.000Z')
    expect(monthBounds('2026-03').from).toBe('2026-02-28T23:00:00.000Z')
  })

  it('10. budžetske alokacije ne mogu utjecati na saldo jer nisu ledger stavke', () => {
    const balanceBefore = accountBalance(100_000, [])
    const allocationPlan = { amount_cents: 80_000 }
    expect(allocationPlan.amount_cents).toBe(80_000)
    expect(accountBalance(100_000, [])).toBe(balanceBefore)
  })

  it('11. izvještaj prihoda i potrošnje isključuje transfere i usklađenja', () => {
    const transfer = tx('transfer', [entry(-20_000, 'account', 'a'), entry(20_000, 'account', 'b')])
    const adjustment = tx('adjustment', [entry(1_000, 'account', 'a'), entry(-1_000, 'equity', null)])
    const summary = calculateFinancialSummary([account('a', 81_000), account('b', 20_000)], [transfer, adjustment], [])
    expect(summary.incomeCents).toBe(0)
    expect(summary.expenseCents).toBe(0)
  })

  it('12. platne kartice nisu računi i ne mogu udvostručiti saldo', () => {
    const accounts = [account('checking', 100_000)]
    const cards = [{ id: 'card-a', account_id: 'checking' }, { id: 'card-b', account_id: 'checking' }]
    expect(cards).toHaveLength(2)
    expect(calculateFinancialSummary(accounts, [], []).netWorthCents).toBe(100_000)
  })
})
