import ExcelJS from 'exceljs'
import { requireSupabase } from './supabase'
import { formatMoney } from './money'
import type { Account, Transaction } from '@/types/finance'
import { transactionAmount } from './finance'
import { localDateKey } from './dates'

export interface FinTrackBackup {
  schema_version: 1
  exported_at: string
  app: 'FinTrack'
  accounts: unknown[]
  cards: unknown[]
  categories: unknown[]
  transactions: unknown[]
  budgets: unknown[]
  budget_allocations: unknown[]
  savings_goals: unknown[]
  investments: unknown[]
  investment_positions: unknown[]
  investment_valuations: unknown[]
  balance_snapshots: unknown[]
}

const backupTables = ['accounts', 'cards', 'categories', 'budgets', 'budget_allocations', 'savings_goals', 'investments', 'investment_positions', 'investment_valuations', 'balance_snapshots'] as const

export async function createBackup(): Promise<FinTrackBackup> {
  const client = requireSupabase()
  const results = await Promise.all(backupTables.map(async (table) => {
    const { data, error } = await client.from(table).select('*')
    if (error) throw error
    return [table, data ?? []] as const
  }))
  const { data: transactions, error } = await client.from('transactions').select('*, transaction_entries(*)').order('occurred_at')
  if (error) throw error
  return {
    schema_version: 1,
    exported_at: new Date().toISOString(),
    app: 'FinTrack',
    ...(Object.fromEntries(results) as Pick<FinTrackBackup, typeof backupTables[number]>),
    transactions: transactions ?? []
  }
}

export function downloadJson(data: unknown, filename: string) {
  downloadBlob(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), filename)
}

export function exportTransactionsCsv(transactions: Transaction[]) {
  const header = ['Datum', 'Vrsta', 'Opis', 'Kategorija', 'Prioritet', 'Iznos EUR', 'Bilješka']
  const rows = transactions.map((tx) => [tx.occurred_at, tx.kind, tx.description, tx.categories?.name ?? '', tx.priority ?? '', (transactionAmount(tx) / 100).toFixed(2), tx.notes ?? ''])
  const content = '\ufeff' + [header, ...rows].map((row) => row.map(csvCell).join(';')).join('\r\n')
  downloadBlob(new Blob([content], { type: 'text/csv;charset=utf-8' }), `fintrack-transakcije-${dateStamp()}.csv`)
}

export async function exportExcel(accounts: Account[], transactions: Transaction[]) {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'FinTrack'
  const transactionSheet = workbook.addWorksheet('Transakcije')
  transactionSheet.columns = [
    { header: 'Datum', key: 'date', width: 24 }, { header: 'Vrsta', key: 'type', width: 16 }, { header: 'Opis', key: 'description', width: 35 },
    { header: 'Kategorija', key: 'category', width: 22 }, { header: 'Prioritet', key: 'priority', width: 20 }, { header: 'Iznos (EUR)', key: 'amount', width: 16 }, { header: 'Bilješka', key: 'notes', width: 35 }
  ]
  transactions.forEach((tx) => transactionSheet.addRow({ date: tx.occurred_at, type: tx.kind, description: tx.description, category: tx.categories?.name ?? '', priority: tx.priority ?? '', amount: transactionAmount(tx) / 100, notes: tx.notes ?? '' }))
  const accountSheet = workbook.addWorksheet('Računi')
  accountSheet.columns = [{ header: 'Naziv', key: 'name', width: 28 }, { header: 'Vrsta', key: 'type', width: 20 }, { header: 'Početno stanje (EUR)', key: 'opening', width: 22 }, { header: 'Saldo (EUR)', key: 'balance', width: 18 }, { header: 'Arhiviran', key: 'archived', width: 12 }]
  accounts.forEach((account) => accountSheet.addRow({ name: account.name, type: account.type, opening: account.opening_balance_cents / 100, balance: account.balance_cents / 100, archived: account.archived_at ? 'Da' : 'Ne' }))
  styleWorkbook(workbook)
  await downloadWorkbook(workbook, `fintrack-izvoz-${dateStamp()}.xlsx`)
}

export async function exportMonthlyReport(transactions: Transaction[], month: string) {
  const selected = transactions.filter((tx) => localDateKey(tx.occurred_at).slice(0, 7) === month)
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet(`Izvještaj ${month}`)
  sheet.columns = [{ header: 'Datum', key: 'date', width: 24 }, { header: 'Vrsta', key: 'type', width: 16 }, { header: 'Opis', key: 'description', width: 35 }, { header: 'Kategorija', key: 'category', width: 22 }, { header: 'Iznos', key: 'amount', width: 18 }]
  selected.forEach((tx) => sheet.addRow({ date: tx.occurred_at, type: tx.kind, description: tx.description, category: tx.categories?.name ?? '', amount: formatMoney(transactionAmount(tx)) }))
  styleWorkbook(workbook)
  await downloadWorkbook(workbook, `fintrack-mjesecni-izvjestaj-${month}.xlsx`)
}

function csvCell(value: unknown) { return `"${String(value).replace(/"/g, '""')}"` }
function dateStamp() { return new Date().toISOString().slice(0, 10) }
function downloadBlob(blob: Blob, filename: string) { const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000) }
function styleWorkbook(workbook: ExcelJS.Workbook) { workbook.eachSheet((sheet) => { const row = sheet.getRow(1); row.font = { bold: true, color: { argb: 'FFFFFFFF' } }; row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F766E' } }; row.alignment = { vertical: 'middle' }; sheet.views = [{ state: 'frozen', ySplit: 1 }]; sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: sheet.columnCount } } }) }
async function downloadWorkbook(workbook: ExcelJS.Workbook, filename: string) { const buffer = await workbook.xlsx.writeBuffer(); downloadBlob(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), filename) }
