const currencyFormatter = new Intl.NumberFormat('hr-HR', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
})

const compactCurrencyFormatter = new Intl.NumberFormat('hr-HR', {
  style: 'currency',
  currency: 'EUR',
  notation: 'compact',
  maximumFractionDigits: 1
})

export function formatMoney(cents: number, compact = false): string {
  return (compact ? compactCurrencyFormatter : currencyFormatter).format(cents / 100)
}

export function parseMoneyToCents(raw: string): number {
  const normalized = raw.trim().replace(/\s/g, '').replace(/\./g, '').replace(',', '.')
  if (!/^\d+(\.\d{0,2})?$/.test(normalized)) throw new Error('Upišite ispravan iznos s najviše dvije decimale.')
  const [whole, decimals = ''] = normalized.split('.')
  const cents = Number.parseInt(whole, 10) * 100 + Number.parseInt(decimals.padEnd(2, '0') || '0', 10)
  if (!Number.isSafeInteger(cents) || cents <= 0) throw new Error('Iznos mora biti veći od nule.')
  return cents
}

export function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2).replace('.', ',')
}
