import type { ReactNode } from 'react'

export function PageHeader({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description?: string; action?: ReactNode }) {
  return <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div>{eyebrow && <p className="mb-1 text-xs font-semibold uppercase tracking-[.16em] text-primary">{eyebrow}</p>}<h1 className="text-2xl font-bold tracking-tight md:text-3xl">{title}</h1>{description && <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>}</div>{action && <div className="shrink-0">{action}</div>}</div>
}
