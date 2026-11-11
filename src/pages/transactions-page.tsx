import { useMemo, useState } from 'react'
import { ArrowDownRight, ArrowRightLeft, ArrowUpRight, Pencil, Plus, Search, SlidersHorizontal, Trash2, Wrench } from 'lucide-react'
import { toast } from 'sonner'
import { useAccounts, useCategories, useDeleteTransaction, useTransactions } from '@/hooks/use-finance-data'
import { formatDateTime } from '@/lib/dates'
import { transactionAmount } from '@/lib/finance'
import { formatMoney } from '@/lib/money'
import { errorMessage } from '@/lib/utils'
import type { Transaction, TransactionKind } from '@/types/finance'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states'
import { Input, Select } from '@/components/ui/field'
import { TransactionDialog } from '@/components/transactions/transaction-dialog'

const kindNames: Record<TransactionKind, string> = { expense: 'Trošak', income: 'Prihod', transfer: 'Transfer', adjustment: 'Usklađenje', investment_trade: 'Ulaganje', valuation: 'Promjena vrijednosti' }

export function TransactionsPage() {
  const transactions = useTransactions()
  const accounts = useAccounts()
  const categories = useCategories()
  const remove = useDeleteTransaction()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Transaction | null>(null)
  const [search, setSearch] = useState('')
  const [kind, setKind] = useState('all')
  const [account, setAccount] = useState('all')
  const [category, setCategory] = useState('all')
  const [priority, setPriority] = useState('all')
  const [sort, setSort] = useState('newest')

  const filtered = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase('hr')
    const result = (transactions.data ?? []).filter((tx) => {
      if (needle && !`${tx.description} ${tx.notes ?? ''} ${tx.categories?.name ?? ''}`.toLocaleLowerCase('hr').includes(needle)) return false
      if (kind !== 'all' && tx.kind !== kind) return false
      if (account !== 'all' && !tx.transaction_entries.some((entry) => entry.account_id === account)) return false
      if (category !== 'all' && tx.category_id !== category) return false
      if (priority !== 'all' && tx.priority !== priority) return false
      return true
    })
    return result.sort((a, b) => sort === 'newest' ? b.occurred_at.localeCompare(a.occurred_at) : sort === 'oldest' ? a.occurred_at.localeCompare(b.occurred_at) : sort === 'largest' ? transactionAmount(b) - transactionAmount(a) : transactionAmount(a) - transactionAmount(b))
  }, [account, category, kind, priority, search, sort, transactions.data])

  if (transactions.isLoading || accounts.isLoading || categories.isLoading) return <LoadingState label="Učitavanje transakcija…" />
  const queryError = transactions.error || accounts.error || categories.error
  if (queryError) return <ErrorState message={queryError.message} />

  const handleDelete = async (tx: Transaction) => {
    if (!window.confirm(`Trajno izbrisati transakciju „${tx.description}”? Stara verzija ostaje u audit zapisu.`)) return
    try { await remove.mutateAsync(tx.id); toast.success('Transakcija je izbrisana i salda su preračunata.') } catch (error) { toast.error(errorMessage(error)) }
  }

  return <div className="page-grid">
    <PageHeader eyebrow="Ledger" title="Transakcije" description="Pretražite, filtrirajte i upravljajte svakim stvarnim novčanim tokom." action={<Button onClick={() => { setEditing(null); setOpen(true) }}><Plus className="size-4" />Nova transakcija</Button>} />
    <Card><CardContent className="p-4"><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1.5fr_repeat(5,1fr)]"><div className="relative"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Pretraži opis ili bilješku…" className="pl-9" /></div><Select value={kind} onChange={(event) => setKind(event.target.value)}><option value="all">Sve vrste</option><option value="expense">Troškovi</option><option value="income">Prihodi</option><option value="transfer">Transferi</option><option value="adjustment">Usklađenja</option></Select><Select value={account} onChange={(event) => setAccount(event.target.value)}><option value="all">Svi računi</option>{accounts.data?.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select><Select value={category} onChange={(event) => setCategory(event.target.value)}><option value="all">Sve kategorije</option>{categories.data?.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select><Select value={priority} onChange={(event) => setPriority(event.target.value)}><option value="all">Svi prioriteti</option><option value="essential">Osnovne potrebe</option><option value="lifestyle">Životni stil</option><option value="discretionary">Razonoda i luksuz</option></Select><Select value={sort} onChange={(event) => setSort(event.target.value)}><option value="newest">Najnovije</option><option value="oldest">Najstarije</option><option value="largest">Najveći iznos</option><option value="smallest">Najmanji iznos</option></Select></div></CardContent></Card>
    <div className="flex items-center justify-between"><p className="text-sm text-muted-foreground">{filtered.length} rezultata</p><div className="flex items-center gap-2 text-xs text-muted-foreground"><SlidersHorizontal className="size-3.5" />Aktivni filtri primjenjuju se odmah</div></div>
    {filtered.length ? <Card><CardContent className="p-0"><div className="divide-y">{filtered.map((tx) => <TransactionRow key={tx.id} transaction={tx} accountNames={new Map(accounts.data?.map((item) => [item.id, item.name]))} onEdit={() => { setEditing(tx); setOpen(true) }} onDelete={() => void handleDelete(tx)} />)}</div></CardContent></Card> : <EmptyState title="Nema pronađenih transakcija" description={transactions.data?.length ? 'Promijenite filtre ili pojam za pretragu.' : 'Dodajte prvi prihod, trošak ili transfer.'} action={!transactions.data?.length && <Button onClick={() => setOpen(true)}><Plus className="size-4" />Dodaj transakciju</Button>} />}
    <TransactionDialog open={open} onOpenChange={(value) => { setOpen(value); if (!value) setEditing(null) }} transaction={editing} />
  </div>
}

function TransactionRow({ transaction, accountNames, onEdit, onDelete }: { transaction: Transaction; accountNames: Map<string, string>; onEdit: () => void; onDelete: () => void }) {
  const icon = transaction.kind === 'expense' ? <ArrowDownRight className="size-4" /> : transaction.kind === 'income' ? <ArrowUpRight className="size-4" /> : transaction.kind === 'transfer' ? <ArrowRightLeft className="size-4" /> : <Wrench className="size-4" />
  const tone = transaction.kind === 'expense' ? 'bg-red-500/10 text-red-400' : transaction.kind === 'income' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-sky-500/10 text-sky-400'
  const linkedAccounts = transaction.transaction_entries.filter((entry) => entry.account_id).map((entry) => accountNames.get(entry.account_id!)).filter(Boolean).join(' → ')
  return <div className="group flex items-center gap-3 px-4 py-4 md:px-6"><div className={`grid size-10 shrink-0 place-items-center rounded-xl ${tone}`}>{icon}</div><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><p className="truncate text-sm font-semibold">{transaction.description}</p><span className="hidden rounded-full bg-secondary px-2 py-0.5 text-[10px] text-muted-foreground sm:inline">{kindNames[transaction.kind]}</span></div><p className="mt-1 truncate text-xs text-muted-foreground">{formatDateTime(transaction.occurred_at)} · {(transaction.categories?.name ?? linkedAccounts) || 'Bez kategorije'}{transaction.cards?.name ? ` · ${transaction.cards.name}` : ''}</p></div><div className="text-right"><p className={`font-semibold ${transaction.kind === 'income' ? 'text-emerald-400' : transaction.kind === 'expense' ? 'text-red-400' : ''}`}>{transaction.kind === 'income' ? '+' : transaction.kind === 'expense' ? '−' : ''}{formatMoney(transactionAmount(transaction))}</p>{transaction.priority && <p className="mt-1 hidden text-[10px] text-muted-foreground md:block">{transaction.priority === 'essential' ? 'Osnovne potrebe' : transaction.priority === 'lifestyle' ? 'Životni stil' : 'Razonoda i luksuz'}</p>}</div><div className="ml-1 flex opacity-100 transition md:opacity-0 md:group-hover:opacity-100">{['expense', 'income', 'transfer'].includes(transaction.kind) && <Button variant="ghost" size="icon" onClick={onEdit} aria-label="Uredi"><Pencil className="size-4" /></Button>}<Button variant="ghost" size="icon" onClick={onDelete} aria-label="Izbriši"><Trash2 className="size-4 text-red-400" /></Button></div></div>
}
