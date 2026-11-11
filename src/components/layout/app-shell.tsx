import { useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { BarChart3, Landmark, LayoutDashboard, Menu, Moon, PiggyBank, Plus, ReceiptText, Settings, Sun, Target, WalletCards, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/providers/theme-provider'
import { Button } from '@/components/ui/button'
import { TransactionDialog } from '@/components/transactions/transaction-dialog'

const navigation = [
  { to: '/', label: 'Pregled', icon: LayoutDashboard },
  { to: '/accounts', label: 'Računi', icon: WalletCards },
  { to: '/transactions', label: 'Transakcije', icon: ReceiptText },
  { to: '/budgets', label: 'Budžet', icon: PiggyBank },
  { to: '/wealth', label: 'Štednja i ulaganja', icon: Target },
  { to: '/analytics', label: 'Analitika', icon: BarChart3 },
  { to: '/settings', label: 'Postavke', icon: Settings }
]

export function AppShell() {
  const [mobileMenu, setMobileMenu] = useState(false)
  const [transactionOpen, setTransactionOpen] = useState(false)
  const location = useLocation()
  const { theme, toggleTheme } = useTheme()

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r bg-card/80 p-4 backdrop-blur-xl lg:flex lg:flex-col">
        <div className="flex h-14 items-center gap-3 px-2"><div className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground"><Landmark className="size-5" /></div><div><p className="text-lg font-bold tracking-tight">FinTrack</p><p className="text-[10px] font-medium uppercase tracking-[.18em] text-muted-foreground">Osobne financije</p></div></div>
        <nav className="mt-8 grid gap-1">{navigation.map((item) => <NavItem key={item.to} {...item} />)}</nav>
        <div className="mt-auto grid gap-3"><Button onClick={() => setTransactionOpen(true)} className="w-full"><Plus className="size-4" />Nova transakcija</Button><button onClick={toggleTheme} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-muted-foreground transition hover:bg-secondary hover:text-foreground">{theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}{theme === 'dark' ? 'Svijetla tema' : 'Tamna tema'}</button></div>
      </aside>

      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-background/85 px-4 backdrop-blur-xl lg:hidden"><div className="flex items-center gap-2"><div className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground"><Landmark className="size-4" /></div><span className="font-bold">FinTrack</span></div><div className="flex items-center gap-1"><Button size="icon" variant="ghost" onClick={toggleTheme} aria-label="Promijeni temu">{theme === 'dark' ? <Sun className="size-5" /> : <Moon className="size-5" />}</Button><Button size="icon" variant="ghost" onClick={() => setMobileMenu(!mobileMenu)} aria-label="Otvori izbornik">{mobileMenu ? <X className="size-5" /> : <Menu className="size-5" />}</Button></div></header>
      {mobileMenu && <div className="fixed inset-x-3 top-19 z-40 rounded-2xl border bg-card p-3 shadow-2xl lg:hidden"><nav className="grid gap-1">{navigation.map((item) => <NavItem key={item.to} {...item} onClick={() => setMobileMenu(false)} />)}</nav></div>}

      <main className="min-h-screen px-4 pb-28 pt-5 md:px-7 md:pt-7 lg:ml-64 lg:px-9 lg:pb-10 lg:pt-9"><div key={location.pathname} className="mx-auto max-w-[1500px] animate-enter"><Outlet context={{ openTransaction: () => setTransactionOpen(true) }} /></div></main>

      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t bg-card/95 px-2 pt-2 backdrop-blur-xl lg:hidden">
        {navigation.slice(0, 2).map((item) => <MobileNavItem key={item.to} {...item} />)}
        <button onClick={() => setTransactionOpen(true)} className="flex flex-col items-center gap-1 text-[10px] font-medium text-primary"><span className="-mt-6 grid size-12 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-emerald-500/20"><Plus className="size-5" /></span><span>Dodaj</span></button>
        {navigation.slice(2, 4).map((item) => <MobileNavItem key={item.to} {...item} />)}
      </nav>
      <TransactionDialog open={transactionOpen} onOpenChange={setTransactionOpen} />
    </div>
  )
}

function NavItem({ to, label, icon: Icon, onClick }: (typeof navigation)[number] & { onClick?: () => void }) {
  return <NavLink to={to} onClick={onClick} end={to === '/'} className={({ isActive }) => cn('flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition', isActive ? 'bg-primary/12 text-primary' : 'text-muted-foreground hover:bg-secondary/70 hover:text-foreground')}><Icon className="size-[18px]" />{label}</NavLink>
}

function MobileNavItem({ to, label, icon: Icon }: (typeof navigation)[number]) {
  return <NavLink to={to} end={to === '/'} className={({ isActive }) => cn('flex min-h-12 flex-col items-center justify-center gap-1 text-[10px] font-medium', isActive ? 'text-primary' : 'text-muted-foreground')}><Icon className="size-5" /><span>{label}</span></NavLink>
}
