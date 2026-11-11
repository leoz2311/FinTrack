import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface DialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  children: ReactNode
  className?: string
}

export function Dialog({ open, onOpenChange, title, description, children, className }: DialogProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm data-[state=open]:animate-in" />
        <DialogPrimitive.Content className={cn('fixed inset-x-3 top-1/2 z-50 max-h-[92vh] -translate-y-1/2 overflow-y-auto rounded-2xl border bg-card p-5 shadow-2xl sm:left-1/2 sm:right-auto sm:w-[min(94vw,600px)] sm:-translate-x-1/2 md:p-6', className)}>
          <div className="mb-5 pr-10">
            <DialogPrimitive.Title className="text-xl font-semibold">{title}</DialogPrimitive.Title>
            {description && <DialogPrimitive.Description className="mt-1 text-sm text-muted-foreground">{description}</DialogPrimitive.Description>}
          </div>
          {children}
          <DialogPrimitive.Close className="absolute right-4 top-4 rounded-lg p-2 text-muted-foreground transition hover:bg-secondary hover:text-foreground" aria-label="Zatvori">
            <X className="size-4" />
          </DialogPrimitive.Close>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
