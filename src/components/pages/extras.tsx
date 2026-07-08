'use client'

import { useState, useEffect, useRef } from 'react'
import { useApi } from '@/lib/auth-context'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import { formatCurrency, formatDate, todayIST, daysAgo } from '@/lib/format'
import { Search, FileBarChart, Download, IndianRupee } from 'lucide-react'
import { PageKey } from '@/components/sidebar'

// =====================================================
// Global Search
// =====================================================
export function GlobalSearch({ onNavigate }: { onNavigate: (p: PageKey) => void }) {
  const api = useApi()
  const [q, setQ] = useState('')
  const [results, setResults] = useState<any>(null)
  const [open, setOpen] = useState(false)
  const [highlightIdx, setHighlightIdx] = useState(0)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (q.length < 1) { setResults(null); setOpen(false); return }
    const t = setTimeout(async () => {
      try {
        const d = await api.get(`/api/search?q=${encodeURIComponent(q)}`)
        setResults(d.results)
        setOpen(true)
        setHighlightIdx(0)
      } catch {}
    }, 250)
    return () => clearTimeout(t)
  }, [q])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const flatResults: Array<{ type: string; label: string; sub: string; action: PageKey }> = []
  if (results) {
    results.patients?.forEach((p: any) => flatResults.push({ type: 'Patient', label: p.name, sub: `${p.patientId} · ${p.phone || ''}`, action: 'billing' }))
    results.doctors?.forEach((d: any) => flatResults.push({ type: 'Doctor', label: d.name, sub: d.specialization, action: 'referrals' }))
    results.bills?.forEach((b: any) => flatResults.push({ type: 'Bill', label: b.billNumber, sub: `${b.patientName} · ${formatCurrency(b.totalAmount)} · ${b.status}`, action: 'billing' }))
    results.orders?.forEach((o: any) => flatResults.push({ type: 'Order', label: o.orderNumber, sub: `${o.patientName} · ${o.status}`, action: 'billing' }))
    results.vouchers?.forEach((v: any) => flatResults.push({ type: 'Voucher', label: v.voucherNumber, sub: `${v.type} · ${formatCurrency(v.amount)}`, action: 'accounting' }))
    results.suppliers?.forEach((s: any) => flatResults.push({ type: 'Supplier', label: s.name, sub: s.supplierId, action: 'suppliers' }))
    results.staff?.forEach((s: any) => flatResults.push({ type: 'Staff', label: s.name, sub: `${s.staffId} · ${s.role}`, action: 'staff' }))
  }

  return (
    <div ref={ref} className="relative flex-1 max-w-md">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search patients, bills, doctors, vouchers..."
        className="pl-9 pr-3"
        onFocus={() => results && setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setHighlightIdx((i) => Math.min(i + 1, flatResults.length - 1)) }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlightIdx((i) => Math.max(i - 1, 0)) }
          else if (e.key === 'Enter' && flatResults[highlightIdx]) {
            onNavigate(flatResults[highlightIdx].action)
            setOpen(false); setQ('')
          } else if (e.key === 'Escape') { setOpen(false) }
        }}
      />
      {open && flatResults.length > 0 && (
        <div className="absolute top-full mt-1 w-full bg-popover border rounded-lg shadow-lg max-h-96 overflow-y-auto z-50">
          {flatResults.map((r, i) => (
            <button
              key={i}
              onMouseEnter={() => setHighlightIdx(i)}
              onClick={() => { onNavigate(r.action); setOpen(false); setQ('') }}
              className={`w-full text-left p-2.5 border-b last:border-0 hover:bg-emerald-50 ${i === highlightIdx ? 'bg-emerald-50' : ''}`}
            >
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-[10px] px-1.5">{r.type}</Badge>
                <span className="font-medium text-sm">{r.label}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 ml-1">{r.sub}</p>
            </button>
          ))}
        </div>
      )}
      {open && flatResults.length === 0 && q.length > 0 && (
        <div className="absolute top-full mt-1 w-full bg-popover border rounded-lg shadow-lg p-4 text-center text-sm text-muted-foreground z-50">
          No results for &quot;{q}&quot;
        </div>
      )}
    </div>
  )
}

// =====================================================
// GST Reports Page
// =====================================================
export function GstReportsPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">GST Reports</h1>
        <p className="text-muted-foreground text-sm mt-1">GSTR-1 (outward supplies) and GSTR-3B (summary return)</p>
      </div>
      <Tabs defaultValue="gstr1">
        <TabsList>
          <TabsTrigger value="gstr1">GSTR-1 (Outward)</TabsTrigger>
          <TabsTrigger value="gstr3b">GSTR-3B (Summary)</TabsTrigger>
        </TabsList>
        <TabsContent value="gstr1"><Gstr1Report /></TabsContent>
        <TabsContent value="gstr3b"><Gstr3bReport /></TabsContent>
      </Tabs>
    </div>
  )
}

