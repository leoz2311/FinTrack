import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Archive, CreditCard, Landmark, Plus } from 'lucide-react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { financeKeys, useAccounts, useCards } from '@/hooks/use-finance-data'
import { formatMoney, parseMoneyToCents } from '@/lib/money'
import { errorMessage } from '@/lib/utils'
import { requireSupabase } from '@/lib/supabase'
import type { Account, AccountType, CardType } from '@/types/finance'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog } from '@/components/ui/dialog'
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states'
import { FieldError, Input, Label, Select, Textarea } from '@/components/ui/field'

const accountTypeNames: Record<AccountType, string> = {
  checking: 'Tekući račun', cash: 'Gotovina', savings: 'Štednja', brokerage: 'Brokerage gotovina', credit_card: 'Kreditna kartica — obveza', other_asset: 'Druga imovina', other_liability: 'Druga obveza'
}

export function AccountsPage() {
  const accounts = useAccounts()
  const cards = useCards()
  const [accountOpen, setAccountOpen] = useState(false)
  const [cardOpen, setCardOpen] = useState(false)
  const client = useQueryClient()
  const archive = useMutation({
    mutationFn: async (account: Account) => {
      const { error } = await requireSupabase().from('accounts').update({ archived_at: new Date().toISOString() }).eq('id', account.id)
      if (error) throw error
    },
    onSuccess: () => { toast.success('Račun je arhiviran.'); void client.invalidateQueries({ queryKey: financeKeys.all }) },
    onError: (error) => toast.error(errorMessage(error))
  })
  if (accounts.isLoading || cards.isLoading) return <LoadingState label="Učitavanje računa…" />
  if (accounts.error || cards.error) return <ErrorState message={(accounts.error ?? cards.error)?.message ?? 'Pogreška pri učitavanju.'} />
  const assets = accounts.data?.filter((account) => !['credit_card', 'other_liability'].includes(account.type)) ?? []
  const liabilities = accounts.data?.filter((account) => ['credit_card', 'other_liability'].includes(account.type)) ?? []

  return <div className="page-grid">
    <PageHeader eyebrow="Novac i instrumenti" title="Računi i kartice" description="Saldo se računa iz početnog stanja i svake ledger stavke. Kartice nikada nisu dodatna imovina." action={<div className="flex gap-2"><Button variant="outline" onClick={() => setCardOpen(true)}><CreditCard className="size-4" />Dodaj karticu</Button><Button onClick={() => setAccountOpen(true)}><Plus className="size-4" />Dodaj račun</Button></div>} />
    {!accounts.data?.length ? <EmptyState title="Dodajte prvi račun" description="Počnite s tekućim računom, gotovinom, štednjom ili računom kreditne obveze." action={<Button onClick={() => setAccountOpen(true)}><Plus className="size-4" />Novi račun</Button>} /> : <>
      <AccountGroup title="Imovina i gotovina" accounts={assets} onArchive={(account) => { if (window.confirm(`Arhivirati račun „${account.name}”? Povijest ostaje sačuvana.`)) archive.mutate(account) }} />
      {liabilities.length > 0 && <AccountGroup title="Obveze" accounts={liabilities} onArchive={(account) => { if (window.confirm(`Arhivirati obvezu „${account.name}”?`)) archive.mutate(account) }} liability />}
    </>}
    <Card><CardHeader className="flex-row items-center justify-between"><div><CardTitle>Platne kartice</CardTitle><p className="mt-1 text-sm text-muted-foreground">Instrumenti povezani s računima, bez zasebnog salda.</p></div></CardHeader><CardContent>{cards.data?.length ? <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{cards.data.map((card) => { const linked = accounts.data?.find((account) => account.id === card.account_id); return <div key={card.id} className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-slate-800 to-slate-950 p-5 text-white"><div className="flex items-start justify-between"><CreditCard className="size-6 text-emerald-300" /><span className="rounded-full bg-white/10 px-2 py-1 text-[10px] uppercase tracking-wider">{card.type === 'debit' ? 'Debitna' : 'Kreditna'}</span></div><p className="mt-8 font-semibold">{card.name}</p><p className="mt-1 text-sm text-slate-400">{card.last_four ? `•••• ${card.last_four}` : 'Broj nije spremljen'}</p><p className="mt-4 border-t border-white/10 pt-3 text-xs text-slate-400">Povezano: {linked?.name ?? 'Nepoznat račun'}</p></div> })}</div> : <EmptyState title="Nema kartica" description="Dodajte karticu i povežite je s računom koji stvarno financira plaćanje." />}</CardContent></Card>
    <AccountDialog open={accountOpen} onOpenChange={setAccountOpen} />
    <CardDialog open={cardOpen} onOpenChange={setCardOpen} accounts={accounts.data ?? []} />
  </div>
}

function AccountGroup({ title, accounts, liability, onArchive }: { title: string; accounts: Account[]; liability?: boolean; onArchive: (account: Account) => void }) {
  if (!accounts.length) return null
  return <section><h2 className="mb-3 text-sm font-semibold text-muted-foreground">{title}</h2><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{accounts.map((account) => <Card key={account.id} className="group transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-panel"><CardContent className="p-5"><div className="flex items-start justify-between"><div className={`grid size-11 place-items-center rounded-2xl ${liability ? 'bg-red-500/10 text-red-400' : 'bg-primary/10 text-primary'}`}><Landmark className="size-5" /></div><button onClick={() => onArchive(account)} className="rounded-lg p-2 text-muted-foreground opacity-0 transition hover:bg-secondary group-hover:opacity-100" aria-label="Arhiviraj račun"><Archive className="size-4" /></button></div><p className="mt-5 text-sm text-muted-foreground">{accountTypeNames[account.type]}</p><p className={`mt-1 text-2xl font-bold tracking-tight ${liability && account.balance_cents < 0 ? 'text-red-400' : ''}`}>{formatMoney(liability ? Math.abs(account.balance_cents) : account.balance_cents)}</p><div className="mt-5 flex items-center justify-between border-t pt-4"><span className="font-medium">{account.name}</span><Button asChild variant="ghost" size="sm"><Link to={`/accounts/${account.id}`}>Detalji</Link></Button></div></CardContent></Card>)}</div></section>
}

const accountSchema = z.object({ name: z.string().trim().min(1, 'Upišite naziv.').max(80), type: z.enum(['checking', 'cash', 'savings', 'brokerage', 'credit_card', 'other_asset', 'other_liability']), openingBalance: z.string(), description: z.string().max(500).optional() })
type AccountValues = z.infer<typeof accountSchema>

function AccountDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (value: boolean) => void }) {
  const client = useQueryClient()
  const form = useForm<AccountValues>({ resolver: zodResolver(accountSchema), defaultValues: { name: '', type: 'checking', openingBalance: '0,00', description: '' } })
  const mutation = useMutation({
    mutationFn: async (values: AccountValues) => {
      let opening = values.openingBalance.trim() === '0,00' || values.openingBalance.trim() === '0' ? 0 : parseMoneyToCents(values.openingBalance)
      if (['credit_card', 'other_liability'].includes(values.type)) opening = -opening
      const { error } = await requireSupabase().from('accounts').insert({ name: values.name, type: values.type, opening_balance_cents: opening, description: values.description || null })
      if (error) throw error
    },
    onSuccess: () => { toast.success('Račun je stvoren.'); form.reset(); onOpenChange(false); void client.invalidateQueries({ queryKey: financeKeys.accounts }) },
    onError: (error) => toast.error(errorMessage(error))
  })
  return <Dialog open={open} onOpenChange={onOpenChange} title="Novi račun" description="Početno stanje je polazna točka ledgera. Kasnije razlike evidentirajte usklađenjem."><form className="grid gap-4" onSubmit={form.handleSubmit((values) => mutation.mutate(values))}><div><Label htmlFor="account-name">Naziv</Label><Input id="account-name" placeholder="npr. Glavni tekući račun" {...form.register('name')} /><FieldError>{form.formState.errors.name?.message}</FieldError></div><div><Label htmlFor="account-type">Vrsta</Label><Select id="account-type" {...form.register('type')}>{Object.entries(accountTypeNames).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select></div><div><Label htmlFor="opening">Početno stanje</Label><div className="relative"><Input id="opening" inputMode="decimal" className="pr-12" {...form.register('openingBalance')} /><span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">EUR</span></div><p className="mt-1 text-xs text-muted-foreground">Za obvezu upišite pozitivan nepodmireni iznos; FinTrack ga evidentira kao negativnu neto vrijednost.</p></div><div><Label htmlFor="account-description">Bilješka</Label><Textarea id="account-description" {...form.register('description')} /></div><div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Odustani</Button><Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? 'Spremanje…' : 'Stvori račun'}</Button></div></form></Dialog>
}

const cardSchema = z.object({ name: z.string().trim().min(1, 'Upišite naziv.'), type: z.enum(['debit', 'credit']), accountId: z.string().min(1, 'Odaberite račun.'), lastFour: z.string().regex(/^$|^[0-9]{4}$/, 'Upišite točno četiri znamenke.') })
type CardValues = z.infer<typeof cardSchema>

function CardDialog({ open, onOpenChange, accounts }: { open: boolean; onOpenChange: (value: boolean) => void; accounts: Account[] }) {
  const client = useQueryClient()
  const form = useForm<CardValues>({ resolver: zodResolver(cardSchema), defaultValues: { name: '', type: 'debit', accountId: '', lastFour: '' } })
  const type = form.watch('type')
  const eligible = accounts.filter((account) => type === 'credit' ? account.type === 'credit_card' : !['credit_card', 'other_liability'].includes(account.type))
  const mutation = useMutation({
    mutationFn: async (values: CardValues) => { const { error } = await requireSupabase().from('cards').insert({ name: values.name, type: values.type as CardType, account_id: values.accountId, last_four: values.lastFour || null }); if (error) throw error },
    onSuccess: () => { toast.success('Kartica je dodana.'); form.reset(); onOpenChange(false); void client.invalidateQueries({ queryKey: financeKeys.cards }) },
    onError: (error) => toast.error(errorMessage(error))
  })
  return <Dialog open={open} onOpenChange={onOpenChange} title="Nova kartica" description="Kartica je instrument plaćanja i uvijek se povezuje s jednim stvarnim računom."><form className="grid gap-4" onSubmit={form.handleSubmit((values) => mutation.mutate(values))}><div className="grid gap-4 sm:grid-cols-2"><div><Label htmlFor="card-name">Naziv</Label><Input id="card-name" placeholder="npr. Visa" {...form.register('name')} /><FieldError>{form.formState.errors.name?.message}</FieldError></div><div><Label htmlFor="card-type">Vrsta</Label><Select id="card-type" {...form.register('type')}><option value="debit">Debitna</option><option value="credit">Kreditna</option></Select></div></div><div><Label htmlFor="card-account">Povezani račun</Label><Select id="card-account" {...form.register('accountId')}><option value="">Odaberite…</option>{eligible.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</Select><FieldError>{form.formState.errors.accountId?.message}</FieldError>{type === 'credit' && !eligible.length && <p className="mt-2 text-xs text-amber-400">Najprije stvorite račun vrste „Kreditna kartica — obveza”.</p>}</div><div><Label htmlFor="last-four">Posljednje 4 znamenke (neobavezno)</Label><Input id="last-four" inputMode="numeric" maxLength={4} placeholder="1234" {...form.register('lastFour')} /><FieldError>{form.formState.errors.lastFour?.message}</FieldError></div><div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Odustani</Button><Button type="submit" disabled={mutation.isPending || !eligible.length}>{mutation.isPending ? 'Spremanje…' : 'Dodaj karticu'}</Button></div></form></Dialog>
}

export { accountTypeNames }
