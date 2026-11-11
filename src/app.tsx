import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { LoaderCircle } from 'lucide-react'
import { useAuth } from '@/providers/auth-provider'
import { AppShell } from '@/components/layout/app-shell'

const AuthPage = lazy(() => import('@/pages/auth-page').then((module) => ({ default: module.AuthPage })))
const DashboardPage = lazy(() => import('@/pages/dashboard-page').then((module) => ({ default: module.DashboardPage })))
const AccountsPage = lazy(() => import('@/pages/accounts-page').then((module) => ({ default: module.AccountsPage })))
const AccountDetailPage = lazy(() => import('@/pages/account-detail-page').then((module) => ({ default: module.AccountDetailPage })))
const TransactionsPage = lazy(() => import('@/pages/transactions-page').then((module) => ({ default: module.TransactionsPage })))
const BudgetsPage = lazy(() => import('@/pages/budgets-page').then((module) => ({ default: module.BudgetsPage })))
const WealthPage = lazy(() => import('@/pages/wealth-page').then((module) => ({ default: module.WealthPage })))
const AnalyticsPage = lazy(() => import('@/pages/analytics-page').then((module) => ({ default: module.AnalyticsPage })))
const SettingsPage = lazy(() => import('@/pages/settings-page').then((module) => ({ default: module.SettingsPage })))

export default function App() {
  const { user, loading, configured } = useAuth()
  if (loading) return <div className="grid min-h-screen place-items-center"><div className="flex items-center gap-3 text-sm text-muted-foreground"><LoaderCircle className="size-5 animate-spin text-primary" />Provjera sigurne sesije…</div></div>
  return <Suspense fallback={<div className="grid min-h-48 place-items-center"><div className="flex items-center gap-3 text-sm text-muted-foreground"><LoaderCircle className="size-5 animate-spin text-primary" />Učitavanje stranice…</div></div>}><Routes><Route path="/auth" element={<AuthPage />} /><Route element={user && configured ? <AppShell /> : <Navigate to="/auth" replace />}><Route index element={<DashboardPage />} /><Route path="accounts" element={<AccountsPage />} /><Route path="accounts/:id" element={<AccountDetailPage />} /><Route path="transactions" element={<TransactionsPage />} /><Route path="budgets" element={<BudgetsPage />} /><Route path="wealth" element={<WealthPage />} /><Route path="analytics" element={<AnalyticsPage />} /><Route path="settings" element={<SettingsPage />} /></Route><Route path="*" element={<Navigate to={user ? '/' : '/auth'} replace />} /></Routes></Suspense>
}