function Gstr1Report() {
  const api = useApi()
  const [from, setFrom] = useState(daysAgo(30))
  const [to, setTo] = useState(todayIST())
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const d = await api.get(`/api/gst-reports?type=gstr1&from=${from}&to=${to}`)
      setData(d)
    } catch (e: any) { toast.error(e.message) } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between flex-wrap gap-2">
        <CardTitle>GSTR-1 — Outward Supplies</CardTitle>
        <div className="flex gap-2 items-end">
          <div><Label className="text-xs">From</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" /></div>
          <div><Label className="text-xs">To</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" /></div>
          <Button onClick={load} size="sm" className="bg-brand-gradient text-white">Generate</Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? <p className="text-center py-8 text-muted-foreground">Loading...</p> : data ? (
          <>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 p-4 bg-muted/30">
              <Stat label="Count" value={String(data.totals.count)} />
              <Stat label="Taxable Value" value={formatCurrency(data.totals.taxableValue)} />
              <Stat label="CGST" value={formatCurrency(data.totals.cgst)} />
              <Stat label="SGST" value={formatCurrency(data.totals.sgst)} />
              <Stat label="Grand Total" value={formatCurrency(data.totals.grandTotal)} highlight />
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Voucher #</TableHead>
                  <TableHead>Party</TableHead>
                  <TableHead className="text-right">Taxable</TableHead>
                  <TableHead className="text-right">CGST</TableHead>
                  <TableHead className="text-right">SGST</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.outwardSupplies.map((s: any, i: number) => (
                  <TableRow key={i}>
                    <TableCell className="text-xs">{s.date}</TableCell>
                    <TableCell className="font-mono text-xs">{s.voucherNumber}</TableCell>
                    <TableCell>{s.partyName}</TableCell>
                    <TableCell className="text-right">{formatCurrency(s.taxableValue)}</TableCell>
                    <TableCell className="text-right text-emerald-600">{s.cgst ? formatCurrency(s.cgst) : '—'}</TableCell>
                    <TableCell className="text-right text-emerald-600">{s.sgst ? formatCurrency(s.sgst) : '—'}</TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(s.total)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </>
        ) : null}
      </CardContent>
    </Card>
  )
}

function Gstr3bReport() {
  const api = useApi()
  const [from, setFrom] = useState(daysAgo(30))
  const [to, setTo] = useState(todayIST())
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const d = await api.get(`/api/gst-reports?type=gstr3b&from=${from}&to=${to}`)
      setData(d)
    } catch (e: any) { toast.error(e.message) } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between flex-wrap gap-2">
        <CardTitle>GSTR-3B — Summary Return</CardTitle>
        <div className="flex gap-2 items-end">
          <div><Label className="text-xs">From</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" /></div>
          <div><Label className="text-xs">To</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" /></div>
          <Button onClick={load} size="sm" className="bg-brand-gradient text-white">Generate</Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? <p className="text-center py-8 text-muted-foreground">Loading...</p> : data ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <SummaryCard label="Outward Supplies (Taxable)" value={formatCurrency(data.summary.outwardSupplies)} color="emerald" />
              <SummaryCard label="Inward Supplies (ITC)" value={formatCurrency(data.summary.inwardSupplies)} color="blue" />
              <SummaryCard label="Output Tax (Payable)" value={formatCurrency(data.summary.outputTax)} color="amber" />
              <SummaryCard label="Input Tax Credit" value={formatCurrency(data.summary.inputTax)} color="blue" />
              <SummaryCard label="Net Tax Payable" value={formatCurrency(data.summary.netTaxPayable)} color="rose" highlight />
              <SummaryCard label="ITC Carried Forward" value={formatCurrency(data.summary.itcCarriedForward)} color="violet" />
            </div>
            <div className="p-4 rounded-lg bg-amber-50 border border-amber-200 text-sm">
              <p className="font-semibold text-amber-800">Note: GST is computed at standard 18% (CGST 9% + SGST 9%) on all GST-applicable transactions for demo purposes. Configure actual rates per-account in Accounting → Accounts.</p>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-base font-bold ${highlight ? 'text-emerald-700' : ''}`}>{value}</p>
    </div>
  )
}

function SummaryCard({ label, value, color, highlight }: { label: string; value: string; color: string; highlight?: boolean }) {
  const colorClasses: Record<string, string> = {
    emerald: 'bg-emerald-50 border-emerald-200 text-emerald-800',
    blue: 'bg-blue-50 border-blue-200 text-blue-800',
    amber: 'bg-amber-50 border-amber-200 text-amber-800',
    rose: 'bg-rose-50 border-rose-200 text-rose-800',
    violet: 'bg-violet-50 border-violet-200 text-violet-800',
  }
  return (
    <div className={`p-4 rounded-lg border ${highlight ? 'ring-2 ring-offset-2 ring-emerald-400 ' : ''}${colorClasses[color]}`}>
      <p className="text-xs font-medium opacity-80">{label}</p>
      <p className="text-xl font-bold mt-1">{value}</p>
    </div>
  )
}
