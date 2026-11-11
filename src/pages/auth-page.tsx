import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Navigate } from 'react-router-dom'
import { toast } from 'sonner'
import { z } from 'zod'
import { ArrowRight, Landmark, LockKeyhole, ShieldCheck, TrendingUp } from 'lucide-react'
import { useAuth } from '@/providers/auth-provider'
import { requireSupabase } from '@/lib/supabase'
import { errorMessage } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { FieldError, Input, Label } from '@/components/ui/field'

const schema = z.object({ email: z.email('Upišite ispravnu e-mail adresu.'), password: z.string().min(8, 'Lozinka mora imati najmanje 8 znakova.') })
type Values = z.infer<typeof schema>

export function AuthPage() {
  const { user, configured } = useAuth()
  const [registering, setRegistering] = useState(false)
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { email: '', password: '' } })
  if (user) return <Navigate to="/" replace />

  const submit = form.handleSubmit(async (values) => {
    try {
      const client = requireSupabase()
      if (registering) {
        const { error } = await client.auth.signUp({ email: values.email, password: values.password })
        if (error) throw error
        toast.success('Račun je stvoren. Provjerite e-mail ako je potvrda uključena.')
      } else {
        const { error } = await client.auth.signInWithPassword(values)
        if (error) throw error
      }
    } catch (error) { toast.error(errorMessage(error)) }
  })

  return <div className="grid min-h-screen bg-background lg:grid-cols-[1.1fr_.9fr]">
    <section className="relative hidden overflow-hidden border-r p-12 lg:flex lg:flex-col lg:justify-between"><div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(52,211,153,.14),transparent_35%),radial-gradient(circle_at_70%_75%,rgba(59,130,246,.1),transparent_35%)]" /><div className="relative flex items-center gap-3"><div className="grid size-10 place-items-center rounded-xl bg-primary text-primary-foreground"><Landmark /></div><span className="text-xl font-bold">FinTrack</span></div><div className="relative max-w-2xl"><p className="mb-5 text-sm font-semibold uppercase tracking-[.18em] text-primary">Jasnoća za svaki euro</p><h1 className="text-5xl font-bold leading-[1.08] tracking-tight">Vaše financije.<br />Jedno mirno mjesto.</h1><p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">Privatno pratite račune, troškove, budžete, štednju i ulaganja — bez povezivanja s bankom i bez dvostrukog brojanja.</p><div className="mt-10 grid max-w-xl grid-cols-3 gap-4">{[[ShieldCheck, 'Privatno'], [TrendingUp, 'Precizno'], [LockKeyhole, 'Zaštićeno']].map(([Icon, label]) => <div key={String(label)} className="rounded-2xl border bg-card/60 p-4"><Icon className="mb-3 size-5 text-primary" /><p className="text-sm font-medium">{String(label)}</p></div>)}</div></div><p className="relative text-xs text-muted-foreground">EUR · Europe/Zagreb · ručni unos podataka</p></section>
    <section className="flex items-center justify-center p-5 sm:p-10"><div className="w-full max-w-md"><div className="mb-9 flex items-center gap-3 lg:hidden"><div className="grid size-10 place-items-center rounded-xl bg-primary text-primary-foreground"><Landmark /></div><span className="text-xl font-bold">FinTrack</span></div><p className="text-xs font-semibold uppercase tracking-[.16em] text-primary">{registering ? 'Novi privatni prostor' : 'Dobro došli natrag'}</p><h2 className="mt-2 text-3xl font-bold tracking-tight">{registering ? 'Stvorite svoj račun' : 'Prijavite se u FinTrack'}</h2><p className="mt-2 text-sm text-muted-foreground">{registering ? 'Podaci su vidljivi samo vašem korisničkom računu.' : 'Nastavite tamo gdje ste stali.'}</p>
      {!configured ? <div className="mt-8 rounded-2xl border border-amber-500/25 bg-amber-500/8 p-5"><p className="font-semibold text-amber-300">Supabase još nije konfiguriran</p><p className="mt-2 text-sm leading-relaxed text-muted-foreground">Kopirajte <code className="rounded bg-secondary px-1.5 py-0.5">.env.example</code> u <code className="rounded bg-secondary px-1.5 py-0.5">.env.local</code> i upišite URL projekta te javni anon ključ. Tajni service-role ključ nikada ne ide u preglednik.</p></div> : <form onSubmit={submit} className="mt-8 grid gap-5"><div><Label htmlFor="email">E-mail</Label><Input id="email" type="email" autoComplete="email" placeholder="ime@primjer.hr" {...form.register('email')} /><FieldError>{form.formState.errors.email?.message}</FieldError></div><div><Label htmlFor="password">Lozinka</Label><Input id="password" type="password" autoComplete={registering ? 'new-password' : 'current-password'} {...form.register('password')} /><FieldError>{form.formState.errors.password?.message}</FieldError></div><Button size="lg" type="submit" disabled={form.formState.isSubmitting}>{form.formState.isSubmitting ? 'Pričekajte…' : <>{registering ? 'Stvori račun' : 'Prijavi se'}<ArrowRight className="size-4" /></>}</Button></form>}
      {configured && <button onClick={() => setRegistering(!registering)} className="mt-6 text-sm text-muted-foreground transition hover:text-foreground">{registering ? 'Već imate račun? Prijavite se' : 'Nemate račun? Stvorite ga'}</button>}
    </div></section>
  </div>
}
