'use client'

import { useState, useEffect } from 'react'
import { useApi } from '@/lib/auth-context'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { toast } from 'sonner'
import { formatCurrency } from '@/lib/format'
import {
  Stethoscope, Users, TrendingUp, IndianRupee, Percent,
  Loader2, ArrowUpDown,
} from 'lucide-react'

type SortKey = 'patientsReferred' | 'patientsVisited' | 'conversionRate' | 'revenueFromReferred' | 'commissionPaid' | 'name'

export function ReferralAnalyticsPage() {
  const api = useApi()
  const [data, setData] = useState<{ doctors: any[]; totals: any } | null>(null)
  const [loading, setLoading] = useState(true)
  const [sortKey, setSortKey] = useState<SortKey>('patientsReferred')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  useEffect(() => {
    api.get('/api/analytics/referral-conversion').then((d) => { setData(d); setLoading(false) }).catch((e) => { toast.error(e.message); setLoading(false) })
  }, [])

  if (loading) return (
    <div className="flex items-center justify-center py-16 text-muted-foreground">
      <Loader2 className="w-5 h-5 mr-2 animate-spin" /> Loading referral analytics...
    </div>
  )
  if (!data) return <div className="p-8 text-center text-muted-foreground">No data available</div>

  const t = data.totals || {}
  const doctors = [...(data.doctors || [])].sort((a, b) => {
    let cmp = 0
    if (sortKey === 'name') cmp = (a.name || '').localeCompare(b.name || '')
    else cmp = (a[sortKey] || 0) - (b[sortKey] || 0)
    return sortDir === 'asc' ? cmp : -cmp
  })

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir((d) => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(k); setSortDir('desc') }
  }

  const SortHeader = ({ k, label, align = 'left' }: { k: SortKey; label: string; align?: 'left' | 'right' }) => (
    <TableHead className={align === 'right' ? 'text-right' : ''}>
      <button onClick={() => toggleSort(k)} className="inline-flex items-center gap-1 hover:text-foreground capitalize">
        {label}
        <ArrowUpDown className={`w-3 h-3 ${sortKey === k ? 'opacity-100' : 'opacity-30'}`} />
      </button>
    </TableHead>
  )

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Referral Analytics</h1>
        <p className="text-muted-foreground text-sm mt-1">Per-doctor conversion: referred → visited → revenue & commission</p>
      </div>

      {/* Summary cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-brand-gradient text-white border-0">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs opacity-80 uppercase tracking-wide">Total Referrals</p>
                <p className="text-2xl font-bold mt-1">{t.totalReferred || 0}</p>
                <p className="text-xs opacity-70 mt-1">across {t.doctors || 0} doctors</p>
              </div>
              <Users className="w-8 h-8 opacity-80" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-brand-gradient-amber text-white border-0">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs opacity-80 uppercase tracking-wide">Conversion Rate</p>
                <p className="text-2xl font-bold mt-1">{(t.overallConversionRate || 0).toFixed(1)}%</p>
                <p className="text-xs opacity-70 mt-1">{t.totalVisited || 0} visited</p>
              </div>
              <Percent className="w-8 h-8 opacity-80" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-brand-gradient-blue text-white border-0">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs opacity-80 uppercase tracking-wide">Referral Revenue</p>
                <p className="text-2xl font-bold mt-1">{formatCurrency(t.totalRevenue || 0)}</p>
                <p className="text-xs opacity-70 mt-1">from referred patients</p>
              </div>
              <IndianRupee className="w-8 h-8 opacity-80" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-brand-gradient-violet text-white border-0">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs opacity-80 uppercase tracking-wide">Commission Paid</p>
                <p className="text-2xl font-bold mt-1">{formatCurrency(t.totalCommission || 0)}</p>
                <p className="text-xs opacity-70 mt-1">net commission margin: {formatCurrency((t.totalRevenue || 0) - (t.totalCommission || 0))}</p>
              </div>
              <TrendingUp className="w-8 h-8 opacity-80" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Stethoscope className="w-5 h-5 text-violet-600" /> Doctor-wise Referral Performance</CardTitle>
          <CardDescription>Click any column header to sort</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {doctors.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">No referral doctors yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortHeader k="name" label="Doctor" />
                    <TableHead>Specialization</TableHead>
                    <SortHeader k="patientsReferred" label="Referred" align="right" />
                    <SortHeader k="patientsVisited" label="Visited" align="right" />
                    <SortHeader k="conversionRate" label="Conv. %" align="right" />
                    <SortHeader k="revenueFromReferred" label="Revenue" align="right" />
                    <SortHeader k="commissionPaid" label="Commission" align="right" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {doctors.map((d) => {
                    const conv = d.conversionRate || 0
                    return (
                      <TableRow key={d.doctorId}>
                        <TableCell className="font-medium">
                          {d.name}
                          {d.hospitalAffiliation && <p className="text-xs text-muted-foreground">{d.hospitalAffiliation}</p>}
                          {d.area && <p className="text-xs text-muted-foreground">{d.area}</p>}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{d.specialization || '—'}</TableCell>
                        <TableCell className="text-right">{d.patientsReferred}</TableCell>
                        <TableCell className="text-right font-medium">{d.patientsVisited}</TableCell>
                        <TableCell className="text-right">
                          <Badge variant="outline" className={
                            conv >= 80 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                            conv >= 50 ? 'bg-amber-50 text-amber-700 border-amber-200' :
                            'bg-rose-50 text-rose-700 border-rose-200'
                          }>{conv.toFixed(1)}%</Badge>
                        </TableCell>
                        <TableCell className="text-right font-semibold text-emerald-700">{formatCurrency(d.revenueFromReferred)}</TableCell>
                        <TableCell className="text-right text-amber-700">{formatCurrency(d.commissionPaid)}</TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
