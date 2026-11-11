import { useRef, useState } from 'react'
import { Archive, Database, Download, FileJson, FileSpreadsheet, LogOut, Moon, Plus, Sun, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import { financeKeys, useAccounts, useCategories, useTransactions } from '@/hooks/use-finance-data'
import { createBackup, downloadJson, exportExcel, exportMonthlyReport, exportTransactionsCsv, type FinTrackBackup } from '@/lib/exports'
import { currentMonthKey } from '@/lib/dates'
import { errorMessage } from '@/lib/utils'
import { requireSupabase } from '@/lib/supabase'
import { useTheme } from '@/providers/theme-provider'
import { useAuth } from '@/providers/auth-provider'
import type { CategoryKind, SpendingPriority } from '@/types/finance'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog } from '@/components/ui/dialog'
import { ErrorState, LoadingState } from '@/components/ui/states'
import { Input, Label, Select } from '@/components/ui/field'

const backupSchema = z.object({ schema_version: z.literal(1), exported_at: z.string(), app: z.literal('FinTrack'), accounts: z.array(z.unknown()), cards: z.array(z.unknown()), categories: z.array(z.unknown()), transactions: z.array(z.unknown()), budgets: z.array(z.unknown()), budget_allocations: z.array(z.unknown()), savings_goals: z.array(z.unknown()), investments: z.array(z.unknown()), investment_positions: z.array(z.unknown()), investment_valuations: z.array(z.unknown()), balance_snapshots: z.array(z.unknown()) })

