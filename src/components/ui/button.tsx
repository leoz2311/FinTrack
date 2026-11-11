import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import type { ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-all disabled:pointer-events-none disabled:opacity-50 active:scale-[.98]',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground shadow-sm hover:brightness-110',
        secondary: 'bg-secondary text-foreground hover:bg-secondary/75',
        outline: 'border bg-transparent hover:bg-secondary/70',
        ghost: 'hover:bg-secondary/70',
        destructive: 'bg-destructive text-white hover:brightness-110'
      },
      size: { default: 'h-10 px-4', sm: 'h-9 px-3', lg: 'h-12 px-5 text-base', icon: 'size-10 p-0' }
    },
    defaultVariants: { variant: 'default', size: 'default' }
  }
)

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> { asChild?: boolean }

export function Button({ className, variant, size, asChild, ...props }: ButtonProps) {
  const Component = asChild ? Slot : 'button'
  return <Component className={cn(buttonVariants({ variant, size }), className)} {...props} />
}
