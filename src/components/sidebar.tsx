'use client'

import { useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard, Receipt, Wallet, Landmark, Users, UserCog,
  Stethoscope, Percent, Settings, LogOut, ChevronDown, Activity,
  FileText, Banknote, BookOpen, ShieldCheck, ScrollText, Menu, X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'

export type PageKey =
  | 'dashboard' | 'billing' | 'payments' | 'accounting' | 'expenses'
  | 'banking' | 'referrals' | 'commission' | 'doctor-ledger'
  | 'staff' | 'users' | 'role-permissions' | 'clinic' | 'audit-logs'
  | 'day-close'

interface NavItem {
  key: PageKey
  label: string
  icon: React.ComponentType<{ className?: string }>
  group: 'Operations' | 'Finance' | 'People' | 'Admin'
  permission?: string
  superAdminOnly?: boolean
}

const NAV: NavItem[] = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, group: 'Operations' },
  { key: 'billing', label: 'Billing', icon: Receipt, group: 'Operations', permission: '/billing' },
  { key: 'payments', label: 'Payments', icon: Banknote, group: 'Operations', permission: '/payments' },
  { key: 'day-close', label: 'Day Close', icon: ScrollText, group: 'Operations', permission: '/day-close' },

  { key: 'accounting', label: 'Accounting', icon: BookOpen, group: 'Finance', permission: '/accounting' },
  { key: 'expenses', label: 'Expenses', icon: Wallet, group: 'Finance', permission: '/expenses' },
  { key: 'banking', label: 'Banking', icon: Landmark, group: 'Finance', permission: '/banking' },
  { key: 'commission', label: 'Commission Report', icon: Percent, group: 'Finance', superAdminOnly: true },
  { key: 'doctor-ledger', label: 'Doctor Ledger', icon: FileText, group: 'Finance', superAdminOnly: true },

  { key: 'referrals', label: 'Referral Doctors', icon: Stethoscope, group: 'People', permission: '/doctors' },
  { key: 'staff', label: 'Staff', icon: Users, group: 'People', permission: '/staff' },
  { key: 'users', label: 'Users & Roles', icon: UserCog, group: 'People', superAdminOnly: true },

  { key: 'clinic', label: 'Clinic Settings', icon: Settings, group: 'Admin' },
  { key: 'role-permissions', label: 'Role Permissions', icon: ShieldCheck, group: 'Admin', superAdminOnly: true },
  { key: 'audit-logs', label: 'Audit Logs', icon: ScrollText, group: 'Admin', superAdminOnly: true },
]

const GROUPS: NavItem['group'][] = ['Operations', 'Finance', 'People', 'Admin']

export function Sidebar({
  page, onNavigate, isOpen, onClose,
}: {
  page: PageKey
  onNavigate: (p: PageKey) => void
  isOpen: boolean
  onClose: () => void
}) {
  const { user, logout } = useAuth()
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set(GROUPS))

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

  const toggleGroup = (g: string) => {
    setOpenGroups((prev) => {
      const next = new Set(prev)
      if (next.has(g)) next.delete(g)
      else next.add(g)
      return next
    })
  }

  return (
    <>
      {/* Mobile backdrop */}
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
        <div className="px-5 py-5 border-b border-sidebar-border bg-brand-gradient">
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
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {GROUPS.map((g) => {
            const items = NAV.filter((n) => n.group === g && canSee(n))
            if (items.length === 0) return null
            const open = openGroups.has(g)
            return (
              <div key={g} className="mb-2">
                <button
                  onClick={() => toggleGroup(g)}
                  className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/60 hover:text-sidebar-foreground"
                >
                  {g}
                  <ChevronDown className={cn('w-3.5 h-3.5 transition-transform', !open && '-rotate-90')} />
                </button>
                {open && (
                  <div className="space-y-0.5">
                    {items.map((item) => {
                      const Icon = item.icon
                      const active = page === item.key
                      return (
                        <button
                          key={item.key}
                          onClick={() => {
                            onNavigate(item.key)
                            onClose()
                          }}
                          className={cn(
                            'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all',
                            active
                              ? 'nav-active'
                              : 'text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                          )}
                        >
                          <Icon className="w-4 h-4 flex-shrink-0" />
                          <span className="truncate">{item.label}</span>
                          {item.superAdminOnly && (
                            <Badge variant="outline" className="ml-auto text-[10px] px-1.5 py-0 h-4 border-amber-400 text-amber-700">
                              SA
                            </Badge>
                          )}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </nav>

        {/* User footer */}
        <div className="border-t border-sidebar-border p-3 bg-sidebar">
          <div className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-sidebar-accent transition-colors">
            <Avatar className="w-9 h-9 border-2 border-sidebar-primary/30">
              {user.photoDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={user.photoDataUrl} alt={user.name} className="w-full h-full object-cover rounded-full" />
              ) : (
                <AvatarFallback className="bg-brand-gradient text-white text-sm font-semibold">
                  {user.name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()}
                </AvatarFallback>
              )}
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-sidebar-foreground truncate">{user.name}</p>
              <p className="text-xs text-sidebar-foreground/60 truncate">{user.normalizedRole}</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={logout}
              className="h-8 w-8 p-0 text-sidebar-foreground/60 hover:text-destructive hover:bg-destructive/10"
              title="Sign out"
            >
              <LogOut className="w-4 h-4" />
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