export function SettingsPage() {
  const accounts = useAccounts(true)
  const transactions = useTransactions()
  const categories = useCategories(true)
  const { theme, setTheme } = useTheme()
  const { signOut, user } = useAuth()
  const [categoryOpen, setCategoryOpen] = useState(false)
  const [importPreview, setImportPreview] = useState<FinTrackBackup | null>(null)
  const [importing, setImporting] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  if (accounts.isLoading || transactions.isLoading || categories.isLoading) return <LoadingState />
  const queryError = accounts.error || transactions.error || categories.error
  if (queryError) return <ErrorState message={queryError.message} />

  const backup = async () => { try { downloadJson(await createBackup(), `fintrack-backup-${new Date().toISOString().slice(0, 10)}.json`); toast.success('JSON backup je preuzet.') } catch (error) { toast.error(errorMessage(error)) } }
  const readImport = async (file: File) => { try { const parsed = backupSchema.parse(JSON.parse(await file.text())) as FinTrackBackup; setImportPreview(parsed) } catch (error) { toast.error(`Datoteka nije valjan FinTrack backup: ${errorMessage(error)}`) } }

  return <div className="page-grid"><PageHeader eyebrow="Kontrola i privatnost" title="Postavke" description="Upravljajte izgledom, kategorijama i vlastitim kopijama podataka." />
    <section className="grid gap-4 lg:grid-cols-2"><Card><CardHeader><CardTitle>Izgled i lokalizacija</CardTitle></CardHeader><CardContent className="grid gap-5"><div><Label>Tema</Label><div className="grid grid-cols-2 gap-2"><button onClick={() => setTheme('dark')} className={`flex items-center justify-center gap-2 rounded-xl border p-3 text-sm font-medium ${theme === 'dark' ? 'border-primary bg-primary/10 text-primary' : ''}`}><Moon className="size-4" />Tamna</button><button onClick={() => setTheme('light')} className={`flex items-center justify-center gap-2 rounded-xl border p-3 text-sm font-medium ${theme === 'light' ? 'border-primary bg-primary/10 text-primary' : ''}`}><Sun className="size-4" />Svijetla</button></div></div><div className="grid grid-cols-2 gap-3"><SettingValue label="Valuta" value="EUR (€)" /><SettingValue label="Vremenska zona" value="Europe/Zagreb" /></div></CardContent></Card>
      <Card><CardHeader><CardTitle>Korisnički račun</CardTitle></CardHeader><CardContent><p className="text-sm text-muted-foreground">Prijavljeni ste kao</p><p className="mt-1 font-semibold">{user?.email}</p><div className="mt-5 rounded-xl bg-primary/8 p-3 text-xs leading-relaxed text-muted-foreground">Svi korisnički zapisi zaštićeni su RLS pravilima i vezani uz vaš Supabase korisnički ID.</div><Button className="mt-5" variant="outline" onClick={() => void signOut()}><LogOut className="size-4" />Odjavi se</Button></CardContent></Card></section>
    <Card><CardHeader className="flex-row items-center justify-between"><div><CardTitle>Kategorije</CardTitle><p className="mt-1 text-sm text-muted-foreground">Zadani prioritet predlaže se pri unosu troška, ali se može promijeniti.</p></div><Button size="sm" onClick={() => setCategoryOpen(true)}><Plus className="size-4" />Nova kategorija</Button></CardHeader><CardContent><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{categories.data?.filter((item) => !item.archived_at).map((category) => <CategoryRow key={category.id} category={category} />)}</div></CardContent></Card>
      <Card><CardHeader><CardTitle>Izvoz i sigurnosna kopija</CardTitle></CardHeader><CardContent><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><ExportAction icon={Download} title="Transakcije CSV" description="Jednostavan tablični izvoz." onClick={() => exportTransactionsCsv(transactions.data ?? [])} /><ExportAction icon={FileSpreadsheet} title="Excel izvoz" description="Računi i transakcije." onClick={() => void exportExcel(accounts.data ?? [], transactions.data ?? [])} /><ExportAction icon={FileSpreadsheet} title="Mjesečni izvještaj" description={`Izvještaj za ${currentMonthKey()}.`} onClick={() => void exportMonthlyReport(transactions.data ?? [], currentMonthKey())} /><ExportAction icon={FileJson} title="Puni JSON backup" description="Verzionirana kopija svih podataka." onClick={() => void backup()} /></div><div className="mt-5 flex flex-col gap-3 rounded-2xl border border-dashed p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-semibold">Uvoz sigurnosne kopije</p><p className="mt-1 text-xs text-muted-foreground">Najprije ćete vidjeti pregled; postojeći ID-jevi prepoznaju se kao duplikati i preskaču.</p></div><Button variant="outline" onClick={() => inputRef.current?.click()}><Upload className="size-4" />Odaberi JSON</Button><input ref={inputRef} type="file" accept="application/json,.json" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void readImport(file); event.target.value = '' }} /></div></CardContent></Card>
    <Card><CardHeader><CardTitle>Sigurnosna načela</CardTitle></CardHeader><CardContent className="grid gap-3 text-sm text-muted-foreground sm:grid-cols-3"><SecurityItem title="Nema bankovnih vjerodajnica" text="FinTrack V1 koristi isključivo ručni unos." /><SecurityItem title="Anon pristup je blokiran" text="Svaka poslovna tablica ima RLS i owner_id." /><SecurityItem title="Backup je vaš" text="Ne oslanjajte se samo na hostanu bazu; redovito preuzmite JSON kopiju." /></CardContent></Card>
    <CategoryDialog open={categoryOpen} onOpenChange={setCategoryOpen} />
    <ImportDialog backup={importPreview} currentTransactionIds={new Set(transactions.data?.map((tx) => tx.id))} importing={importing} onClose={() => setImportPreview(null)} onImport={async () => { if (!importPreview) return; try { setImporting(true); const { data, error } = await requireSupabase().rpc('import_fintrack_backup', { p_backup: importPreview }); if (error) throw error; toast.success(`Uvoz je završen. Uvezeno: ${data?.imported_transactions ?? 0}, preskočeno: ${data?.skipped_transactions ?? 0}.`); setImportPreview(null); location.reload() } catch (error) { toast.error(errorMessage(error)) } finally { setImporting(false) } }} />
  </div>
}

function SettingValue({ label, value }: { label: string; value: string }) { return <div className="rounded-xl bg-secondary/60 p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-sm font-semibold">{value}</p></div> }
function ExportAction({ icon: Icon, title, description, onClick }: { icon: typeof Download; title: string; description: string; onClick: () => void }) { return <button onClick={onClick} className="rounded-2xl border p-4 text-left transition hover:border-primary/40 hover:bg-primary/5"><Icon className="size-5 text-primary" /><p className="mt-4 text-sm font-semibold">{title}</p><p className="mt-1 text-xs text-muted-foreground">{description}</p></button> }
function SecurityItem({ title, text }: { title: string; text: string }) { return <div className="flex gap-3"><Database className="mt-0.5 size-4 shrink-0 text-primary" /><div><p className="font-medium text-foreground">{title}</p><p className="mt-1 text-xs leading-relaxed">{text}</p></div></div> }

