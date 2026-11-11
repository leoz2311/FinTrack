import { useMemo, useState } from 'react'
import { ArrowLeft, CheckCircle2, Pencil, Scale } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { financeKeys, useAccounts, useReconcileAccount, useTransactions } from '@/hooks/use-finance-data'
import { formatDateTime } from '@/lib/dates'
import { centsToInput, formatMoney, parseMoneyToCents } from '@/lib/money'
import { errorMessage } from '@/lib/utils'
import { requireSupabase } from '@/lib/supabase'
import { transactionAmount } from '@/lib/finance'
import { accountTypeNames } from './accounts-page'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog } from '@/components/ui/dialog'
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states'
import { Input, Label, Textarea } from '@/components/ui/field'

export function AccountDetailPage() {
  const { id } = useParams()
  const accounts = useAccounts(true)
  const transactions = useTransactions()
  const [reconcileOpen, setReconcileOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const account = accounts.data?.find((item) => item.id === id)
  const related = useMemo(() => transactions.data?.filter((tx) => tx.transaction_entries.some((entry) => entry.account_id === id)) ?? [], [id, transactions.data])
  if (accounts.isLoading || transactions.isLoading) return <LoadingState />
  if (accounts.error || transactions.error) return <ErrorState message={(accounts.error ?? transactions.error)?.message ?? 'Pogreška.'} />
  if (!account) return <ErrorState message="Račun nije pronađen ili više nije dostupan." />
  const isLiability = ['credit_card', 'other_liability'].includes(account.type)
  return <div className="page-grid"><div><Button asChild variant="ghost" size="sm" className="mb-3 -ml-2"><Link to="/accounts"><ArrowLeft className="size-4" />Svi računi</Link></Button><div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-sm text-muted-foreground">{accountTypeNames[account.type]}</p><h1 className="mt-1 text-3xl font-bold tracking-tight">{account.name}</h1></div><div className="flex gap-2"><Button variant="outline" onClick={() => setEditOpen(true)}><Pencil className="size-4" />Uredi</Button><Button onClick={() => setReconcileOpen(true)}><Scale className="size-4" />Uskladi</Button></div></div></div><section className="grid gap-4 sm:grid-cols-3"><Card className="sm:col-span-2"><CardContent className="p-6"><p className="text-sm text-muted-foreground">Izračunati saldo</p><p className={`mt-2 text-4xl font-bold tracking-tight ${isLiability ? 'text-red-400' : ''}`}>{formatMoney(isLiability ? Math.abs(account.balance_cents) : account.balance_cents)}</p><div className="mt-6 flex items-center gap-2 text-xs text-muted-foreground"><CheckCircle2 className="size-4 text-primary" />Početno stanje + {related.length} ledger knjiženja</div></CardContent></Card><Card><CardContent className="p-6"><p className="text-sm text-muted-foreground">Početno stanje</p><p className="mt-2 text-xl font-semibold">{formatMoney(isLiability ? Math.abs(account.opening_balance_cents) : account.opening_balance_cents)}</p><p className="mt-5 text-xs leading-relaxed text-muted-foreground">Početna vrijednost ostaje nepromijenjena. Razlike se bilježe kao usklađenja radi pouzdanog audit traga.</p></CardContent></Card></section><Card><CardHeader><CardTitle>Povijest transakcija</CardTitle></CardHeader><CardContent>{related.length ? <div className="divide-y">{related.map((tx) => { const entry = tx.transaction_entries.find((item) => item.account_id === id); return <div key={tx.id} className="flex items-center gap-4 py-4 first:pt-0 last:pb-0"><div className={`size-2 rounded-full ${(entry?.amount_cents ?? 0) >= 0 ? 'bg-emerald-400' : 'bg-red-400'}`} /><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{tx.description}</p><p className="text-xs text-muted-foreground">{formatDateTime(tx.occurred_at)} · {tx.kind === 'adjustment' ? 'Usklađenje' : tx.categories?.name ?? (tx.kind === 'transfer' ? 'Transfer' : tx.kind)}</p></div><p className={`font-semibold ${(entry?.amount_cents ?? 0) >= 0 ? 'text-emerald-400' : ''}`}>{(entry?.amount_cents ?? 0) > 0 ? '+' : '−'}{formatMoney(Math.abs(entry?.amount_cents ?? transactionAmount(tx)))}</p></div> })}</div> : <EmptyState title="Nema transakcija" description="Knjiženja za ovaj račun pojavit će se ovdje." />}</CardContent></Card><ReconcileDialog open={reconcileOpen} onOpenChange={setReconcileOpen} accountId={account.id} current={account.balance_cents} liability={isLiability} /><EditAccountDialog open={editOpen} onOpenChange={setEditOpen} accountId={account.id} name={account.name} description={account.description ?? ''} /></div>
}

function ReconcileDialog({ open, onOpenChange, accountId, current, liability }: { open: boolean; onOpenChange: (value: boolean) => void; accountId: string; current: number; liability: boolean }) {
  const [target, setTarget] = useState(centsToInput(Math.abs(current)))
  const [note, setNote] = useState('')
  const reconcile = useReconcileAccount()
  const submit = async () => { try { const cents = parseMoneyToCents(target); await reconcile.mutateAsync({ accountId, targetBalanceCents: liability ? -cents : cents, note }); toast.success('Račun je usklađen i promjena je zabilježena.'); onOpenChange(false) } catch (error) { toast.error(errorMessage(error)) } }
  return <Dialog open={open} onOpenChange={onOpenChange} title="Usklađenje računa" description="FinTrack će evidentirati samo razliku između izračunatog i stvarnog stanja."><div className="grid gap-4"><div><Label htmlFor="target-balance">Stvarno trenutno stanje</Label><div className="relative"><Input id="target-balance" value={target} onChange={(event) => setTarget(event.target.value)} inputMode="decimal" className="pr-12" /><span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">EUR</span></div></div><div><Label htmlFor="reconcile-note">Razlog / bilješka</Label><Textarea id="reconcile-note" value={note} onChange={(event) => setNote(event.target.value)} placeholder="npr. Stanje prema izvodu" /></div><div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => onOpenChange(false)}>Odustani</Button><Button onClick={submit} disabled={reconcile.isPending}>{reconcile.isPending ? 'Usklađivanje…' : 'Potvrdi usklađenje'}</Button></div></div></Dialog>
}

function EditAccountDialog({ open, onOpenChange, accountId, name, description }: { open: boolean; onOpenChange: (value: boolean) => void; accountId: string; name: string; description: string }) {
  const [nextName, setNextName] = useState(name)
  const [nextDescription, setNextDescription] = useState(description)
  const client = useQueryClient()
  const mutation = useMutation({ mutationFn: async () => { const { error } = await requireSupabase().from('accounts').update({ name: nextName.trim(), description: nextDescription || null }).eq('id', accountId); if (error) throw error }, onSuccess: () => { toast.success('Podaci računa su ažurirani.'); onOpenChange(false); void client.invalidateQueries({ queryKey: financeKeys.accounts }) }, onError: (error) => toast.error(errorMessage(error)) })
  return <Dialog open={open} onOpenChange={onOpenChange} title="Uredi račun" description="Vrsta i početno stanje nisu promjenjivi; za financijsku razliku koristite usklađenje."><div className="grid gap-4"><div><Label htmlFor="edit-name">Naziv</Label><Input id="edit-name" value={nextName} onChange={(event) => setNextName(event.target.value)} /></div><div><Label htmlFor="edit-description">Bilješka</Label><Textarea id="edit-description" value={nextDescription} onChange={(event) => setNextDescription(event.target.value)} /></div><div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => onOpenChange(false)}>Odustani</Button><Button onClick={() => mutation.mutate()} disabled={!nextName.trim() || mutation.isPending}>Spremi</Button></div></div></Dialog>
}
