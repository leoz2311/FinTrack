export type AccountType = 'checking' | 'cash' | 'savings' | 'brokerage' | 'credit_card' | 'other_asset' | 'other_liability'
export type CardType = 'debit' | 'credit'
export type CategoryKind = 'expense' | 'income'
export type SpendingPriority = 'essential' | 'lifestyle' | 'discretionary'
export type TransactionKind = 'expense' | 'income' | 'transfer' | 'adjustment' | 'investment_trade' | 'valuation'

export interface Account {
  id: string
  owner_id: string
  name: string
  type: AccountType
  currency: 'EUR'
  opening_balance_cents: number
  balance_cents: number
  description: string | null
  archived_at: string | null
  created_at: string
  updated_at: string
}

export interface PaymentCard {
  id: string
  owner_id: string
  account_id: string
  name: string
  type: CardType
  last_four: string | null
  archived_at: string | null
  created_at: string
}

export interface Category {
  id: string
  owner_id: string
  name: string
  kind: CategoryKind
  default_priority: SpendingPriority | null
  color: string
  icon: string
  archived_at: string | null
}

export interface LedgerEntry {
  id: string
  transaction_id: string
  account_id: string | null
  kind: 'account' | 'expense' | 'income' | 'equity' | 'investment'
  amount_cents: number
}

export interface Transaction {
  id: string
  owner_id: string
  kind: TransactionKind
  occurred_at: string
  description: string
  category_id: string | null
  priority: SpendingPriority | null
  card_id: string | null
  notes: string | null
  created_at: string
  updated_at: string
  categories?: Pick<Category, 'name' | 'color'> | null
  cards?: Pick<PaymentCard, 'name'> | null
  transaction_entries: LedgerEntry[]
}

export interface Budget {
  id: string
  owner_id: string
  month: string
  spending_limit_cents: number
  expected_income_cents: number | null
  planned_savings_cents: number
  budget_allocations: BudgetAllocation[]
}

export interface BudgetAllocation {
  id: string
  budget_id: string
  category_id: string
  amount_cents: number
}

export interface SavingsGoal {
  id: string
  owner_id: string
  account_id: string | null
  name: string
  target_cents: number
  starting_cents: number
  target_date: string | null
  color: string
  archived_at: string | null
}

export interface Investment {
  id: string
  owner_id: string
  account_id: string
  name: string
  symbol: string | null
  asset_type: 'stock' | 'etf' | 'fund' | 'bond' | 'crypto' | 'other'
  currency: string
  archived_at: string | null
  investment_positions?: InvestmentPosition[]
  investment_valuations?: InvestmentValuation[]
}

export interface InvestmentPosition {
  id: string
  investment_id: string
  quantity: string
  cost_basis_cents: number
  as_of: string
}

export interface InvestmentValuation {
  id: string
  investment_id: string
  market_value_cents: number
  valued_at: string
  note: string | null
}

export interface BalanceSnapshot {
  id: string
  snapshot_date: string
  net_worth_cents: number
  liquid_cents: number
  investment_cents: number
  liability_cents: number
}
