'use client'

import { useState, useEffect, useCallback } from 'react'
import { useApi } from '@/lib/auth-context'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { toast } from 'sonner'
import { formatCurrency, formatDateTime, todayIST, daysAgo } from '@/lib/format'
import { IndianRupee, Search } from 'lucide-react'

interface PaymentRow {
  id: string
  amount: number
  method: string
  referenceNumber?: string | null
  notes?: string | null
  recordedByName?: string | null
  createdAt: string
  bill?: { billNumber?: string; patient?: { name?: string } | null } | null
}

const METHOD_VARIANT: Record<string, string> = {
  cash: 'bg-emerald-100 text-emerald-700',
  upi: 'bg-blue-100 text-blue-700',
  card: 'bg-purple-100 text-purple-700',
  online: 'bg-amber-100 text-amber-700',
  cheque: 'bg-slate-100 text-slate-700',
}

export function PaymentsPage() {
  const api = useApi()
  const [payments, setPayments] = useState<PaymentRow[]>([])
  const [loading, setLoading] = useState(false)
  const [from, setFrom] = useState(daysAgo(7))
  const [to, setTo] = useState(todayIST())
  const [method, setMethod] = useState('')
  const [search, setSearch] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (from) params.set('from', from)
      if (to) params.set('to', to)
      if (method) params.set('method', method)
      params.set('limit', '200')
      const d = await api.get(`/api/payments?${params.toString()}`)
      setPayments(d.payments || [])
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to, method])

  // Debounced reload when the date range or method filter changes.
  useEffect(() => {
    const t = setTimeout(load, 300)
    return () => clearTimeout(t)
  }, [load])

  const filtered = payments.filter((p) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      (p.bill?.patient?.name || '').toLowerCase().includes(q) ||
      (p.bill?.billNumber || '').toLowerCase().includes(q) ||
      (p.referenceNumber || '').toLowerCase().includes(q)
    )
  })

  const totalIn = filtered.filter((p) => p.amount > 0).reduce((s, p) => s + p.amount, 0)
  const totalRefund = filtered.filter((p) => p.amount < 0).reduce((s, p) => s + Math.abs(p.amount), 0)

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl bg-brand-gradient flex items-center justify-center">
          <IndianRupee className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Payments</h1>
          <p className="text-sm text-muted-foreground">All receipts &amp; refunds recorded against bills</p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Collected</p>
          <p className="text-lg font-bold text-emerald-600">{formatCurrency(totalIn)}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Refunded</p>
          <p className="text-lg font-bold text-red-600">{formatCurrency(totalRefund)}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Entries</p>
          <p className="text-lg font-bold">{filtered.length}</p>
        </CardContent></Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Payment Register</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <Label className="text-xs">From</Label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9" />
            </div>
            <div>
              <Label className="text-xs">To</Label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-9" />
            </div>
            <div>
              <Label className="text-xs">Method</Label>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">All</option>
                <option value="cash">Cash</option>
                <option value="upi">UPI</option>
                <option value="card">Card</option>
                <option value="online">Online</option>
                <option value="cheque">Cheque</option>
                <option value="bank">Bank</option>
              </select>
            </div>
            <div className="flex-1 min-w-[180px]">
              <Label className="text-xs">Search</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Patient, bill # or reference"
                  className="h-9 pl-8"
                />
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Bill #</TableHead>
                  <TableHead>Patient</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Loading…</TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No payments in this range</TableCell></TableRow>
                ) : (
                  filtered.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="whitespace-nowrap text-sm">{formatDateTime(p.createdAt)}</TableCell>
                      <TableCell className="font-mono text-xs">{p.bill?.billNumber || '—'}</TableCell>
                      <TableCell>{p.bill?.patient?.name || '—'}</TableCell>
                      <TableCell>
                        <Badge className={METHOD_VARIANT[p.method] || 'bg-slate-100 text-slate-700'} variant="secondary">
                          {p.method}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{p.referenceNumber || '—'}</TableCell>
                      <TableCell className={`text-right font-semibold ${p.amount < 0 ? 'text-red-600' : ''}`}>
                        {formatCurrency(p.amount)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
