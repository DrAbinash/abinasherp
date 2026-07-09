'use client'

import { useState, useEffect } from 'react'
import { apiPath } from '@/lib/base-path'
import { useApi } from '@/lib/auth-context'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { toast } from 'sonner'
import { formatCurrency, formatDate, formatDateTime } from '@/lib/format'
import {
  Search, User, Phone, MapPin, Calendar, FileText, Receipt,
  IndianRupee, Award, TrendingUp, Download, Loader2, RotateCcw,
} from 'lucide-react'

const TIER_STYLE: Record<string, string> = {
  bronze: 'bg-amber-100 text-amber-800 border-amber-300',
  silver: 'bg-slate-100 text-slate-700 border-slate-300',
  gold: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  platinum: 'bg-violet-100 text-violet-800 border-violet-300',
}

export function Patient360Page() {
  const api = useApi()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<any[]>([])
  const [searching, setSearching] = useState(false)
  const [selected, setSelected] = useState<any | null>(null)

  const search = async () => {
    if (!query.trim()) return
    setSearching(true)
    try {
      const d = await api.get(`/api/patients?q=${encodeURIComponent(query)}&limit=20`)
      setResults(d.patients || [])
    } catch (e: any) { toast.error(e.message) } finally { setSearching(false) }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Patient 360°</h1>
        <p className="text-muted-foreground text-sm mt-1">Unified view of a patient — bills, reports, appointments, payments, loyalty</p>
      </div>

      {!selected ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Search className="w-5 h-5 text-emerald-600" /> Find a Patient</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && search()}
                  placeholder="Search by name, phone or patient ID..."
                  className="pl-9"
                />
              </div>
              <Button onClick={search} disabled={searching} className="bg-brand-gradient text-white">
                {searching ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Search className="w-4 h-4 mr-1" />} Search
              </Button>
            </div>

            {results.length > 0 && (
              <div className="border rounded-lg divide-y max-h-96 overflow-y-auto">
                {results.map((p) => (
                  <button key={p.id} onClick={() => setSelected(p)} className="w-full text-left p-3 hover:bg-muted/40 transition-colors flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-700 font-semibold">
                        {p.name?.charAt(0)?.toUpperCase() || '?'}
                      </div>
                      <div>
                        <p className="font-medium">{p.name} <span className="text-xs text-muted-foreground font-mono">({p.patientId})</span></p>
                        <p className="text-xs text-muted-foreground">{p.phone || '—'} · {p.age ? `${p.age}y` : '—'} · {p.gender || '—'}</p>
                      </div>
                    </div>
                    <Badge variant="outline">{formatDate(p.createdAt)}</Badge>
                  </button>
                ))}
              </div>
            )}

            {results.length === 0 && query && !searching && (
              <p className="text-center py-4 text-muted-foreground text-sm">No patients found. Try a different name, phone or ID.</p>
            )}
          </CardContent>
        </Card>
      ) : (
        <PatientDetail patient={selected} onBack={() => { setSelected(null); setResults([]); setQuery('') }} />
      )}
    </div>
  )
}

