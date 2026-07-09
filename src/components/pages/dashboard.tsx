'use client'

import { useState, useEffect } from 'react'
import { useApi } from '@/lib/auth-context'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  TrendingUp, TrendingDown, DollarSign, Users, Receipt, Wallet,
  Banknote, AlertCircle, Activity, ArrowUpRight, ArrowDownRight,
} from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar, CartesianGrid,
} from 'recharts'
import { formatCurrency } from '@/lib/format'

export function DashboardPage() {
  const api = useApi()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/api/dashboard').then((d) => {
      setData(d)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  if (loading) return <div className="p-8 text-center text-muted-foreground">Loading dashboard...</div>
  if (!data) return <div className="p-8 text-center text-muted-foreground">No data</div>

  const trend = data.trend || []
  const methodData = Object.entries(data.today.byMethod || {}).map(([name, value]) => ({ name, value: value as number }))
  const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899']

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1">Real-time overview of today&apos;s operations</p>
        </div>
        <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
          <Activity className="w-3 h-3 mr-1" /> Live
        </Badge>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Billed Today" value={formatCurrency(data.today.totalBilled)} sub={`${data.today.billsCount} bills`} icon={Receipt} gradient="bg-brand-gradient" />
        <StatCard title="Collected Today" value={formatCurrency(data.today.totalCollected)} sub={`Refunds: ${formatCurrency(data.today.totalRefunds)}`} icon={Banknote} gradient="bg-brand-gradient-blue" />
        <StatCard title="Expenses Today" value={formatCurrency(data.today.totalExpenses)} sub="Across all categories" icon={Wallet} gradient="bg-brand-gradient-rose" />
        <StatCard title="Net Cash" value={formatCurrency(data.today.netCash)} sub="Collected − Refunds − Expenses" icon={DollarSign} gradient="bg-brand-gradient-amber" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MiniStat label="Total Patients" value={data.totals.patients} icon={Users} color="text-blue-600" />
        <MiniStat label="Referral Doctors" value={data.totals.doctors} icon={Users} color="text-emerald-600" />
        <MiniStat label="Staff Members" value={data.totals.staff} icon={Users} color="text-violet-600" />
        <MiniStat label="Outstanding Dues" value={formatCurrency(data.totals.totalDue)} icon={AlertCircle} color="text-amber-600" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-emerald-600" /> Revenue — Last 7 Days
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={trend}>
                <defs>
                  <linearGradient id="revGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                <XAxis dataKey="date" tickFormatter={(d) => d.slice(5)} tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} labelStyle={{ fontWeight: 600 }} contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb' }} />
                <Area type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2.5} fill="url(#revGradient)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Today by Method</CardTitle></CardHeader>
          <CardContent>
            {methodData.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-12">No collections yet today</p>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie data={methodData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={2} dataKey="value">
                    {methodData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => formatCurrency(v)} />
                </PieChart>
              </ResponsiveContainer>
            )}
            <div className="space-y-2 mt-2">
              {methodData.map((m, i) => (
                <div key={m.name} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                    <span className="capitalize">{m.name}</span>
                  </div>
                  <span className="font-medium">{formatCurrency(m.value)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Recent Bills</CardTitle></CardHeader>
        <CardContent>
          {(data.recentBills || []).length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No bills yet — create one from Billing</p>
          ) : (
            <div className="space-y-2">
              {data.recentBills.map((b: any) => (
                <div key={b.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors border border-border/50">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center">
                      <Receipt className="w-5 h-5 text-emerald-600" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{b.billNumber}</p>
                      <p className="text-xs text-muted-foreground">{b.patient?.name || '—'}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-sm">{formatCurrency(b.totalAmount)}</p>
                    <Badge variant="outline" className={
                      b.status === 'paid' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                      b.status === 'partial' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                      b.status === 'cancelled' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                      'bg-slate-50 text-slate-700 border-slate-200'
                    }>{b.status}</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function StatCard({ title, value, sub, icon: Icon, gradient }: {
  title: string; value: string; sub?: string;
  icon: React.ComponentType<{ className?: string }>; gradient: string
}) {
  return (
    <Card className="stat-card overflow-hidden border-0 shadow-md">
      <CardContent className="p-0">
        <div className={`${gradient} p-4 text-white`}>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="text-white/80 text-xs font-medium uppercase tracking-wider">{title}</p>
              <p className="text-2xl font-bold mt-1">{value}</p>
              {sub && <p className="text-white/70 text-xs mt-1">{sub}</p>}
            </div>
            <div className="w-10 h-10 rounded-lg bg-white/20 backdrop-blur flex items-center justify-center flex-shrink-0">
              <Icon className="w-5 h-5" />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function MiniStat({ label, value, icon: Icon, color }: {
  label: string; value: string | number;
  icon: React.ComponentType<{ className?: string }>; color: string
}) {
  return (
    <Card className="border-border/60">
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`w-9 h-9 rounded-lg bg-muted flex items-center justify-center ${color}`}>
          <Icon className="w-4 h-4" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-lg font-bold">{value}</p>
        </div>
      </CardContent>
    </Card>
  )
}
