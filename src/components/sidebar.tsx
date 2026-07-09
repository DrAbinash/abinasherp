'use client'

import { useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard, Receipt, Wallet, Landmark, Users, UserCog,
  Stethoscope, Percent, Settings, LogOut, ChevronDown, ChevronRight, Activity,
  FileText, Banknote, BookOpen, ShieldCheck, ScrollText, Menu, X,
  ScanLine, Building2, FileBarChart, Search, FileCheck2,
  FlaskConical, Calendar, Package, MessageSquare, Network, Mail, Globe,
  TestTube2, Home, Briefcase, Wrench, Gift, KeyRound, Database,
  BarChart3, UserSearch, TrendingUp, ClipboardCheck, Bot, Languages,
  CalendarClock,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'

export type PageKey =
  | 'dashboard' | 'billing' | 'payments' | 'accounting' | 'expenses'
  | 'banking' | 'referrals' | 'commission' | 'doctor-ledger'
  | 'staff' | 'users' | 'role-permissions' | 'clinic' | 'audit-logs'
  | 'day-close' | 'expense-bills' | 'suppliers' | 'form-f' | 'gst-reports'
  | 'reports' | 'packages' | 'inventory' | 'appointments' | 'notifications' | 'branches'
  | 'email-settings' | 'online-bookings'
  | 'whatsapp-settings' | 'daily-collection' | 'tds-reports'
  | 'samples' | 'home-collection' | 'corporates'
  | 'equipment' | 'loyalty' | 'approvals' | 'api-keys' | 'nabl' | 'backup'
  | 'analytics' | 'patient-360' | 'referral-analytics' | 'compliance'
  | 'whatsapp-chatbot' | 'translations'

interface NavItem {
  key: PageKey
  label: string
  icon: React.ComponentType<{ className?: string }>
  permission?: string
  superAdminOnly?: boolean
}

interface NavSubGroup {
  label: string
  icon: React.ComponentType<{ className?: string }>
  items: NavItem[]
}

interface NavGroup {
  label: string
  directItems?: NavItem[]
  subGroups?: NavSubGroup[]
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Operations',
    directItems: [
      { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { key: 'billing', label: 'Billing', icon: Receipt, permission: '/billing' },
    ],
    subGroups: [
      {
        label: 'Scheduling',
        icon: CalendarClock,
        items: [
          { key: 'appointments', label: 'Appointments', icon: Calendar },
          { key: 'home-collection', label: 'Home Collection', icon: Home },
          { key: 'samples', label: 'Sample Tracking', icon: TestTube2 },
        ],
      },
      {
        label: 'Tests & Reports',
        icon: FlaskConical,
        items: [
          { key: 'packages', label: 'Health Packages', icon: Package },
          { key: 'reports', label: 'Lab Reports', icon: FileText },
          { key: 'expense-bills', label: 'Bill Scanning (OCR)', icon: ScanLine, permission: '/expenses' },
          { key: 'form-f', label: 'Form F (PCPNDT)', icon: FileCheck2 },
        ],
      },
      {
        label: 'Cashier',
        icon: Banknote,
        items: [
          { key: 'payments', label: 'Payments', icon: Banknote, permission: '/payments' },
          { key: 'day-close', label: 'Day Close', icon: ScrollText, permission: '/day-close' },
        ],
      },
    ],
  },
  {
    label: 'Finance',
    directItems: [
      { key: 'accounting', label: 'Accounting', icon: BookOpen, permission: '/accounting' },
      { key: 'banking', label: 'Banking', icon: Landmark, permission: '/banking' },
      { key: 'expenses', label: 'Expenses', icon: Wallet, permission: '/expenses' },
    ],
    subGroups: [
      {
        label: 'Analytics & Reports',
        icon: BarChart3,
        items: [
          { key: 'analytics', label: 'Analytics Dashboard', icon: BarChart3, superAdminOnly: true },
          { key: 'daily-collection', label: 'Daily Collection', icon: FileBarChart, superAdminOnly: true },
          { key: 'referral-analytics', label: 'Referral Analytics', icon: TrendingUp, superAdminOnly: true },
        ],
      },
      {
        label: 'Commission & Tax',
        icon: Percent,
        items: [
          { key: 'commission', label: 'Commission Report', icon: Percent, superAdminOnly: true },
          { key: 'doctor-ledger', label: 'Doctor Ledger', icon: FileText, superAdminOnly: true },
          { key: 'gst-reports', label: 'GST Reports', icon: FileBarChart, superAdminOnly: true },
          { key: 'tds-reports', label: 'TDS Reports', icon: FileBarChart, superAdminOnly: true },
        ],
      },
      {
        label: 'Corporate & Loyalty',
        icon: Briefcase,
        items: [
          { key: 'corporates', label: 'Corporate / TPA', icon: Briefcase, superAdminOnly: true },
          { key: 'loyalty', label: 'Loyalty Program', icon: Gift },
        ],
      },
    ],
  },
  {
    label: 'People',
    directItems: [
      { key: 'referrals', label: 'Referral Doctors', icon: Stethoscope, permission: '/doctors' },
      { key: 'patient-360', label: 'Patient 360°', icon: UserSearch },
    ],
    subGroups: [
      {
        label: 'Staff & Access',
        icon: Users,
        items: [
          { key: 'staff', label: 'Staff', icon: Users, permission: '/staff' },
          { key: 'users', label: 'Users & Roles', icon: UserCog, superAdminOnly: true },
          { key: 'role-permissions', label: 'Role Permissions', icon: ShieldCheck, superAdminOnly: true },
        ],
      },
      {
        label: 'Resources',
        icon: FlaskConical,
        items: [
          { key: 'inventory', label: 'Inventory', icon: FlaskConical },
          { key: 'equipment', label: 'Equipment', icon: Wrench },
          { key: 'suppliers', label: 'Suppliers', icon: Building2, permission: '/expenses' },
        ],
      },
    ],
  },
  {
    label: 'Admin',
    directItems: [
      { key: 'clinic', label: 'Clinic Settings', icon: Settings },
    ],
    subGroups: [
      {
        label: 'Communications',
        icon: MessageSquare,
        items: [
          { key: 'email-settings', label: 'Email & SMTP', icon: Mail, superAdminOnly: true },
          { key: 'whatsapp-settings', label: 'WhatsApp', icon: MessageSquare, superAdminOnly: true },
          { key: 'whatsapp-chatbot', label: 'WhatsApp Chatbot', icon: Bot, superAdminOnly: true },
          { key: 'notifications', label: 'Notifications Log', icon: MessageSquare, superAdminOnly: true },
        ],
      },
      {
        label: 'Security & Access',
        icon: ShieldCheck,
        items: [
          { key: 'approvals', label: 'Discount Approvals', icon: ShieldCheck, superAdminOnly: true },
          { key: 'api-keys', label: 'API Keys', icon: KeyRound, superAdminOnly: true },
          { key: 'audit-logs', label: 'Audit Logs', icon: ScrollText, superAdminOnly: true },
        ],
      },
      {
        label: 'System',
        icon: Database,
        items: [
          { key: 'backup', label: 'Backup & Restore', icon: Database, superAdminOnly: true },
          { key: 'online-bookings', label: 'Online Bookings', icon: Globe, superAdminOnly: true },
          { key: 'compliance', label: 'NABL / PCPNDT', icon: ClipboardCheck, superAdminOnly: true },
          { key: 'branches', label: 'Branches', icon: Network, superAdminOnly: true },
          { key: 'translations', label: 'Translations', icon: Languages, superAdminOnly: true },
        ],
      },
    ],
  },
]

export function Sidebar({
  page, onNavigate, isOpen, onClose,
}: {
  page: PageKey
  onNavigate: (p: PageKey) => void
  isOpen: boolean
  onClose: () => void
}) {
  const { user, logout } = useAuth()
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set(NAV_GROUPS.map((g) => g.label)))
  const [openSubGroups, setOpenSubGroups] = useState<Set<string>>(new Set())

  if (!user) return null

  const isOwner = user.normalizedRole === 'admin' || user.normalizedRole === 'super_admin'

  const canSee = (item: NavItem) => {
    if (item.superAdminOnly && !isOwner) return false
    if (isOwner) return true
    if (user.permissions.includes('*')) return true
    if (!item.permission) return true
    if (user.permissions.includes(item.permission)) return true
    if (user.permissions.some((p) => p.startsWith(item.permission! + ':'))) return true
    return false
  }

  const canSeeSubGroup = (sg: NavSubGroup) => sg.items.some(canSee)

  const toggleGroup = (g: string) => {
    setOpenGroups((prev) => {
      const next = new Set(prev)
      if (next.has(g)) next.delete(g)
      else next.add(g)
      return next
    })
  }

  const toggleSubGroup = (key: string) => {
    setOpenSubGroups((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  // Auto-expand sub-group containing the active page
  const autoExpandActive = () => {
    for (const group of NAV_GROUPS) {
      for (const sg of group.subGroups || []) {
        if (sg.items.some((i) => i.key === page)) {
          const key = `${group.label}-${sg.label}`
          if (!openSubGroups.has(key)) {
            setOpenSubGroups((prev) => new Set(prev).add(key))
          }
          return
        }
      }
    }
  }
  // Call once on mount
  if (typeof window !== 'undefined') {
    requestAnimationFrame(autoExpandActive)
  }

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={cn(
          'fixed lg:sticky top-0 left-0 z-50 lg:z-auto',
          'w-72 h-screen bg-sidebar border-r border-sidebar-border',
          'flex flex-col transition-transform duration-300',
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        )}
      >
        {/* Brand header */}
        <div className="px-5 py-4 border-b border-sidebar-border bg-brand-gradient">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center">
              <Activity className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-white font-bold text-lg leading-tight">Care ERP</h1>
              <p className="text-white/80 text-xs">Enterprise Edition</p>
            </div>
            <button
              onClick={onClose}
              className="ml-auto lg:hidden text-white/80 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-2 py-3">
          {NAV_GROUPS.map((group) => {
            const directItems = (group.directItems || []).filter(canSee)
            const subGroups = (group.subGroups || []).filter(canSeeSubGroup)
            if (directItems.length === 0 && subGroups.length === 0) return null

            const groupOpen = openGroups.has(group.label)

            return (
              <div key={group.label} className="mb-1">
                {/* Group header */}
                <button
                  onClick={() => toggleGroup(group.label)}
                  className="w-full flex items-center justify-between px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-sidebar-foreground/50 hover:text-sidebar-foreground/80"
                >
                  {group.label}
                  <ChevronDown className={cn('w-3 h-3 transition-transform', !groupOpen && '-rotate-90')} />
                </button>

                {groupOpen && (
                  <div className="space-y-0.5 mt-0.5">
                    {/* Direct items */}
                    {directItems.map((item) => {
                      const Icon = item.icon
                      const active = page === item.key
                      return (
                        <button
                          key={item.key}
                          onClick={() => { onNavigate(item.key); onClose() }}
                          className={cn(
                            'w-full flex items-center gap-2.5 px-3 py-1.5 rounded-md text-[13px] font-medium transition-all',
                            active
                              ? 'nav-active'
                              : 'text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                          )}
                        >
                          <Icon className="w-4 h-4 flex-shrink-0" />
                          <span className="truncate">{item.label}</span>
                        </button>
                      )
                    })}

                    {/* Sub-groups */}
                    {subGroups.map((sg) => {
                      const sgKey = `${group.label}-${sg.label}`
                      const sgOpen = openSubGroups.has(sgKey)
                      const SgIcon = sg.icon
                      const items = sg.items.filter(canSee)
                      if (items.length === 0) return null

                      // Check if any item in this sub-group is active
                      const hasActive = items.some((i) => i.key === page)

                      return (
                        <div key={sgKey} className="mt-0.5">
                          <button
                            onClick={() => toggleSubGroup(sgKey)}
                            className={cn(
                              'w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-[12px] font-medium transition-all',
                              hasActive
                                ? 'text-sidebar-primary'
                                : 'text-sidebar-foreground/60 hover:text-sidebar-foreground/90 hover:bg-sidebar-accent/50',
                            )}
                          >
                            <SgIcon className="w-3.5 h-3.5 flex-shrink-0" />
                            <span className="truncate flex-1 text-left">{sg.label}</span>
                            {hasActive && <span className="w-1.5 h-1.5 rounded-full bg-sidebar-primary" />}
                            <ChevronRight className={cn('w-3 h-3 transition-transform', sgOpen && 'rotate-90')} />
                          </button>
                          {sgOpen && (
                            <div className="ml-4 border-l border-sidebar-border/60 pl-1 mt-0.5 space-y-0.5">
                              {items.map((item) => {
                                const Icon = item.icon
                                const active = page === item.key
                                return (
                                  <button
                                    key={item.key}
                                    onClick={() => { onNavigate(item.key); onClose() }}
                                    className={cn(
                                      'w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[12px] font-medium transition-all',
                                      active
                                        ? 'nav-active'
                                        : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                                    )}
                                  >
                                    <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                                    <span className="truncate">{item.label}</span>
                                  </button>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </nav>

        {/* User footer */}
        <div className="border-t border-sidebar-border p-2.5 bg-sidebar">
          <div className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-sidebar-accent transition-colors">
            <Avatar className="w-8 h-8 border-2 border-sidebar-primary/30">
              {user.photoDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={user.photoDataUrl} alt={user.name} className="w-full h-full object-cover rounded-full" />
              ) : (
                <AvatarFallback className="bg-brand-gradient text-white text-xs font-semibold">
                  {user.name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()}
                </AvatarFallback>
              )}
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-medium text-sidebar-foreground truncate">{user.name}</p>
              <p className="text-[10px] text-sidebar-foreground/60 truncate">{user.normalizedRole}</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={logout}
              className="h-7 w-7 p-0 text-sidebar-foreground/50 hover:text-destructive hover:bg-destructive/10"
              title="Sign out"
            >
              <LogOut className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </aside>
    </>
  )
}

export function MobileMenuButton({ onClick }: { onClick: () => void }) {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onClick}
      className="lg:hidden"
    >
      <Menu className="w-5 h-5" />
    </Button>
  )
}
