'use client'

import { useState, useEffect } from 'react'
import { useApi } from '@/lib/auth-context'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { toast } from 'sonner'
import { formatCurrency } from '@/lib/format'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'
import {
  TrendingUp, BarChart3, PieChart as PieIcon, Clock,
  Gauge, AlertCircle, Stethoscope, Loader2,
} from 'lucide-react'

const COLORS = ['#10b981', '#f59e0b', '#3b82f6', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316']

export function AnalyticsPage() {
  const api = useApi()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/api/analytics/dashboard').then((d) => { setData(d); setLoading(false) }).catch((e) => { toast.error(e.message); setLoading(false) })
  }, [])

  if (loading) return (
    <div className="flex items-center justify-center py-16 text-muted-foreground">
      <Loader2 className="w-5 h-5 mr-2 animate-spin" /> Loading analytics...
    </div>
  )
  if (!data) return <div className="p-8 text-center text-muted-foreground">No data available</div>

  const methodData = Object.entries(data.paymentMethodMix || {}).map(([name, value]) => ({ name, value: value as number }))
  const topTests = (data.topTests?.byRevenue || []).slice(0, 10)
  const peakHours = (data.peakHours || []).filter((h: any) => h.bills > 0)
  const efficiency = data.collectionEfficiency || { percentage: 0, billed: 0, collected: 0 }
  const aging = data.outstandingDuesAging || { zero30: 0, thirty60: 0, sixtyPlus: 0 }
  const doctors = (data.doctorWise || []).sort((a: any, b: any) => b.revenue - a.revenue)

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
          <p className="text-muted-foreground text-sm mt-1">Revenue, tests, payments, peaks, collections & doctor performance — last 30 days</p>
        </div>
        <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
          {data.period?.days || 30}-day window
        </Badge>
      </div>

      {/* Summary cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-brand-gradient text-white border-0"><CardContent className="p-4"><p className="text-xs opacity-80">Total Revenue</p><p className="text-2xl font-bold mt-1">{formatCurrency(data.summary?.totalRevenue || 0)}</p><p className="text-xs opacity-70 mt-1">{data.summary?.totalBills || 0} bills</p></CardContent></Card>
        <Card className="bg-brand-gradient-blue text-white border-0"><CardContent className="p-4"><p className="text-xs opacity-80">Total Billed</p><p className="text-2xl font-bold mt-1">{formatCurrency(data.summary?.totalBilled || 0)}</p><p className="text-xs opacity-70 mt-1">Gross billing</p></CardContent></Card>
        <Card className="bg-brand-gradient-amber text-white border-0"><CardContent className="p-4"><p className="text-xs opacity-80">Active Doctors</p><p className="text-2xl font-bold mt-1">{data.summary?.totalDoctors || 0}</p><p className="text-xs opacity-70 mt-1">{data.summary?.totalCommissionRules || 0} commission rules</p></CardContent></Card>
        <Card className="bg-brand-gradient-violet text-white border-0"><CardContent className="p-4"><p className="text-xs opacity-80">Collection Efficiency</p><p className="text-2xl font-bold mt-1">{efficiency.percentage.toFixed(1)}%</p><p className="text-xs opacity-70 mt-1">{formatCurrency(efficiency.collected)} / {formatCurrency(efficiency.billed)}</p></CardContent></Card>
      </div>

      {/* Revenue trend + Peak hours */}
      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><TrendingUp className="w-5 h-5 text-emerald-600" /> Revenue Trend — 30 Days</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={data.revenueTrend || []}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="billedGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                <XAxis dataKey="date" tickFormatter={(d) => d.slice(5)} tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} labelStyle={{ fontWeight: 600 }} contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb' }} />
                <Area type="monotone" dataKey="billed" stroke="#f59e0b" strokeWidth={1.5} fill="url(#billedGrad)" name="Billed" />
                <Area type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2.5} fill="url(#revGrad)" name="Collected" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Gauge className="w-5 h-5 text-violet-600" /> Collection Efficiency</CardTitle>
            <CardDescription>Collected vs billed (30 days)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="relative">
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={[{ name: 'efficiency', value: Math.min(100, efficiency.percentage) }]} layout="vertical" margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
                  <XAxis type="number" domain={[0, 100]} hide />
                  <YAxis type="category" dataKey="name" hide />
                  <Bar dataKey="value" radius={[8, 8, 8, 8]} background={{ fill: '#f3f4f6' }}>
                    <Cell fill={efficiency.percentage >= 80 ? '#10b981' : efficiency.percentage >= 60 ? '#f59e0b' : '#ef4444'} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <p className="text-3xl font-bold">{efficiency.percentage.toFixed(1)}%</p>
                <p className="text-xs text-muted-foreground">collected</p>
              </div>
            </div>
            <div className="mt-3 space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Billed</span><span className="font-semibold">{formatCurrency(efficiency.billed)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Collected</span><span className="font-semibold text-emerald-600">{formatCurrency(efficiency.collected)}</span></div>
              <div className="flex justify-between border-t pt-1"><span className="text-muted-foreground">Outstanding</span><span className="font-semibold text-amber-600">{formatCurrency(Math.max(0, efficiency.billed - efficiency.collected))}</span></div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top tests + Payment mix */}
      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><BarChart3 className="w-5 h-5 text-emerald-600" /> Top 10 Tests by Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            {topTests.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground text-sm">No test data for this period</p>
            ) : (
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={topTests} layout="vertical" margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                  <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb' }} />
                  <Bar dataKey="revenue" radius={[0, 6, 6, 0]} fill="#10b981" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><PieIcon className="w-5 h-5 text-amber-600" /> Payment Method Mix</CardTitle>
          </CardHeader>
          <CardContent>
            {methodData.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground text-sm">No payment data for this period</p>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie data={methodData} cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={2} dataKey="value">
                      {methodData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: number) => formatCurrency(v)} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-1.5 mt-2">
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
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Peak hours */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Clock className="w-5 h-5 text-blue-600" /> Peak Hour Analysis</CardTitle>
          <CardDescription>Bill count by hour of day (IST)</CardDescription>
        </CardHeader>
        <CardContent>
          {peakHours.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground text-sm">No bills in this period</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={data.peakHours}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                <XAxis dataKey="hour" tickFormatter={(h) => `${String(h).padStart(2, '0')}:00`} tick={{ fontSize: 11 }} interval={1} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip labelFormatter={(h) => `${String(h).padStart(2, '0')}:00 – ${String(Number(h) + 1).padStart(2, '0')}:00`} formatter={(v: number) => [`${v} bills`, 'Bills']} contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb' }} />
                <Bar dataKey="bills" radius={[4, 4, 0, 0]} fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Outstanding dues aging */}
      <div>
        <h2 className="text-lg font-semibold mb-2 flex items-center gap-2"><AlertCircle className="w-5 h-5 text-rose-600" /> Outstanding Dues Aging</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Card className="border-emerald-200 bg-emerald-50">
            <CardContent className="p-4">
              <p className="text-xs text-emerald-700 uppercase tracking-wide">0–30 days</p>
              <p className="text-2xl font-bold text-emerald-700 mt-1">{formatCurrency(aging.zero30 || 0)}</p>
              <p className="text-xs text-emerald-600 mt-1">Recent — likely collectible</p>
            </CardContent>
          </Card>
          <Card className="border-amber-200 bg-amber-50">
            <CardContent className="p-4">
              <p className="text-xs text-amber-700 uppercase tracking-wide">31–60 days</p>
              <p className="text-2xl font-bold text-amber-700 mt-1">{formatCurrency(aging.thirty60 || 0)}</p>
              <p className="text-xs text-amber-600 mt-1">Aging — follow up needed</p>
            </CardContent>
          </Card>
          <Card className="border-rose-200 bg-rose-50">
            <CardContent className="p-4">
              <p className="text-xs text-rose-700 uppercase tracking-wide">60+ days</p>
              <p className="text-2xl font-bold text-rose-700 mt-1">{formatCurrency(aging.sixtyPlus || 0)}</p>
              <p className="text-xs text-rose-600 mt-1">Stale — at risk of default</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Doctor-wise revenue */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Stethoscope className="w-5 h-5 text-violet-600" /> Doctor-wise Revenue</CardTitle>
          <CardDescription>Referral-driven revenue & commissions in the last 30 days</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {doctors.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground text-sm">No doctor-referred orders in this period</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Doctor</TableHead>
                    <TableHead>Specialization</TableHead>
                    <TableHead className="text-right">Patients</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                    <TableHead className="text-right">Commission</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {doctors.map((d: any) => (
                    <TableRow key={d.doctorId}>
                      <TableCell className="font-medium">{d.name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{d.specialization || '—'}</TableCell>
                      <TableCell className="text-right">{d.patients}</TableCell>
                      <TableCell className="text-right font-semibold text-emerald-700">{formatCurrency(d.revenue)}</TableCell>
                      <TableCell className="text-right text-amber-700">{formatCurrency(d.commission)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
