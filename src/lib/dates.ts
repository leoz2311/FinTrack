import { format, subMonths } from 'date-fns'

export const APP_TIMEZONE = 'Europe/Zagreb'

export function localDateTimeInput(date = new Date()): string {
  const parts = new Intl.DateTimeFormat('sv-SE', {
    timeZone: APP_TIMEZONE,
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).formatToParts(date)
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${value.year}-${value.month}-${value.day}T${value.hour}:${value.minute}`
}

export function localInputToIso(value: string): string {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/)
  if (!match) throw new Error('Datum i vrijeme nisu ispravni.')
  const [, year, month, day, hour, minute, second = '00'] = match
  const wallClockUtc = Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second))
  let instant = wallClockUtc - timezoneOffsetMs(new Date(wallClockUtc), APP_TIMEZONE)
  instant = wallClockUtc - timezoneOffsetMs(new Date(instant), APP_TIMEZONE)
  return new Date(instant).toISOString()
}

export function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat('hr-HR', {
    timeZone: APP_TIMEZONE,
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value))
}

export function formatDate(value: string): string {
  return new Intl.DateTimeFormat('hr-HR', { timeZone: APP_TIMEZONE, dateStyle: 'medium' }).format(new Date(value))
}

export function currentMonthKey(date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: APP_TIMEZONE, year: 'numeric', month: '2-digit' }).format(date).slice(0, 7)
}

export function monthBounds(month: string): { from: string; to: string } {
  const [year, monthNumber] = month.split('-').map(Number)
  const next = monthNumber === 12 ? `${year + 1}-01` : `${year}-${String(monthNumber + 1).padStart(2, '0')}`
  const from = localInputToIso(`${month}-01T00:00`)
  const nextStart = localInputToIso(`${next}-01T00:00`)
  return { from, to: new Date(new Date(nextStart).valueOf() - 1).toISOString() }
}

export function previousMonthKey(month: string): string {
  return format(subMonths(new Date(`${month}-01T12:00:00`), 1), 'yyyy-MM')
}

export function localDateKey(value: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: APP_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value))
}

function timezoneOffsetMs(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(date)
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  const representedAsUtc = Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day), Number(values.hour), Number(values.minute), Number(values.second))
  return representedAsUtc - date.valueOf()
}
