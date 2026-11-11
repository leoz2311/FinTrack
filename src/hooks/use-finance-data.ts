import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { requireSupabase } from '@/lib/supabase'
import type { Account, BalanceSnapshot, Budget, Category, Investment, PaymentCard, SavingsGoal, Transaction, TransactionKind, SpendingPriority } from '@/types/finance'

function throwOnError<T>(data: T | null, error: { message: string } | null): T {
  if (error) throw new Error(error.message)
  return data as T
}

export const financeKeys = {
  all: ['finance'] as const,
  accounts: ['finance', 'accounts'] as const,
  cards: ['finance', 'cards'] as const,
  categories: ['finance', 'categories'] as const,
  transactions: ['finance', 'transactions'] as const,
  budgets: ['finance', 'budgets'] as const,
  goals: ['finance', 'goals'] as const,
  investments: ['finance', 'investments'] as const,
  snapshots: ['finance', 'snapshots'] as const
}

export function useAccounts(includeArchived = false) {
  return useQuery({
    queryKey: [...financeKeys.accounts, includeArchived],
    queryFn: async () => {
      let query = requireSupabase().from('account_balances').select('*').order('name')
      if (!includeArchived) query = query.is('archived_at', null)
      const { data, error } = await query
      return throwOnError(data, error) as Account[]
    }
  })
}

export function useCards() {
  return useQuery({
    queryKey: financeKeys.cards,
    queryFn: async () => {
      const { data, error } = await requireSupabase().from('cards').select('*').is('archived_at', null).order('name')
      return throwOnError(data, error) as PaymentCard[]
    }
  })
}

export function useCategories(includeArchived = false) {
  return useQuery({
    queryKey: [...financeKeys.categories, includeArchived],
    queryFn: async () => {
      let query = requireSupabase().from('categories').select('*').order('name')
      if (!includeArchived) query = query.is('archived_at', null)
      const { data, error } = await query
      return throwOnError(data, error) as Category[]
    }
  })
}

export function useTransactions(limit = 1000) {
  return useQuery({
    queryKey: [...financeKeys.transactions, limit],
    queryFn: async () => {
      const { data, error } = await requireSupabase()
        .from('transactions')
        .select('*, categories(name,color), cards(name), transaction_entries(*)')
        .order('occurred_at', { ascending: false })
        .limit(limit)
      return throwOnError(data, error) as Transaction[]
    }
  })
}

export function useBudgets() {
  return useQuery({
    queryKey: financeKeys.budgets,
    queryFn: async () => {
      const { data, error } = await requireSupabase().from('budgets').select('*, budget_allocations(*)').order('month', { ascending: false })
      return throwOnError(data, error) as Budget[]
    }
  })
}

export function useSavingsGoals() {
  return useQuery({
    queryKey: financeKeys.goals,
    queryFn: async () => {
      const { data, error } = await requireSupabase().from('savings_goals').select('*').is('archived_at', null).order('created_at')
      return throwOnError(data, error) as SavingsGoal[]
    }
  })
}

export function useInvestments() {
  return useQuery({
    queryKey: financeKeys.investments,
    queryFn: async () => {
      const { data, error } = await requireSupabase()
        .from('investments')
        .select('*, investment_positions(*), investment_valuations(*)')
        .is('archived_at', null)
        .order('name')
      return throwOnError(data, error) as Investment[]
    }
  })
}

export function useBalanceSnapshots() {
  return useQuery({
    queryKey: financeKeys.snapshots,
    queryFn: async () => {
      const { data, error } = await requireSupabase().from('balance_snapshots').select('*').order('snapshot_date')
      return throwOnError(data, error) as BalanceSnapshot[]
    }
  })
}

export interface CreateTransactionInput {
  kind: Extract<TransactionKind, 'expense' | 'income' | 'transfer'>
  description: string
  amountCents: number
  occurredAt: string
  sourceAccountId: string
  destinationAccountId?: string | null
  categoryId?: string | null
  priority?: SpendingPriority | null
  cardId?: string | null
  notes?: string | null
}

export function useCreateTransaction() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async (input: CreateTransactionInput) => {
      const { data, error } = await requireSupabase().rpc('create_financial_transaction', {
        p_kind: input.kind,
        p_description: input.description,
        p_amount_cents: input.amountCents,
        p_occurred_at: input.occurredAt,
        p_source_account_id: input.sourceAccountId,
        p_destination_account_id: input.destinationAccountId ?? null,
        p_category_id: input.categoryId ?? null,
        p_priority: input.priority ?? null,
        p_card_id: input.cardId ?? null,
        p_notes: input.notes ?? null
      })
      return throwOnError(data, error) as string
    },
    onSuccess: () => client.invalidateQueries({ queryKey: financeKeys.all })
  })
}

export function useUpdateTransaction() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...input }: CreateTransactionInput & { id: string }) => {
      const { data, error } = await requireSupabase().rpc('update_financial_transaction', {
        p_transaction_id: id,
        p_kind: input.kind,
        p_description: input.description,
        p_amount_cents: input.amountCents,
        p_occurred_at: input.occurredAt,
        p_source_account_id: input.sourceAccountId,
        p_destination_account_id: input.destinationAccountId ?? null,
        p_category_id: input.categoryId ?? null,
        p_priority: input.priority ?? null,
        p_card_id: input.cardId ?? null,
        p_notes: input.notes ?? null
      })
      return throwOnError(data, error) as string
    },
    onSuccess: () => client.invalidateQueries({ queryKey: financeKeys.all })
  })
}

export function useDeleteTransaction() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await requireSupabase().rpc('delete_financial_transaction', { p_transaction_id: id })
      if (error) throw new Error(error.message)
    },
    onSuccess: () => client.invalidateQueries({ queryKey: financeKeys.all })
  })
}

export function useReconcileAccount() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async ({ accountId, targetBalanceCents, note }: { accountId: string; targetBalanceCents: number; note?: string }) => {
      const { data, error } = await requireSupabase().rpc('reconcile_account', {
        p_account_id: accountId,
        p_target_balance_cents: targetBalanceCents,
        p_occurred_at: new Date().toISOString(),
        p_note: note ?? null
      })
      return throwOnError(data, error) as string
    },
    onSuccess: () => client.invalidateQueries({ queryKey: financeKeys.all })
  })
}
