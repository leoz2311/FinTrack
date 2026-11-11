import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { localDateTimeInput, localInputToIso } from '@/lib/dates'
import { centsToInput, parseMoneyToCents } from '@/lib/money'
import { transactionAmount } from '@/lib/finance'
import { errorMessage } from '@/lib/utils'
import { useAccounts, useCards, useCategories, useCreateTransaction, useUpdateTransaction } from '@/hooks/use-finance-data'
import type { SpendingPriority, Transaction } from '@/types/finance'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { FieldError, Input, Label, Select, Textarea } from '@/components/ui/field'

const formSchema = z.object({
  kind: z.enum(['expense', 'income', 'transfer']),
  amount: z.string().min(1, 'Upišite iznos.'),
  description: z.string().trim().min(1, 'Upišite opis.').max(160),
  occurredAt: z.string().min(1, 'Odaberite datum.'),
  sourceAccountId: z.string().min(1, 'Odaberite račun.'),
  destinationAccountId: z.string().optional(),
  categoryId: z.string().optional(),
  priority: z.enum(['essential', 'lifestyle', 'discretionary']).optional(),
  cardId: z.string().optional(),
  notes: z.string().max(2000).optional()
}).superRefine((value, context) => {
  if (value.kind === 'transfer' && !value.destinationAccountId) context.addIssue({ code: 'custom', path: ['destinationAccountId'], message: 'Odaberite odredišni račun.' })
  if (value.kind !== 'transfer' && !value.categoryId) context.addIssue({ code: 'custom', path: ['categoryId'], message: 'Odaberite kategoriju.' })
  if (value.kind === 'expense' && !value.priority) context.addIssue({ code: 'custom', path: ['priority'], message: 'Odaberite prioritet.' })
})

type FormValues = z.infer<typeof formSchema>

