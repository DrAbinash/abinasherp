'use client'

import { useState, useEffect, useRef } from 'react'
import { useApi, useAuth } from '@/lib/auth-context'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import { formatCurrency, formatDate, formatDateTime, todayIST, daysAgo } from '@/lib/format'
import { Mail, MessageSquare, Send, FileBarChart, IndianRupee, TrendingDown, TrendingUp, Users } from 'lucide-react'

export function DailyCollectionPage() {
  const api = useApi()
  const [date, setDate] = useState(todayIST())
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const d = await api.get(`/api/reports/daily-collection?date=${date}`)
      setData(d)
    } catch (e: any) { toast.error(e.message) } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [date])

  const send = async (method: 'email' | 'whatsapp' | 'both') => {
    setSending(true)
    try {
      const d = await api.get(`/api/reports/daily-collection?date=${date}&send=${method}`)
      toast.success(`Daily summary sent via ${method}`)
      setData(d)
    } catch (e: any) { toast.error(e.message) } finally { setSending(false) }
  }

  if (loading) return <div className="p-8 text-center text-muted-foreground">Loading...</div>
  if (!data || !data.summary) return null

  const s = data.summary

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Daily Collection Report</h1>
          <p className="text-muted-foreground text-sm mt-1">Comprehensive daily summary — email/WhatsApp to owner</p>
        </div>
        <div className="flex gap-2 items-end">
          <div>
            <Label className="text-xs">Date</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-44" />
          </div>
          <Button variant="outline" onClick={() => setDate(todayIST())}>Today</Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <Card className="bg-brand-gradient text-white border-0"><CardContent className="p-3"><p className="text-xs opacity-80">Bills</p><p className="text-2xl font-bold">{s.totalBills}</p></CardContent></Card>
        <Card className="bg-brand-gradient-blue text-white border-0"><CardContent className="p-3"><p className="text-xs opacity-80">Billed</p><p className="text-xl font-bold">{formatCurrency(s.totalBilled)}</p></CardContent></Card>
        <Card className="bg-emerald-500 text-white border-0"><CardContent className="p-3"><p className="text-xs opacity-80">Collected</p><p className="text-xl font-bold">{formatCurrency(s.totalCollected)}</p></CardContent></Card>
        <Card className="bg-rose-500 text-white border-0"><CardContent className="p-3"><p className="text-xs opacity-80">Refunds</p><p className="text-xl font-bold">{formatCurrency(s.totalRefunds)}</p></CardContent></Card>
        <Card className="bg-amber-500 text-white border-0"><CardContent className="p-3"><p className="text-xs opacity-80">Expenses</p><p className="text-xl font-bold">{formatCurrency(s.totalExpenses)}</p></CardContent></Card>
        <Card className="bg-violet-500 text-white border-0"><CardContent className="p-3"><p className="text-xs opacity-80">Net Cash</p><p className="text-xl font-bold">{formatCurrency(s.netCash)}</p></CardContent></Card>
      </div>

      {/* Send buttons */}
      <Card className="bg-gradient-to-r from-emerald-50 to-amber-50 border-emerald-200">
        <CardContent className="p-4 flex items-center gap-3 flex-wrap">
          <Send className="w-5 h-5 text-emerald-600" />
          <span className="font-medium text-sm">Send daily summary:</span>
          <Button size="sm" onClick={() => send('email')} disabled={sending} variant="outline" className="border-blue-300 text-blue-700">
            <Mail className="w-4 h-4 mr-1" /> Email
          </Button>
          <Button size="sm" onClick={() => send('whatsapp')} disabled={sending} variant="outline" className="border-emerald-300 text-emerald-700">
            <MessageSquare className="w-4 h-4 mr-1" /> WhatsApp
          </Button>
          <Button size="sm" onClick={() => send('both')} disabled={sending} className="bg-brand-gradient text-white">
            Send Both
          </Button>
          {data.delivery && (
            <div className="ml-auto text-xs text-muted-foreground">
              {data.delivery.email?.ok && <Badge variant="outline" className="bg-emerald-50 text-emerald-700 mr-1">Email ✓</Badge>}
              {data.delivery.whatsapp?.ok && <Badge variant="outline" className="bg-emerald-50 text-emerald-700 mr-1">WhatsApp ✓</Badge>}
              {data.delivery.email && !data.delivery.email.ok && <Badge variant="outline" className="bg-rose-50 text-rose-700 mr-1">Email ✗ {data.delivery.email.error}</Badge>}
              {data.delivery.whatsapp && !data.delivery.whatsapp.ok && <Badge variant="outline" className="bg-rose-50 text-rose-700">WhatsApp ✗ {data.delivery.whatsapp.error}</Badge>}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* By method */}
        <Card>
          <CardHeader><CardTitle>Collections by Method</CardTitle></CardHeader>
          <CardContent>
            {Object.keys(s.byMethod).length === 0 ? (
              <p className="text-center text-muted-foreground py-4">No collections today</p>
            ) : (
              <Table>
                <TableHeader><TableRow><TableHead>Method</TableHead><TableHead className="text-right">Count</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
                <TableBody>
                  {Object.entries(s.byMethod).map(([m, v]: [string, any]) => (
                    <TableRow key={m}>
                      <TableCell className="font-medium uppercase">{m}</TableCell>
                      <TableCell className="text-right">{v.count}</TableCell>
                      <TableCell className="text-right font-bold">{formatCurrency(v.amount)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Top tests */}
        <Card>
          <CardHeader><CardTitle>Top Tests Today</CardTitle></CardHeader>
          <CardContent>
            {s.topTests.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">No tests performed</p>
            ) : (
              <Table>
                <TableHeader><TableRow><TableHead>#</TableHead><TableHead>Test</TableHead><TableHead className="text-right">Count</TableHead></TableRow></TableHeader>
                <TableBody>
                  {s.topTests.map((t: any, i: number) => (
                    <TableRow key={t.name}>
                      <TableCell>{i + 1}</TableCell>
                      <TableCell className="font-medium">{t.name}</TableCell>
                      <TableCell className="text-right">{t.count}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Doctor breakdown */}
      <Card>
        <CardHeader><CardTitle>Doctor-wise Breakdown</CardTitle></CardHeader>
        <CardContent className="p-0">
          {s.doctorBreakdown.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">No bills today</p>
          ) : (
            <Table>
              <TableHeader><TableRow><TableHead>Doctor</TableHead><TableHead className="text-right">Patients</TableHead><TableHead className="text-right">Revenue</TableHead></TableRow></TableHeader>
              <TableBody>
                {s.doctorBreakdown.map((d: any) => (
                  <TableRow key={d.doctor}>
                    <TableCell className="font-medium">{d.doctor}</TableCell>
                    <TableCell className="text-right">{d.patientCount}</TableCell>
                    <TableCell className="text-right">{formatCurrency(d.revenue)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* WhatsApp preview */}
      <Card>
        <CardHeader><CardTitle>WhatsApp Message Preview</CardTitle></CardHeader>
        <CardContent>
          <pre className="whitespace-pre-wrap text-sm font-mono bg-muted/30 p-4 rounded">{data.messageText}</pre>
        </CardContent>
      </Card>
    </div>
  )
}

// =====================================================
// TDS REPORTS PAGE
// =====================================================
export function TdsReportsPage() {
  const api = useApi()
  const [from, setFrom] = useState(daysAgo(90))
  const [to, setTo] = useState(todayIST())
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const d = await api.get(`/api/reports/tds?from=${from}&to=${to}`)
      setData(d)
    } catch (e: any) { toast.error(e.message) } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  if (loading) return <div className="p-8 text-center text-muted-foreground">Loading...</div>
  if (!data) return null

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">TDS Reports</h1>
        <p className="text-muted-foreground text-sm mt-1">Section 194J (doctors) + Section 192 (staff salary) — Indian tax compliance</p>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between flex-wrap gap-2">
          <CardTitle>TDS Computation</CardTitle>
          <div className="flex gap-2 items-end">
            <div><Label className="text-xs">From</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" /></div>
            <div><Label className="text-xs">To</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" /></div>
            <Button onClick={load} size="sm" className="bg-brand-gradient text-white">Generate</Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Role/Specialization</TableHead>
                <TableHead className="text-right">Payments</TableHead>
                <TableHead className="text-right">Total Paid</TableHead>
                <TableHead className="text-right">Threshold</TableHead>
                <TableHead className="text-right">TDS Rate</TableHead>
                <TableHead className="text-right">TDS Deductible</TableHead>
                <TableHead className="text-right">Net Payable</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.rows.length === 0 ? (
                <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">No payments in this period</TableCell></TableRow>
              ) : data.rows.map((r: any, i: number) => (
                <TableRow key={i}>
                  <TableCell><Badge variant="outline" className={r.type.includes('194J') ? 'bg-blue-50 text-blue-700' : 'bg-violet-50 text-violet-700'}>{r.type}</Badge></TableCell>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell className="text-sm">{r.specialization || r.role || '—'}</TableCell>
                  <TableCell className="text-right">{r.paymentCount}</TableCell>
                  <TableCell className="text-right">{formatCurrency(r.totalPaid)}</TableCell>
                  <TableCell className="text-right text-xs">{formatCurrency(r.threshold)}</TableCell>
                  <TableCell className="text-right text-xs">{r.tdsRate}</TableCell>
                  <TableCell className="text-right font-bold text-rose-600">{formatCurrency(r.tdsDeductible)}</TableCell>
                  <TableCell className="text-right font-bold text-emerald-600">{formatCurrency(r.netPayable)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
            {data.rows.length > 0 && (
              <TableBody>
                <TableRow className="font-bold bg-muted/40">
                  <TableCell colSpan={4}>TOTAL</TableCell>
                  <TableCell className="text-right">{formatCurrency(data.totals.totalPaid)}</TableCell>
                  <TableCell colSpan={2} />
                  <TableCell className="text-right text-rose-700">{formatCurrency(data.totals.tdsDeductible)}</TableCell>
                  <TableCell className="text-right text-emerald-700">{formatCurrency(data.totals.netPayable)}</TableCell>
                </TableRow>
              </TableBody>
            )}
          </Table>
        </CardContent>
      </Card>

      <Card className="bg-amber-50 border-amber-200">
        <CardContent className="p-4 space-y-2">
          <p className="font-semibold text-amber-800">📋 Compliance Notes</p>
          <ul className="list-disc list-inside text-xs text-amber-700 space-y-1">
            {data.notes.map((n: string, i: number) => <li key={i}>{n}</li>)}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Filing Schedule</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Quarter</TableHead><TableHead>Period</TableHead><TableHead>Due Date for Deposit</TableHead><TableHead>Form 26Q Filing Due</TableHead></TableRow></TableHeader>
            <TableBody>
              {[
                { q: 'Q1', period: 'Apr-Jun', deposit: '7 Jul', file: '31 Jul' },
                { q: 'Q2', period: 'Jul-Sep', deposit: '7 Oct', file: '31 Oct' },
                { q: 'Q3', period: 'Oct-Dec', deposit: '7 Jan', file: '31 Jan' },
                { q: 'Q4', period: 'Jan-Mar', deposit: '30 Apr', file: '31 May' },
              ].map((q) => (
                <TableRow key={q.q}>
                  <TableCell className="font-bold">{q.q}</TableCell>
                  <TableCell>{q.period}</TableCell>
                  <TableCell>{q.deposit}</TableCell>
                  <TableCell>{q.file}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
