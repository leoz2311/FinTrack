import { useEffect, useMemo, useState } from 'react'
import { CalendarRange, Copy, Save, TriangleAlert } from 'lucide-react'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'
import { currentMonthKey, monthBounds, previousMonthKey } from '@/lib/dates'
import { centsToInput, formatMoney, parseMoneyToCents } from '@/lib/money'
import { transactionAmount } from '@/lib/finance'
import { errorMessage } from '@/lib/utils'
import { requireSupabase } from '@/lib/supabase'
import { financeKeys, useBudgets, useCategories, useTransactions } from '@/hooks/use-finance-data'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states'
import { Input, Label } from '@/components/ui/field'
import { Progress } from '@/components/ui/progress'

export function BudgetsPage() {
  const [month, setMonth] = useState(currentMonthKey())
  const [limit, setLimit] = useState('0,00')
  const [expectedIncome, setExpectedIncome] = useState('0,00')
  const [plannedSavings, setPlannedSavings] = useState('0,00')
  const [allocations, setAllocations] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const budgets = useBudgets()
  const categories = useCategories()
  const transactions = useTransactions()
  const client = useQueryClient()
  const budget = budgets.data?.find((item) => item.month.startsWith(month))
  const expenseCategories = categories.data?.filter((item) => item.kind === 'expense') ?? []

  useEffect(() => {
    setLimit(centsToInput(budget?.spending_limit_cents ?? 0))
    setExpectedIncome(centsToInput(budget?.expected_income_cents ?? 0))
    setPlannedSavings(centsToInput(budget?.planned_savings_cents ?? 0))
    setAllocations(Object.fromEntries((budget?.budget_allocations ?? []).map((allocation) => [allocation.category_id, centsToInput(allocation.amount_cents)])))
  }, [budget?.id, budget?.spending_limit_cents, budget?.expected_income_cents, budget?.planned_savings_cents, budget?.budget_allocations])

  const bounds = monthBounds(month)
  const periodExpenses = useMemo(() => (transactions.data ?? []).filter((tx) => tx.kind === 'expense' && tx.occurred_at >= bounds.from && tx.occurred_at <= bounds.to), [bounds.from, bounds.to, transactions.data])
  const actualByCategory = useMemo(() => periodExpenses.reduce<Record<string, number>>((result, tx) => { if (tx.category_id) result[tx.category_id] = (result[tx.category_id] ?? 0) + transactionAmount(tx); return result }, {}), [periodExpenses])
  const actualTotal = Object.values(actualByCategory).reduce((sum, value) => sum + value, 0)
  const parsedLimit = safeParse(limit)
  const allocatedTotal = Object.values(allocations).reduce((sum, value) => sum + safeParse(value), 0)
  const unallocated = parsedLimit - allocatedTotal

  if (budgets.isLoading || categories.isLoading || transactions.isLoading) return <LoadingState label="Učitavanje budžeta…" />
  const queryError = budgets.error || categories.error || transactions.error
  if (queryError) return <ErrorState message={queryError.message} />

  const save = async () => {
    try {
      setSaving(true)
      const payload = Object.entries(allocations).map(([category_id, value]) => ({ category_id, amount_cents: safeParse(value) })).filter((item) => item.amount_cents > 0)
      const { error } = await requireSupabase().rpc('save_monthly_budget', { p_month: `${month}-01`, p_spending_limit_cents: safeParse(limit), p_expected_income_cents: safeParse(expectedIncome), p_planned_savings_cents: safeParse(plannedSavings), p_allocations: payload })
      if (error) throw error
      await client.invalidateQueries({ queryKey: financeKeys.budgets })
      toast.success('Mjesečni budžet je spremljen.')
    } catch (error) { toast.error(errorMessage(error)) } finally { setSaving(false) }
  }

  const copyPrevious = () => {
    const previous = budgets.data?.find((item) => item.month.startsWith(previousMonthKey(month)))
    if (!previous) { toast.error('Prethodni mjesec nema spremljen budžet.'); return }
    setLimit(centsToInput(previous.spending_limit_cents)); setExpectedIncome(centsToInput(previous.expected_income_cents ?? 0)); setPlannedSavings(centsToInput(previous.planned_savings_cents)); setAllocations(Object.fromEntries(previous.budget_allocations.map((item) => [item.category_id, centsToInput(item.amount_cents)]))); toast.success('Plan je kopiran. Spremite ga za odabrani mjesec.')
  }

  return <div className="page-grid"><PageHeader eyebrow="Mjesečni plan" title="Budžet" description="Omotnice i limiti su plan — ne smanjuju stvarne račune i ne predstavljaju novčani tok." action={<Button onClick={save} disabled={saving}><Save className="size-4" />{saving ? 'Spremanje…' : 'Spremi plan'}</Button>} />
    <div className="flex flex-col gap-3 rounded-2xl border bg-card/55 p-3 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-2"><CalendarRange className="size-4 text-primary" /><input type="month" value={month} onChange={(event) => setMonth(event.target.value)} className="h-10 rounded-xl border bg-background px-3 text-sm" /></div><Button variant="outline" size="sm" onClick={copyPrevious}><Copy className="size-4" />Kopiraj prethodni mjesec</Button></div>
    <section className="grid gap-4 md:grid-cols-3"><PlanInput label="Mjesečni limit potrošnje" value={limit} onChange={setLimit} helper="Gornja granica stvarnih troškova." /><PlanInput label="Očekivani prihod" value={expectedIncome} onChange={setExpectedIncome} helper="Ne stvara prihodnu transakciju." /><PlanInput label="Planirana štednja" value={plannedSavings} onChange={setPlannedSavings} helper="Cilj, ne stvarni prijenos novca." /></section>
    <section className="grid gap-4 xl:grid-cols-[1.4fr_.6fr]"><Card><CardHeader><CardTitle>Kategorijske omotnice</CardTitle></CardHeader><CardContent>{expenseCategories.length ? <div className="grid gap-5">{expenseCategories.map((category) => { const planned = safeParse(allocations[category.id] ?? '0'); const actual = actualByCategory[category.id] ?? 0; const over = planned > 0 && actual > planned; return <div key={category.id}><div className="mb-2 grid grid-cols-[1fr_110px] items-center gap-4 sm:grid-cols-[1fr_130px_130px]"><div className="flex min-w-0 items-center gap-3"><span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: category.color }} /><div className="min-w-0"><p className="truncate text-sm font-medium">{category.name}</p><p className={`text-xs ${over ? 'text-red-400' : 'text-muted-foreground'}`}>Stvarno {formatMoney(actual)}{over ? ' · prekoračeno' : ''}</p></div></div><div className="relative"><Input value={allocations[category.id] ?? ''} onChange={(event) => setAllocations((current) => ({ ...current, [category.id]: event.target.value }))} inputMode="decimal" placeholder="0,00" className="h-9 pr-9 text-right text-sm" /><span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">€</span></div><p className="hidden text-right text-xs text-muted-foreground sm:block">{planned > 0 ? `${Math.round(actual / planned * 100)}% iskorišteno` : 'Bez plana'}</p></div><Progress value={planned ? actual / planned * 100 : 0} indicatorClassName={over ? 'bg-red-400' : undefined} /></div>})}</div> : <EmptyState title="Nema kategorija" description="Dodajte troškovne kategorije u postavkama." />}</CardContent></Card>
      <div className="grid content-start gap-4"><Card><CardHeader><CardTitle>Sažetak plana</CardTitle></CardHeader><CardContent className="grid gap-4"><SummaryLine label="Limit" value={parsedLimit} /><SummaryLine label="Dodijeljeno" value={allocatedTotal} /><SummaryLine label="Nedodijeljeno" value={unallocated} emphasis negative={unallocated < 0} /><div className="border-t pt-4"><SummaryLine label="Stvarno potrošeno" value={actualTotal} /><Progress className="mt-3" value={parsedLimit ? actualTotal / parsedLimit * 100 : 0} indicatorClassName={actualTotal > parsedLimit ? 'bg-red-400' : undefined} /></div>{unallocated < 0 && <div className="flex gap-2 rounded-xl bg-red-500/10 p-3 text-xs text-red-300"><TriangleAlert className="size-4 shrink-0" />Omotnice premašuju ukupni limit za {formatMoney(Math.abs(unallocated))}.</div>}</CardContent></Card><Card><CardContent className="p-5"><p className="text-sm font-semibold">Važna razlika</p><p className="mt-2 text-xs leading-relaxed text-muted-foreground">Planirana štednja nije trošak. Tek stvarni transfer na štedni račun mijenja pojedinačne salde, ali ukupna neto vrijednost ostaje ista.</p></CardContent></Card></div></section>
  </div>
}

function safeParse(value: string): number { if (!value.trim() || value.trim() === '0' || value.trim() === '0,00') return 0; try { return parseMoneyToCents(value) } catch { return 0 } }
function PlanInput({ label, value, onChange, helper }: { label: string; value: string; onChange: (value: string) => void; helper: string }) { return <Card><CardContent className="p-5"><Label>{label}</Label><div className="relative"><Input value={value} onChange={(event) => onChange(event.target.value)} inputMode="decimal" className="pr-12 text-lg font-semibold" /><span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">EUR</span></div><p className="mt-2 text-xs text-muted-foreground">{helper}</p></CardContent></Card> }
function SummaryLine({ label, value, emphasis, negative }: { label: string; value: number; emphasis?: boolean; negative?: boolean }) { return <div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">{label}</span><span className={`${emphasis ? 'text-lg' : 'text-sm'} font-semibold ${negative ? 'text-red-400' : ''}`}>{formatMoney(value)}</span></div> }