export function TransactionDialog({ open, onOpenChange, transaction = null }: { open: boolean; onOpenChange: (open: boolean) => void; transaction?: Transaction | null }) {
  const accounts = useAccounts()
  const cards = useCards()
  const categories = useCategories()
  const create = useCreateTransaction()
  const update = useUpdateTransaction()
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { kind: 'expense', amount: '', description: '', occurredAt: localDateTimeInput(), sourceAccountId: '', destinationAccountId: '', categoryId: '', priority: 'essential', cardId: '', notes: '' }
  })
  const kind = form.watch('kind')
  const categoryId = form.watch('categoryId')

  useEffect(() => {
    if (!open || !transaction || !['expense', 'income', 'transfer'].includes(transaction.kind)) return
    const accountEntries = transaction.transaction_entries.filter((entry) => entry.kind === 'account')
    const source = accountEntries.find((entry) => entry.amount_cents < 0) ?? accountEntries[0]
    const destination = transaction.kind === 'transfer' ? accountEntries.find((entry) => entry.amount_cents > 0) : null
    form.reset({
      kind: transaction.kind as FormValues['kind'],
      amount: centsToInput(transactionAmount(transaction)),
      description: transaction.description,
      occurredAt: localDateTimeInput(new Date(transaction.occurred_at)),
      sourceAccountId: source?.account_id ?? '',
      destinationAccountId: destination?.account_id ?? '',
      categoryId: transaction.category_id ?? '',
      priority: transaction.priority ?? undefined,
      cardId: transaction.card_id ?? '',
      notes: transaction.notes ?? ''
    })
  }, [form, open, transaction])

  useEffect(() => {
    const category = categories.data?.find((item) => item.id === categoryId)
    if (category?.default_priority && kind === 'expense') form.setValue('priority', category.default_priority)
  }, [categoryId, categories.data, form, kind])

  useEffect(() => {
    if (!open) return
    const firstAccount = accounts.data?.find((account) => account.type !== 'other_liability')
    if (firstAccount && !form.getValues('sourceAccountId')) form.setValue('sourceAccountId', firstAccount.id)
  }, [accounts.data, form, open])

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const category = categories.data?.find((item) => item.id === values.categoryId)
      if (values.kind !== 'transfer' && category?.kind !== values.kind) throw new Error('Odabrana kategorija ne odgovara vrsti transakcije.')
      const payload = {
        kind: values.kind,
        amountCents: parseMoneyToCents(values.amount),
        description: values.description,
        occurredAt: localInputToIso(values.occurredAt),
        sourceAccountId: values.sourceAccountId,
        destinationAccountId: values.destinationAccountId || null,
        categoryId: values.categoryId || null,
        priority: values.kind === 'expense' ? values.priority as SpendingPriority : null,
        cardId: values.kind === 'expense' ? values.cardId || null : null,
        notes: values.notes || null
      }
      if (transaction) await update.mutateAsync({ ...payload, id: transaction.id })
      else await create.mutateAsync(payload)
      toast.success(transaction ? 'Transakcija je ažurirana.' : 'Transakcija je spremljena.')
      form.reset({ kind: 'expense', amount: '', description: '', occurredAt: localDateTimeInput(), sourceAccountId: values.sourceAccountId, destinationAccountId: '', categoryId: '', priority: 'essential', cardId: '', notes: '' })
      onOpenChange(false)
    } catch (error) {
      toast.error(errorMessage(error))
    }
  })

  const visibleCategories = categories.data?.filter((category) => category.kind === kind) ?? []
  const activeAccounts = accounts.data ?? []

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={transaction ? 'Uredi transakciju' : 'Nova transakcija'} description="Prihodi, troškovi i transferi knjiže se odmah i atomski.">
      <form onSubmit={onSubmit} className="grid gap-4">
        <div className="grid grid-cols-3 gap-2">
          {([['expense', 'Trošak'], ['income', 'Prihod'], ['transfer', 'Transfer']] as const).map(([value, label]) => (
            <button key={value} type="button" onClick={() => form.setValue('kind', value)} className={`rounded-xl border px-3 py-2.5 text-sm font-medium transition ${kind === value ? 'border-primary bg-primary/10 text-primary' : 'hover:bg-secondary'}`}>{label}</button>
          ))}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><Label htmlFor="amount">Iznos</Label><div className="relative"><Input id="amount" inputMode="decimal" placeholder="0,00" className="pr-12 text-lg font-semibold" {...form.register('amount')} /><span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">EUR</span></div><FieldError>{form.formState.errors.amount?.message}</FieldError></div>
          <div><Label htmlFor="occurredAt">Datum i vrijeme</Label><Input id="occurredAt" type="datetime-local" {...form.register('occurredAt')} /><FieldError>{form.formState.errors.occurredAt?.message}</FieldError></div>
        </div>
        <div><Label htmlFor="description">Opis</Label><Input id="description" placeholder={kind === 'expense' ? 'npr. Tjedna kupnja' : kind === 'income' ? 'npr. Plaća' : 'npr. Prijenos u štednju'} {...form.register('description')} /><FieldError>{form.formState.errors.description?.message}</FieldError></div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><Label htmlFor="sourceAccountId">{kind === 'transfer' ? 'S računa' : 'Račun'}</Label><Select id="sourceAccountId" {...form.register('sourceAccountId')}><option value="">Odaberite…</option>{activeAccounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</Select><FieldError>{form.formState.errors.sourceAccountId?.message}</FieldError></div>
          {kind === 'transfer' ? (
            <div><Label htmlFor="destinationAccountId">Na račun</Label><Select id="destinationAccountId" {...form.register('destinationAccountId')}><option value="">Odaberite…</option>{activeAccounts.filter((account) => account.id !== form.watch('sourceAccountId')).map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</Select><FieldError>{form.formState.errors.destinationAccountId?.message}</FieldError></div>
          ) : (
            <div><Label htmlFor="categoryId">Kategorija</Label><Select id="categoryId" {...form.register('categoryId')}><option value="">Odaberite…</option>{visibleCategories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</Select><FieldError>{form.formState.errors.categoryId?.message}</FieldError></div>
          )}
        </div>
        {kind === 'expense' && <div className="grid gap-4 sm:grid-cols-2"><div><Label htmlFor="priority">Prioritet</Label><Select id="priority" {...form.register('priority')}><option value="essential">Osnovne potrebe</option><option value="lifestyle">Životni stil</option><option value="discretionary">Razonoda i luksuz</option></Select></div><div><Label htmlFor="cardId">Kartica (neobavezno)</Label><Select id="cardId" {...form.register('cardId')}><option value="">Bez kartice</option>{(cards.data ?? []).map((card) => <option key={card.id} value={card.id}>{card.name}{card.last_four ? ` •••• ${card.last_four}` : ''}</option>)}</Select><p className="mt-1 text-xs text-muted-foreground">Povezana kartica određuje račun koji se tereti.</p></div></div>}
        <div><Label htmlFor="notes">Bilješka (neobavezno)</Label><Textarea id="notes" placeholder="Dodatni kontekst…" {...form.register('notes')} /></div>
        <div className="flex justify-end gap-3 pt-2"><Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Odustani</Button><Button type="submit" disabled={create.isPending || update.isPending}>{create.isPending || update.isPending ? 'Spremanje…' : transaction ? 'Spremi izmjene' : 'Spremi transakciju'}</Button></div>
      </form>
    </Dialog>
  )
}
