'use client'

import { useState } from 'react'
import { AuthProvider, useAuth } from '@/lib/auth-context'
import { LoginScreen } from '@/components/login-screen'
import { Sidebar, MobileMenuButton, PageKey } from '@/components/sidebar'
import { DashboardPage } from '@/components/pages/dashboard'
import { BillingPage } from '@/components/pages/billing'
import { AccountingPage, ExpensesPage } from '@/components/pages/accounting'
import { BankingPage } from '@/components/pages/banking'
import {
  ReferralsPage, CommissionPage, DoctorLedgerPage, StaffPage, UsersPage,
  RolePermissionsPage, ClinicPage, AuditLogsPage, DayClosePage,
} from '@/components/pages/management'
import { SuppliersPage } from '@/components/pages/suppliers'
import { ExpenseBillsPage } from '@/components/pages/expense-bills'
import { FormFPage } from '@/components/pages/form-f'
import { GstReportsPage, GlobalSearch } from '@/components/pages/extras'
import { InventoryPage } from '@/components/pages/inventory'
import { EmailSettingsPage, OnlineBookingsPage } from '@/components/pages/admin-pages'
import { ReportsPage } from '@/components/pages/reports'
import { PackagesPage } from '@/components/pages/packages'
import { AppointmentsPage, NotificationsPage, BranchesPage, WhatsAppSettingsPage } from '@/components/pages/ops-pages'
import { DailyCollectionPage, TdsReportsPage } from '@/components/pages/finance-reports'
import { SamplesPage, HomeCollectionPage, CorporatePage } from '@/components/pages/advanced-pages'
import { Button } from '@/components/ui/button'
import { Database, Sparkles } from 'lucide-react'
import { useApi } from '@/lib/auth-context'
import { toast } from 'sonner'
import { useEffect } from 'react'

function Shell() {
  const { user, isLoading } = useAuth()
  const [page, setPage] = useState<PageKey>('dashboard')
  const [sidebarOpen, setSidebarOpen] = useState(false)

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 mx-auto rounded-xl bg-brand-gradient animate-pulse mb-3" />
          <p className="text-muted-foreground text-sm">Loading Care ERP...</p>
        </div>
      </div>
    )
  }

  if (!user) return <LoginScreen />

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-emerald-50/30 via-background to-amber-50/20">
      <Sidebar page={page} onNavigate={setPage} isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <main className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-30 bg-background/80 backdrop-blur border-b border-border px-4 py-3 flex items-center gap-3 lg:px-6">
          <MobileMenuButton onClick={() => setSidebarOpen(true)} />
          <GlobalSearch onNavigate={setPage} />
          <div className="flex-1" />
          <SeedButton />
        </header>
        <div className="flex-1 p-4 lg:p-6 max-w-[1600px] w-full mx-auto">
          <PageRouter page={page} />
        </div>
      </main>
    </div>
  )
}

function SeedButton() {
  const api = useApi()
  const [seeding, setSeeding] = useState(false)
  const [done, setDone] = useState(false)

  // Auto-seed once on first login
  useEffect(() => {
    api.get('/api/dashboard').then(async (d) => {
      if (!d.totals || (d.totals.patients === 0 && d.totals.doctors === 0)) {
        setSeeding(true)
        try {
          await api.post('/api/seed-demo')
          setDone(true)
          toast.success('Demo data seeded — start exploring!')
        } catch (e: any) {
          // silent
        } finally { setSeeding(false) }
      }
    }).catch(() => {})
  }, [])

  if (done) return null
  return (
    <Button
      size="sm"
      variant="outline"
      onClick={async () => {
        setSeeding(true)
        try {
          await api.post('/api/seed-demo')
          toast.success('Demo data seeded')
          window.location.reload()
        } catch (e: any) { toast.error(e.message) } finally { setSeeding(false) }
      }}
      disabled={seeding}
      className="border-amber-300 text-amber-700 hover:bg-amber-50"
    >
      <Sparkles className="w-3.5 h-3.5 mr-1.5" />
      {seeding ? 'Seeding...' : 'Seed Demo Data'}
    </Button>
  )
}

function PageRouter({ page }: { page: PageKey }) {
  switch (page) {
    case 'dashboard': return <DashboardPage />
    case 'billing': return <BillingPage />
    case 'accounting': return <AccountingPage />
    case 'expenses': return <ExpensesPage />
    case 'banking': return <BankingPage />
    case 'referrals': return <ReferralsPage />
    case 'commission': return <CommissionPage />
    case 'doctor-ledger': return <DoctorLedgerPage />
    case 'staff': return <StaffPage />
    case 'users': return <UsersPage />
    case 'role-permissions': return <RolePermissionsPage />
    case 'clinic': return <ClinicPage />
    case 'audit-logs': return <AuditLogsPage />
    case 'day-close': return <DayClosePage />
    case 'expense-bills': return <ExpenseBillsPage />
    case 'suppliers': return <SuppliersPage />
    case 'form-f': return <FormFPage />
    case 'gst-reports': return <GstReportsPage />
    case 'inventory': return <InventoryPage />
    case 'email-settings': return <EmailSettingsPage />
    case 'online-bookings': return <OnlineBookingsPage />
    case 'reports': return <ReportsPage />
    case 'packages': return <PackagesPage />
    case 'appointments': return <AppointmentsPage />
    case 'notifications': return <NotificationsPage />
    case 'branches': return <BranchesPage />
    case 'whatsapp-settings': return <WhatsAppSettingsPage />
    case 'daily-collection': return <DailyCollectionPage />
    case 'tds-reports': return <TdsReportsPage />
    case 'samples': return <SamplesPage />
    case 'home-collection': return <HomeCollectionPage />
    case 'corporates': return <CorporatePage />
    default: return <DashboardPage />
  }
}

export default function Home() {
  return (
    <AuthProvider>
      <Shell />
    </AuthProvider>
  )
}
