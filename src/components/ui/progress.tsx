import { cn } from '@/lib/utils'

export function Progress({ value, className, indicatorClassName }: { value: number; className?: string; indicatorClassName?: string }) {
  const safe = Math.max(0, Math.min(value, 100))
  return <div className={cn('h-2 overflow-hidden rounded-full bg-secondary', className)}><div className={cn('h-full rounded-full bg-primary transition-all duration-500', indicatorClassName)} style={{ width: `${safe}%` }} /></div>
}