function PatientDetail({ patient, onBack }: { patient: any; onBack: () => void }) {
  const api = useApi()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    api.get(`/api/patients/${patient.id}/360`).then((d) => { setData(d); setLoading(false) }).catch((e) => { toast.error(e.message); setLoading(false) })
  }, [patient.id])

  if (loading) return (
    <div className="flex items-center justify-center py-16 text-muted-foreground">
      <Loader2 className="w-5 h-5 mr-2 animate-spin" /> Loading 360° view...
    </div>
  )
  if (!data) return null

  const s = data.summary || {}
  const loyalty = data.loyalty

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={onBack} className="mb-1"><RotateCcw className="w-4 h-4 mr-1" /> Back to Search</Button>

      {/* Patient info card */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-start gap-4 flex-wrap">
            <div className="w-14 h-14 rounded-xl bg-brand-gradient text-white flex items-center justify-center text-xl font-bold flex-shrink-0">
              {patient.name?.charAt(0)?.toUpperCase() || '?'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl font-bold">{patient.name}</h2>
                <Badge variant="outline" className="font-mono">{patient.patientId}</Badge>
                {loyalty && <Badge variant="outline" className={`capitalize ${TIER_STYLE[loyalty.tier] || ''}`}>{loyalty.tier}</Badge>}
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" /> {patient.phone || '—'}</span>
                <span className="flex items-center gap-1.5"><User className="w-3.5 h-3.5" /> {patient.age ? `${patient.age}y` : '—'} · {patient.gender || '—'}</span>
                <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> Since {formatDate(patient.createdAt)}</span>
                {patient.email && <span className="flex items-center gap-1.5 truncate"><User className="w-3.5 h-3.5" /> {patient.email}</span>}
              </div>
              {patient.address && <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" /> {patient.address}</p>}
              {data.referralDoctor && <p className="text-sm mt-1">Referred by: <span className="font-medium">{data.referralDoctor.name}</span> {data.referralDoctor.specialization ? `(${data.referralDoctor.specialization})` : ''}</p>}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
        <Card className="border-border/60"><CardContent className="p-2.5"><p className="text-xs text-muted-foreground">Total Visits</p><p className="text-lg font-bold">{s.totalBills || 0}</p></CardContent></Card>
        <Card className="border-border/60"><CardContent className="p-2.5"><p className="text-xs text-muted-foreground">Total Billed</p><p className="text-sm font-bold">{formatCurrency((data.bills || []).reduce((sum: number, b: any) => sum + (b.status !== 'cancelled' ? b.totalAmount : 0), 0))}</p></CardContent></Card>
        <Card className="border-emerald-200 bg-emerald-50"><CardContent className="p-2.5"><p className="text-xs text-emerald-700">Total Paid</p><p className="text-sm font-bold text-emerald-700">{formatCurrency(s.lifetimeValue || 0)}</p></CardContent></Card>
        <Card className="border-amber-200 bg-amber-50"><CardContent className="p-2.5"><p className="text-xs text-amber-700">Outstanding</p><p className="text-sm font-bold text-amber-700">{formatCurrency(s.outstandingDues || 0)}</p></CardContent></Card>
        <Card className="border-border/60"><CardContent className="p-2.5"><p className="text-xs text-muted-foreground">Reports</p><p className="text-lg font-bold">{s.totalReports || 0}</p></CardContent></Card>
        <Card className="border-violet-200 bg-violet-50"><CardContent className="p-2.5"><p className="text-xs text-violet-700">Lifetime Value</p><p className="text-sm font-bold text-violet-700">{formatCurrency(s.lifetimeValue || 0)}</p></CardContent></Card>
        <Card className="border-border/60"><CardContent className="p-2.5"><p className="text-xs text-muted-foreground">Loyalty Pts</p><p className="text-lg font-bold text-emerald-700">{(s.loyaltyPoints || 0).toLocaleString()}</p></CardContent></Card>
      </div>

      <Tabs defaultValue="bills">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="bills"><Receipt className="w-3.5 h-3.5 mr-1" /> Bills ({(data.bills || []).length})</TabsTrigger>
          <TabsTrigger value="reports"><FileText className="w-3.5 h-3.5 mr-1" /> Reports ({(data.reports || []).length})</TabsTrigger>
          <TabsTrigger value="appointments"><Calendar className="w-3.5 h-3.5 mr-1" /> Appointments ({(data.appointments || []).length})</TabsTrigger>
          <TabsTrigger value="payments"><IndianRupee className="w-3.5 h-3.5 mr-1" /> Payments ({(data.payments || []).length})</TabsTrigger>
          <TabsTrigger value="loyalty"><Award className="w-3.5 h-3.5 mr-1" /> Loyalty</TabsTrigger>
        </TabsList>

        <TabsContent value="bills">
          <Card><CardContent className="p-0">
            {(data.bills || []).length === 0 ? <p className="text-center py-8 text-muted-foreground text-sm">No bills.</p> : (
              <div className="overflow-x-auto"><Table>
                <TableHeader><TableRow>
                  <TableHead>Bill #</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Paid</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {(data.bills || []).map((b: any) => (
                    <TableRow key={b.id}>
                      <TableCell className="font-mono text-xs">{b.billNumber}</TableCell>
                      <TableCell className="text-xs">{formatDateTime(b.createdAt)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(b.totalAmount)}</TableCell>
                      <TableCell className="text-right text-emerald-700">{formatCurrency(b.paidAmount)}</TableCell>
                      <TableCell className="text-right text-amber-700">{formatCurrency(b.balanceAmount)}</TableCell>
                      <TableCell><Badge variant="outline" className={
                        b.status === 'paid' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                        b.status === 'partial' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                        b.status === 'cancelled' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                        'bg-slate-50 text-slate-700 border-slate-200'
                      }>{b.status}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table></div>
            )}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="reports">
          <Card><CardContent className="p-0">
            {(data.reports || []).length === 0 ? <p className="text-center py-8 text-muted-foreground text-sm">No reports.</p> : (
              <div className="overflow-x-auto"><Table>
                <TableHeader><TableRow>
                  <TableHead>Report #</TableHead>
                  <TableHead>Test</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">PDF</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {(data.reports || []).map((r: any) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono text-xs">{r.reportNumber}</TableCell>
                      <TableCell className="font-medium">{r.testName}</TableCell>
                      <TableCell className="text-xs">{formatDate(r.createdAt)}</TableCell>
                      <TableCell><Badge variant="outline" className={
                        r.status === 'approved' || r.status === 'delivered' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                        r.status === 'pending_review' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                        r.status === 'cancelled' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                        'bg-slate-50 text-slate-700 border-slate-200'
                      }>{r.status.replace('_', ' ')}</Badge></TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="ghost" onClick={() => {
                          const w = window.open(apiPath(`/api/patient-reports/${r.id}/pdf`), '_blank')
                          if (!w) toast.error('Popup blocked — allow popups to view PDF')
                        }}>
                          <Download className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table></div>
            )}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="appointments">
          <Card><CardContent className="p-0">
            {(data.appointments || []).length === 0 ? <p className="text-center py-8 text-muted-foreground text-sm">No appointments.</p> : (
              <div className="overflow-x-auto"><Table>
                <TableHeader><TableRow>
                  <TableHead>Appointment #</TableHead>
                  <TableHead>Date / Time</TableHead>
                  <TableHead>Package / Tests</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {(data.appointments || []).map((a: any) => (
                    <TableRow key={a.id}>
                      <TableCell className="font-mono text-xs">{a.appointmentId}</TableCell>
                      <TableCell className="text-sm">{formatDate(a.appointmentDate)} · {a.timeSlot}</TableCell>
                      <TableCell className="text-sm">{a.packageName || a.testIds || '—'}</TableCell>
                      <TableCell><Badge variant="outline" className="capitalize">{a.source}</Badge></TableCell>
                      <TableCell><Badge variant="outline" className={
                        a.status === 'completed' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                        a.status === 'cancelled' || a.status === 'no-show' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                        a.status === 'arrived' || a.status === 'in-progress' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                        'bg-slate-50 text-slate-700 border-slate-200'
                      }>{a.status.replace('_', ' ')}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table></div>
            )}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="payments">
          <Card><CardContent className="p-0">
            {(data.payments || []).length === 0 ? <p className="text-center py-8 text-muted-foreground text-sm">No payments recorded.</p> : (
              <div className="overflow-x-auto"><Table>
                <TableHeader><TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Recorded By</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {(data.payments || []).map((p: any) => (
                    <TableRow key={p.id}>
                      <TableCell className="text-xs">{formatDateTime(p.createdAt)}</TableCell>
                      <TableCell><Badge variant="outline" className="capitalize">{p.method}</Badge></TableCell>
                      <TableCell className="font-mono text-xs">{p.referenceNumber || '—'}</TableCell>
                      <TableCell className="text-sm">{p.recordedByName || '—'}</TableCell>
                      <TableCell className={`text-right font-bold ${p.amount >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>{p.amount >= 0 ? '+' : ''}{formatCurrency(p.amount)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table></div>
            )}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="loyalty">
          <div className="grid lg:grid-cols-3 gap-4">
            <Card className="lg:col-span-1">
              <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Award className="w-4 h-4 text-emerald-600" /> Loyalty Summary</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {!loyalty ? (
                  <p className="text-sm text-muted-foreground">No loyalty account. One is created automatically on first earned points.</p>
                ) : (
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between"><span className="text-muted-foreground">Tier</span><Badge variant="outline" className={`capitalize ${TIER_STYLE[loyalty.tier] || ''}`}>{loyalty.tier}</Badge></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Current Points</span><span className="font-bold">{(loyalty.points || 0).toLocaleString()}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Total Earned</span><span className="font-bold text-emerald-700">{(loyalty.totalEarned || 0).toLocaleString()}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Total Redeemed</span><span className="font-bold text-amber-700">{(loyalty.totalRedeemed || 0).toLocaleString()}</span></div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader><CardTitle className="flex items-center gap-2 text-base"><TrendingUp className="w-4 h-4 text-emerald-600" /> Recent Transactions</CardTitle></CardHeader>
              <CardContent className="p-0">
                {!loyalty ? (
                  <p className="text-center py-6 text-muted-foreground text-sm">No loyalty history.</p>
                ) : (
                  <div className="border-t max-h-72 overflow-y-auto divide-y">
                    <LoyaltyTransactions patientId={patient.id} />
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function LoyaltyTransactions({ patientId }: { patientId: string }) {
  const api = useApi()
  const [txns, setTxns] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get(`/api/loyalty/${patientId}`).then((d) => { setTxns(d.transactions || []); setLoading(false) }).catch((e) => { toast.error(e.message); setLoading(false) })
  }, [patientId])

  if (loading) return <p className="text-center py-4 text-muted-foreground text-sm">Loading...</p>
  if (txns.length === 0) return <p className="text-center py-6 text-muted-foreground text-sm">No transactions yet.</p>

  return (
    <>
      {txns.slice(0, 50).map((t) => (
        <div key={t.id} className="p-2.5 flex items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={t.type === 'earn' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : t.type === 'redeem' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-slate-50 text-slate-700 border-slate-200'}>{t.type}</Badge>
              {t.billNumber && <span className="text-xs font-mono text-muted-foreground">{t.billNumber}</span>}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">{t.reason || '—'} · {formatDateTime(t.createdAt)}</p>
          </div>
          <p className={`font-bold ${t.points >= 0 ? 'text-emerald-700' : 'text-amber-700'}`}>{t.points >= 0 ? '+' : ''}{t.points}</p>
        </div>
      ))}
    </>
  )
}
