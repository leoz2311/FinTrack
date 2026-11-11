import { useEffect, useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ArrowDownRight, ArrowUpRight, Banknote, CreditCard, Landmark, PiggyBank, Plus, TrendingUp, Wallet } from 'lucide-react'
import { useAccounts, useBudgets, useInvestments, useTransactions } from '@/hooks/use-finance-data'
import { calculateFinancialSummary, groupExpensesByDate, transactionAmount } from '@/lib/finance'
import { currentMonthKey, formatDateTime, monthBounds, previousMonthKey } from '@/lib/dates'
import { formatMoney } from '@/lib/money'
import type { Transaction } from '@/types/finance'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states'
import { PageHeader } from '@/components/layout/page-header'
import { Select } from '@/components/ui/field'
import { Progress } from '@/components/ui/progress'
import { requireSupabase } from '@/lib/supabase'

const priorityNames = { essential: 'Osnovne potrebe', lifestyle: 'Životni stil', discretionary: 'Razonoda i luksuz' }
const priorityColors = { essential: 'bg-emerald-400', lifestyle: 'bg-sky-400', discretionary: 'bg-violet-400' }

export function DashboardPage() {
  const [month, setMonth] = useState(currentMonthKey())
  const [accountFilter, setAccountFilter] = useState('all')
  const { openTransaction } = useOutletContext<{ openTransaction: () => void }>()
  const accounts = useAccounts()
  const transactions = useTransactions()
  const investments = useInvestments()
  const budgets = useBudgets()
  const loading = accounts.isLoading || transactions.isLoading || investments.isLoading || budgets.isLoading
  const error = accounts.error || transactions.error || investments.error || budgets.error

  const { from, to } = monthBounds(month)
  const previousBounds = monthBounds(previousMonthKey(month))
  const periodTransactions = useMemo(() => filterTransactions(transactions.data ?? [], from, to, accountFilter), [transactions.data, from, to, accountFilter])
  const previousTransactions = useMemo(() => filterTransactions(transactions.data ?? [], previousBounds.from, previousBounds.to, accountFilter), [transactions.data, previousBounds.from, previousBounds.to, accountFilter])
  const summary = calculateFinancialSummary(accounts.data ?? [], periodTransactions, investments.data ?? [])
  const previousSummary = calculateFinancialSummary(accounts.data ?? [], previousTransactions, investments.data ?? [])
  const budget = budgets.data?.find((item) => item.month.startsWith(month))
  const remainingBudget = Math.max(0, (budget?.spending_limit_cents ?? 0) - summary.expenseCents)
  const savingsRate = summary.incomeCents > 0 ? Math.max(0, Math.round((summary.netCashFlowCents / summary.incomeCents) * 100)) : 0
  const trendData = groupExpensesByDate(periodTransactions)
  const categoryTotals = useMemo(() => aggregateCategories(periodTransactions), [periodTransactions])
  const priorityTotals = useMemo(() => aggregatePriorities(periodTransactions), [periodTransactions])

  useEffect(() => {
    if (!loading && !error) void requireSupabase().rpc('capture_balance_snapshot')
  }, [error, loading])

  if (loading) return <LoadingState label="Učitavanje financijskog pregleda…" />
  if (error) return <ErrorState message={error.message} onRetry={() => void Promise.all([accounts.refetch(), transactions.refetch(), investments.refetch(), budgets.refetch()])} />

  return <div className="page-grid">
    <PageHeader eyebrow="Financijski pregled" title="Dobro došli u FinTrack" description="Stvarno stanje vašeg novca, obveza i planova na jednom mjestu." action={<Button onClick={openTransaction}><Plus className="size-4" />Nova transakcija</Button>} />
    <div className="flex flex-col gap-3 rounded-2xl border bg-card/55 p-3 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-2"><span className="text-sm text-muted-foreground">Razdoblje</span><input type="month" value={month} onChange={(event) => setMonth(event.target.value)} className="h-9 rounded-lg border bg-background px-2 text-sm" /></div><div className="w-full sm:w-64"><Select value={accountFilter} onChange={(event) => setAccountFilter(event.target.value)} className="h-9"><option value="all">Svi računi</option>{accounts.data?.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</Select></div></div>

    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <MetricCard label="Ukupna neto vrijednost" value={formatMoney(summary.netWorthCents)} icon={Landmark} accent comparison={null} />
      <MetricCard label="Likvidno dostupno" value={formatMoney(summary.liquidCents)} icon={Wallet} comparison={null} />
      <MetricCard label="Prihodi u razdoblju" value={formatMoney(summary.incomeCents)} icon={ArrowUpRight} comparison={percentageChange(summary.incomeCents, previousSummary.incomeCents)} positive />
      <MetricCard label="Troškovi u razdoblju" value={formatMoney(summary.expenseCents)} icon={ArrowDownRight} comparison={percentageChange(summary.expenseCents, previousSummary.expenseCents)} reverse />
    </section>

    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
      <SmallMetric label="Tekući računi i gotovina" value={summary.checkingAndCashCents} icon={Banknote} />
      <SmallMetric label="Štednja" value={summary.savingsCents} icon={PiggyBank} />
      <SmallMetric label="Ulaganja" value={summary.investmentCents} icon={TrendingUp} />
      <SmallMetric label="Kartične i druge obveze" value={summary.liabilitiesCents} icon={CreditCard} negative />
      <SmallMetric label="Današnja potrošnja" value={summary.todayExpenseCents} icon={ArrowDownRight} />
    </section>

    <section className="grid gap-4 xl:grid-cols-[1.45fr_.55fr]">
      <Card><CardHeader className="flex-row items-center justify-between"><div><CardTitle>Dnevna potrošnja</CardTitle><p className="mt-1 text-sm text-muted-foreground">Ritam troškova u odabranom mjesecu</p></div><p className={`text-sm font-semibold ${summary.netCashFlowCents >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>Tok {formatMoney(summary.netCashFlowCents)}</p></CardHeader><CardContent>{trendData.length ? <div className="h-72 w-full"><ResponsiveContainer width="100%" height="100%"><AreaChart data={trendData}><defs><linearGradient id="expenseGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#34d399" stopOpacity={0.3} /><stop offset="100%" stopColor="#34d399" stopOpacity={0} /></linearGradient></defs><CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="4 4" /><XAxis dataKey="date" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(value: string) => value.slice(8)} /><YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} tickLine={false} axisLine={false} width={45} /><Tooltip formatter={(value) => formatMoney(Number(value) * 100)} contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 12 }} /><Area type="monotone" dataKey="amount" name="Trošak" stroke="#34d399" strokeWidth={2.5} fill="url(#expenseGradient)" /></AreaChart></ResponsiveContainer></div> : <EmptyState title="Još nema podataka za graf" description="Nakon prvog troška ovdje će se prikazati dnevni trend." />}</CardContent></Card>
      <Card><CardHeader><CardTitle>Mjesečni plan</CardTitle></CardHeader><CardContent className="grid gap-5">{budget ? <><div><div className="mb-2 flex justify-between text-sm"><span className="text-muted-foreground">Potrošeno</span><span className="font-semibold">{formatMoney(summary.expenseCents)} / {formatMoney(budget.spending_limit_cents)}</span></div><Progress value={budget.spending_limit_cents ? summary.expenseCents / budget.spending_limit_cents * 100 : 0} indicatorClassName={summary.expenseCents > budget.spending_limit_cents ? 'bg-red-400' : undefined} /></div><div className="grid grid-cols-2 gap-3"><div className="rounded-xl bg-secondary/60 p-3"><p className="text-xs text-muted-foreground">Preostalo</p><p className="mt-1 font-semibold">{formatMoney(remainingBudget)}</p></div><div className="rounded-xl bg-secondary/60 p-3"><p className="text-xs text-muted-foreground">Stopa štednje</p><p className="mt-1 font-semibold">{savingsRate}%</p></div></div><div className="border-t pt-4"><p className="text-xs text-muted-foreground">Planirana štednja</p><p className="mt-1 text-lg font-semibold">{formatMoney(budget.planned_savings_cents)}</p><p className="mt-1 text-xs text-muted-foreground">Plan ne mijenja stvarni saldo.</p></div></> : <EmptyState title="Nema budžeta" description="Postavite limit i kategorijske omotnice za ovaj mjesec." />}</CardContent></Card>
    </section>

    <section className="grid gap-4 xl:grid-cols-3">
      <Card><CardHeader><CardTitle>Potrošnja po prioritetu</CardTitle></CardHeader><CardContent className="grid gap-4">{(['essential', 'lifestyle', 'discretionary'] as const).map((priority) => { const amount = priorityTotals[priority] ?? 0; const percent = summary.expenseCents ? amount / summary.expenseCents * 100 : 0; return <div key={priority}><div className="mb-2 flex justify-between text-sm"><span>{priorityNames[priority]}</span><span className="font-semibold">{formatMoney(amount)}</span></div><Progress value={percent} indicatorClassName={priorityColors[priority]} /></div> })}</CardContent></Card>
      <Card><CardHeader><CardTitle>Najveće kategorije</CardTitle></CardHeader><CardContent>{categoryTotals.length ? <div className="grid gap-4">{categoryTotals.slice(0, 5).map((item) => <div key={item.name} className="flex items-center gap-3"><span className="size-2.5 rounded-full" style={{ background: item.color }} /><span className="flex-1 text-sm">{item.name}</span><span className="text-sm font-semibold">{formatMoney(item.amount)}</span></div>)}</div> : <p className="text-sm text-muted-foreground">Nema kategoriziranih troškova.</p>}</CardContent></Card>
      <Card><CardHeader><CardTitle>Najnovije transakcije</CardTitle></CardHeader><CardContent>{periodTransactions.length ? <div className="grid divide-y">{periodTransactions.slice(0, 5).map((tx) => <div key={tx.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"><div className={`grid size-9 place-items-center rounded-xl ${tx.kind === 'income' ? 'bg-emerald-500/10 text-emerald-400' : tx.kind === 'expense' ? 'bg-red-500/10 text-red-400' : 'bg-sky-500/10 text-sky-400'}`}>{tx.kind === 'income' ? <ArrowUpRight className="size-4" /> : tx.kind === 'expense' ? <ArrowDownRight className="size-4" /> : <Wallet className="size-4" />}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{tx.description}</p><p className="text-xs text-muted-foreground">{formatDateTime(tx.occurred_at)}</p></div><span className={`text-sm font-semibold ${tx.kind === 'income' ? 'text-emerald-400' : ''}`}>{tx.kind === 'income' ? '+' : tx.kind === 'expense' ? '−' : ''}{formatMoney(transactionAmount(tx))}</span></div>)}</div> : <p className="text-sm text-muted-foreground">Nema transakcija u ovom razdoblju.</p>}</CardContent></Card>
    </section>
  </div>
}

function filterTransactions(transactions: Transaction[], from: string, to: string, accountId: string) {
  return transactions.filter((tx) => tx.occurred_at >= from && tx.occurred_at <= to && (accountId === 'all' || tx.transaction_entries.some((entry) => entry.account_id === accountId)))
}

function aggregateCategories(transactions: Transaction[]) {
  const map = new Map<string, { name: string; color: string; amount: number }>()
  transactions.filter((tx) => tx.kind === 'expense').forEach((tx) => { const name = tx.categories?.name ?? 'Bez kategorije'; const current = map.get(name) ?? { name, color: tx.categories?.color ?? '#64748b', amount: 0 }; current.amount += transactionAmount(tx); map.set(name, current) })
  return [...map.values()].sort((a, b) => b.amount - a.amount)
}

function aggregatePriorities(transactions: Transaction[]) {
  return transactions.filter((tx) => tx.kind === 'expense' && tx.priority).reduce<Record<string, number>>((result, tx) => { result[tx.priority!] = (result[tx.priority!] ?? 0) + transactionAmount(tx); return result }, {})
}

function percentageChange(current: number, previous: number): number | null {
  if (!previous) return current ? 100 : null
  return Math.round(((current - previous) / previous) * 100)
}

function MetricCard({ label, value, icon: Icon, accent, comparison, positive, reverse }: { label: string; value: string; icon: typeof Landmark; accent?: boolean; comparison: number | null; positive?: boolean; reverse?: boolean }) {
  const favorable = comparison !== null && (reverse ? comparison <= 0 : comparison >= 0)
  return <Card className={accent ? 'border-primary/30 bg-gradient-to-br from-primary/12 to-card' : ''}><CardContent className="p-5 md:p-6"><div className="mb-5 flex items-start justify-between"><p className="text-sm text-muted-foreground">{label}</p><div className={`rounded-xl p-2 ${accent || positive ? 'bg-primary/10 text-primary' : 'bg-secondary text-muted-foreground'}`}><Icon className="size-4" /></div></div><p className="text-2xl font-bold tracking-tight">{value}</p>{comparison !== null && <p className={`mt-2 text-xs ${favorable ? 'text-emerald-400' : 'text-red-400'}`}>{comparison > 0 ? '+' : ''}{comparison}% prema prethodnom mjesecu</p>}</CardContent></Card>
}

function SmallMetric({ label, value, icon: Icon, negative }: { label: string; value: number; icon: typeof Landmark; negative?: boolean }) {
  return <Card><CardContent className="flex items-center gap-3 p-4"><div className="rounded-xl bg-secondary p-2.5 text-muted-foreground"><Icon className="size-4" /></div><div className="min-w-0"><p className="truncate text-xs text-muted-foreground">{label}</p><p className={`mt-0.5 truncate font-semibold ${negative && value > 0 ? 'text-red-400' : ''}`}>{formatMoney(value)}</p></div></CardContent></Card>
}
