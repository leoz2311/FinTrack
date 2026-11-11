import { AlertCircle, Inbox, LoaderCircle } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from './button'

export function LoadingState({ label = 'Učitavanje…' }: { label?: string }) {
  return <div className="flex min-h-48 items-center justify-center gap-3 text-sm text-muted-foreground"><LoaderCircle className="size-5 animate-spin text-primary" />{label}</div>
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return <div className="flex min-h-48 flex-col items-center justify-center gap-3 rounded-2xl border border-red-500/20 bg-red-500/5 p-8 text-center"><AlertCircle className="size-7 text-red-400" /><p className="max-w-md text-sm text-muted-foreground">{message}</p>{onRetry && <Button variant="outline" size="sm" onClick={onRetry}>Pokušaj ponovno</Button>}</div>
}

export function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return <div className="flex min-h-48 flex-col items-center justify-center rounded-2xl border border-dashed p-8 text-center"><div className="mb-3 rounded-2xl bg-secondary p-3"><Inbox className="size-6 text-muted-foreground" /></div><h3 className="font-semibold">{title}</h3><p className="mt-1 max-w-md text-sm text-muted-foreground">{description}</p>{action && <div className="mt-5">{action}</div>}</div>
}