function CategoryRow({ category }: { category: { id: string; name: string; kind: CategoryKind; default_priority: SpendingPriority | null; color: string } }) {
  const client = useQueryClient()
  const archive = async () => { if (!window.confirm(`Arhivirati kategoriju „${category.name}”? Postojeće transakcije ostaju sačuvane.`)) return; const { error } = await requireSupabase().from('categories').update({ archived_at: new Date().toISOString() }).eq('id', category.id); if (error) toast.error(error.message); else { toast.success('Kategorija je arhivirana.'); void client.invalidateQueries({ queryKey: financeKeys.categories }) } }
  return <div className="flex items-center gap-3 rounded-xl border p-3"><span className="size-3 rounded-full" style={{ background: category.color }} /><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{category.name}</p><p className="text-xs text-muted-foreground">{category.kind === 'income' ? 'Prihod' : category.default_priority === 'essential' ? 'Osnovne potrebe' : category.default_priority === 'lifestyle' ? 'Životni stil' : 'Razonoda i luksuz'}</p></div><Button variant="ghost" size="icon" onClick={() => void archive()} aria-label="Arhiviraj"><Archive className="size-4" /></Button></div>
}

function CategoryDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (value: boolean) => void }) {
  const [name, setName] = useState(''); const [kind, setKind] = useState<CategoryKind>('expense'); const [priority, setPriority] = useState<SpendingPriority>('lifestyle'); const [color, setColor] = useState('#34d399'); const [saving, setSaving] = useState(false); const client = useQueryClient()
  const submit = async () => { try { setSaving(true); const { error } = await requireSupabase().from('categories').insert({ name: name.trim(), kind, default_priority: kind === 'expense' ? priority : null, color, icon: 'circle' }); if (error) throw error; await client.invalidateQueries({ queryKey: financeKeys.categories }); toast.success('Kategorija je dodana.'); setName(''); onOpenChange(false) } catch (error) { toast.error(errorMessage(error)) } finally { setSaving(false) } }
  return <Dialog open={open} onOpenChange={onOpenChange} title="Nova kategorija"><div className="grid gap-4"><div><Label>Naziv</Label><Input value={name} onChange={(event) => setName(event.target.value)} /></div><div className="grid gap-4 sm:grid-cols-2"><div><Label>Vrsta</Label><Select value={kind} onChange={(event) => setKind(event.target.value as CategoryKind)}><option value="expense">Trošak</option><option value="income">Prihod</option></Select></div><div><Label>Boja</Label><Input type="color" value={color} onChange={(event) => setColor(event.target.value)} className="p-1" /></div></div>{kind === 'expense' && <div><Label>Zadani prioritet</Label><Select value={priority} onChange={(event) => setPriority(event.target.value as SpendingPriority)}><option value="essential">Osnovne potrebe</option><option value="lifestyle">Životni stil</option><option value="discretionary">Razonoda i luksuz</option></Select></div>}<div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => onOpenChange(false)}>Odustani</Button><Button onClick={submit} disabled={saving || !name.trim()}>Dodaj kategoriju</Button></div></div></Dialog>
}

function ImportDialog({ backup, currentTransactionIds, importing, onClose, onImport }: { backup: FinTrackBackup | null; currentTransactionIds: Set<string>; importing: boolean; onClose: () => void; onImport: () => Promise<void> }) {
  const duplicateCount = backup?.transactions.filter((item) => typeof item === 'object' && item && 'id' in item && currentTransactionIds.has(String(item.id))).length ?? 0
  return <Dialog open={Boolean(backup)} onOpenChange={(open) => { if (!open) onClose() }} title="Pregled uvoza" description="Provjerite sadržaj prije nego što se podaci zapišu."><div className="grid gap-4"><div className="grid grid-cols-2 gap-3 sm:grid-cols-4"><SettingValue label="Računi" value={String(backup?.accounts.length ?? 0)} /><SettingValue label="Transakcije" value={String(backup?.transactions.length ?? 0)} /><SettingValue label="Kategorije" value={String(backup?.categories.length ?? 0)} /><SettingValue label="Duplikati" value={String(duplicateCount)} /></div><div className="rounded-xl bg-secondary/60 p-4 text-sm"><p><strong>Izvezeno:</strong> {backup ? new Intl.DateTimeFormat('hr-HR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(backup.exported_at)) : ''}</p><p className="mt-2 text-xs text-muted-foreground">Zapisi s postojećim ID-jem preskaču se. Uvoz se izvršava u jednoj baznoj transakciji; pogreška poništava cijeli uvoz.</p></div><div className="flex justify-end gap-2"><Button variant="ghost" onClick={onClose}>Odustani</Button><Button onClick={() => void onImport()} disabled={importing}>{importing ? 'Uvoz…' : 'Potvrdi uvoz'}</Button></div></div></Dialog>
}
