import type { InputHTMLAttributes, LabelHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export function Label({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn('mb-1.5 block text-sm font-medium text-foreground', className)} {...props} />
}
export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn('h-11 w-full rounded-xl border bg-background/70 px-3 text-sm placeholder:text-muted-foreground/70 focus:border-primary focus:ring-1 focus:ring-primary', className)} {...props} />
}
export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn('h-11 w-full rounded-xl border bg-background/70 px-3 text-sm focus:border-primary focus:ring-1 focus:ring-primary', className)} {...props} />
}
export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn('min-h-24 w-full resize-y rounded-xl border bg-background/70 px-3 py-2.5 text-sm placeholder:text-muted-foreground/70 focus:border-primary focus:ring-1 focus:ring-primary', className)} {...props} />
}
export function FieldError({ children }: { children?: string }) {
  if (!children) return null
  return <p className="mt-1 text-xs text-red-400">{children}</p>
}
