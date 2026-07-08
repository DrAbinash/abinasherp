'use client'

import { useState, useEffect } from 'react'
import { useApi, useAuth } from '@/lib/auth-context'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import { formatCurrency, formatDateTime, todayIST, daysAgo } from '@/lib/format'
import { Receipt, Plus, Search, X, Trash2, RotateCcw, Printer, Eye } from 'lucide-react'

interface Patient { id: string; patientId: string; name: string; phone?: string; age?: number; gender?: string }
interface Doctor { id: string; name: string; specialization: string }
interface Test { id: string; code: string; name: string; price: number; category?: { name: string } | null }
interface Order { id: string; orderNumber: string; patient: Patient; doctor?: Doctor | null; totalAmount: number; status: string; orderTests: Array<{ id: string; test: Test; price: number; status: string }> }
interface Bill { id: string; billNumber: string; patient: Patient; order: Order; subtotal: number; discount: number; totalAmount: number; paidAmount: number; balanceAmount: number; refundAmount: number; status: string; createdAt: string; createdByName: string }

const PAYMENT_METHODS = ['cash', 'upi', 'card', 'cheque', 'bank', 'online']

export function BillingPage() {
  const api = useApi()
  const { user } = useAuth()
  const [tab, setTab] = useState('bills')
  const [bills, setBills] = useState<Bill[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const loadBills = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search) params.set('q', search)
      const status = statusFilter === 'all' ? '' : statusFilter
      if (status) params.set('status', status)
      const data = await api.get(`/api/bills?${params}`)
      setBills(data.bills || [])
    } catch (e: any) {
      toast.error(e.message || 'Failed to load bills')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadBills() }, [search, statusFilter])

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Billing</h1>
          <p className="text-muted-foreground text-sm mt-1">Create bills, process payments, manage dues</p>
        </div>
        <CreateBillButton onCreated={loadBills} />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="bills">All Bills</TabsTrigger>
          <TabsTrigger value="dues">Dues</TabsTrigger>
          <TabsTrigger value="payments">Record Payment</TabsTrigger>
        </TabsList>

        <TabsContent value="bills" className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Search bills, patients..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]"><SelectValue placeholder="All statuses" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="partial">Partial</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Card>
            <CardContent className="p-0">
              {loading ? (
                <p className="text-center text-muted-foreground py-12">Loading...</p>
              ) : bills.length === 0 ? (
                <p className="text-center text-muted-foreground py-12">No bills found. Create one to get started.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Bill #</TableHead>
                      <TableHead>Patient</TableHead>
                      <TableHead>Doctor</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-right">Paid</TableHead>
                      <TableHead className="text-right">Balance</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bills.map((b) => (
                      <BillRow key={b.id} bill={b} onChanged={loadBills} canRefund={user?.normalizedRole === 'admin' || user?.normalizedRole === 'super_admin'} />
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="dues">
          <DuesList bills={bills.filter((b) => b.status === 'pending' || b.status === 'partial')} onChanged={loadBills} />
        </TabsContent>

        <TabsContent value="payments">
          <RecordPaymentForm bills={bills} onDone={loadBills} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function BillRow({ bill, onChanged, canRefund }: { bill: Bill; onChanged: () => void; canRefund: boolean }) {
  const api = useApi()
  const [open, setOpen] = useState(false)
  const [refundOpen, setRefundOpen] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)

  const statusColor: Record<string, string> = {
    paid: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    partial: 'bg-amber-50 text-amber-700 border-amber-200',
    pending: 'bg-slate-50 text-slate-700 border-slate-200',
    cancelled: 'bg-rose-50 text-rose-700 border-rose-200',
  }

  return (
    <>
      <TableRow className="hover:bg-muted/30">
        <TableCell className="font-medium">{bill.billNumber}</TableCell>
        <TableCell>
          <div>
            <p className="font-medium">{bill.patient.name}</p>
            <p className="text-xs text-muted-foreground">{bill.patient.patientId}</p>
          </div>
        </TableCell>
        <TableCell>{bill.order.doctor?.name || 'Walk-in'}</TableCell>
        <TableCell className="text-right font-medium">{formatCurrency(bill.totalAmount)}</TableCell>
        <TableCell className="text-right text-emerald-600">{formatCurrency(bill.paidAmount)}</TableCell>
        <TableCell className="text-right text-amber-600">{formatCurrency(bill.balanceAmount)}</TableCell>
        <TableCell><Badge variant="outline" className={statusColor[bill.status]}>{bill.status}</Badge></TableCell>
        <TableCell className="text-xs text-muted-foreground">{formatDateTime(bill.createdAt)}</TableCell>
        <TableCell className="text-right">
          <div className="flex gap-1 justify-end">
            <Button size="sm" variant="ghost" onClick={() => setOpen(true)} title="View"><Eye className="w-4 h-4" /></Button>
            <Button size="sm" variant="ghost" onClick={() => window.print()} title="Print"><Printer className="w-4 h-4" /></Button>
            {canRefund && bill.paidAmount > 0 && bill.status !== 'cancelled' && (
              <Button size="sm" variant="ghost" onClick={() => setRefundOpen(true)} title="Refund" className="text-amber-600"><RotateCcw className="w-4 h-4" /></Button>
            )}
            {canRefund && bill.status !== 'cancelled' && (
              <Button size="sm" variant="ghost" onClick={() => setCancelOpen(true)} title="Cancel" className="text-rose-600"><X className="w-4 h-4" /></Button>
            )}
          </div>
        </TableCell>
      </TableRow>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Bill {bill.billNumber}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><p className="text-xs text-muted-foreground">Patient</p><p className="font-medium">{bill.patient.name}</p></div>
              <div><p className="text-xs text-muted-foreground">Doctor</p><p className="font-medium">{bill.order.doctor?.name || 'Walk-in'}</p></div>
              <div><p className="text-xs text-muted-foreground">Subtotal</p><p className="font-medium">{formatCurrency(bill.subtotal)}</p></div>
              <div><p className="text-xs text-muted-foreground">Discount</p><p className="font-medium">{formatCurrency(bill.discount)}</p></div>
              <div><p className="text-xs text-muted-foreground">Total</p><p className="font-semibold text-lg">{formatCurrency(bill.totalAmount)}</p></div>
              <div><p className="text-xs text-muted-foreground">Status</p><Badge variant="outline" className={statusColor[bill.status]}>{bill.status}</Badge></div>
            </div>
            <div>
              <p className="text-sm font-semibold mb-2">Tests</p>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {bill.order.orderTests.map((ot) => (
                  <div key={ot.id} className="flex justify-between text-sm p-2 rounded bg-muted/30">
                    <span>{ot.test.name} <span className="text-xs text-muted-foreground">({ot.test.code})</span></span>
                    <span>{formatCurrency(ot.price)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={refundOpen} onOpenChange={setRefundOpen}>
        <RefundDialog bill={bill} onClose={() => setRefundOpen(false)} onDone={() => { setRefundOpen(false); onChanged() }} />
      </Dialog>

      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <CancelDialog bill={bill} onClose={() => setCancelOpen(false)} onDone={() => { setCancelOpen(false); onChanged() }} />
      </Dialog>
    </>
  )
}

function RefundDialog({ bill, onClose, onDone }: { bill: Bill; onClose: () => void; onDone: () => void }) {
  const api = useApi()
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState('cash')
  const [reference, setReference] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      toast.error('Enter a positive amount')
      return
    }
    if (parseFloat(amount) > bill.paidAmount) {
      toast.error('Refund cannot exceed paid amount')
      return
    }
    setLoading(true)
    try {
      await api.post(`/api/bills/${bill.id}/refund`, { amount, method, reference, notes })
      toast.success('Refund processed')
      onDone()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <DialogContent>
      <DialogHeader><DialogTitle>Refund — {bill.billNumber}</DialogTitle></DialogHeader>
      <div className="space-y-4">
        <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg text-sm">
          Paid: <span className="font-semibold">{formatCurrency(bill.paidAmount)}</span> · Max refund: <span className="font-semibold">{formatCurrency(bill.paidAmount)}</span>
        </div>
        <div>
          <Label>Refund Amount</Label>
          <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
        </div>
        <div>
          <Label>Method</Label>
          <Select value={method} onValueChange={setMethod}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {PAYMENT_METHODS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Reference (optional)</Label>
          <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="UTR / cheque no" />
        </div>
        <div>
          <Label>Notes (optional)</Label>
          <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button onClick={submit} disabled={loading} className="bg-amber-500 hover:bg-amber-600 text-white">
          {loading ? 'Processing...' : 'Process Refund'}
        </Button>
      </DialogFooter>
    </DialogContent>
  )
}

function CancelDialog({ bill, onClose, onDone }: { bill: Bill; onClose: () => void; onDone: () => void }) {
  const api = useApi()
  const [reason, setReason] = useState('')
  const [autoRefund, setAutoRefund] = useState(false)
  const [autoRefundMethod, setAutoRefundMethod] = useState('cash')
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    if (!reason) { toast.error('Reason required'); return }
    setLoading(true)
    try {
      await api.post(`/api/bills/${bill.id}/cancel`, { reason, autoRefund, autoRefundMethod })
      toast.success('Bill cancelled')
      onDone()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <DialogContent>
      <DialogHeader><DialogTitle>Cancel Bill — {bill.billNumber}</DialogTitle></DialogHeader>
      <div className="space-y-4">
        <div className="bg-rose-50 border border-rose-200 p-3 rounded-lg text-sm">
          Cancelling will zero the balance and stop commission accrual. This cannot be undone.
        </div>
        <div>
          <Label>Reason</Label>
          <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Duplicate bill, patient request" />
        </div>
        {bill.paidAmount > 0 && (
          <div className="space-y-3 p-3 rounded-lg border border-border">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={autoRefund} onChange={(e) => setAutoRefund(e.target.checked)} className="rounded" />
              Auto-refund paid amount ({formatCurrency(bill.paidAmount)})
            </label>
            {autoRefund && (
              <div>
                <Label>Refund Method</Label>
                <Select value={autoRefundMethod} onValueChange={setAutoRefundMethod}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        )}
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>Close</Button>
        <Button variant="destructive" onClick={submit} disabled={loading}>
          {loading ? 'Cancelling...' : 'Cancel Bill'}
        </Button>
      </DialogFooter>
    </DialogContent>
  )
}

function CreateBillButton({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button onClick={() => setOpen(true)} className="bg-brand-gradient hover:opacity-90 text-white shadow-md">
        <Plus className="w-4 h-4 mr-2" /> Create Bill
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <CreateBillDialog onClose={() => setOpen(false)} onDone={() => { setOpen(false); onCreated() }} />
      </Dialog>
    </>
  )
}

function CreateBillDialog({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const api = useApi()
  const [step, setStep] = useState(1)
  const [patientSearch, setPatientSearch] = useState('')
  const [patients, setPatients] = useState<Patient[]>([])
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null)
  const [doctors, setDoctors] = useState<Doctor[]>([])
  const [selectedDoctor, setSelectedDoctor] = useState('')
  const [tests, setTests] = useState<Test[]>([])
  const [testSearch, setTestSearch] = useState('')
  const [selectedTests, setSelectedTests] = useState<Test[]>([])
  const [discount, setDiscount] = useState('')
  const [discountReason, setDiscountReason] = useState('')
  const [discountReasonNote, setDiscountReasonNote] = useState('')
  const [payments, setPayments] = useState<Array<{ amount: string; method: string }>>([{ amount: '', method: 'cash' }])
  const [creating, setCreating] = useState(false)
  const [newPatientName, setNewPatientName] = useState('')
  const [newPatientPhone, setNewPatientPhone] = useState('')
  const [newPatientAge, setNewPatientAge] = useState('')
  const [newPatientGender, setNewPatientGender] = useState('')

  useEffect(() => {
    api.get('/api/doctors').then((d) => setDoctors(d.doctors || [])).catch(() => {})
    api.get('/api/tests').then((d) => setTests(d.tests || [])).catch(() => {})
  }, [])

  useEffect(() => {
    if (patientSearch.length >= 1) {
      api.get(`/api/patients?q=${encodeURIComponent(patientSearch)}`).then((d) => setPatients(d.patients || [])).catch(() => {})
    } else {
      setPatients([])
    }
  }, [patientSearch])

  const filteredTests = tests.filter((t) =>
    t.name.toLowerCase().includes(testSearch.toLowerCase()) ||
    t.code.toLowerCase().includes(testSearch.toLowerCase()),
  )

  const subtotal = selectedTests.reduce((s, t) => s + t.price, 0)
  const discountAmt = parseFloat(discount || '0')
  const total = Math.max(0, subtotal - discountAmt)
  const paidNow = payments.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0)
  const balance = Math.max(0, total - paidNow)

  const createPatient = async () => {
    if (!newPatientName) { toast.error('Name required'); return }
    try {
      const d = await api.post('/api/patients', {
        name: newPatientName, phone: newPatientPhone, age: newPatientAge, gender: newPatientGender,
      })
      setSelectedPatient(d.patient)
      setNewPatientName(''); setNewPatientPhone(''); setNewPatientAge(''); setNewPatientGender('')
      toast.success('Patient created')
    } catch (e: any) { toast.error(e.message) }
  }

  const submit = async () => {
    if (!selectedPatient) { toast.error('Select a patient'); return }
    if (selectedTests.length === 0) { toast.error('Select at least one test'); return }
    setCreating(true)
    try {
      // 1. Create order
      const orderRes = await api.post('/api/orders', {
        patientId: selectedPatient.id,
        doctorId: selectedDoctor || undefined,
        testIds: selectedTests.map((t) => t.id),
      })
      // 2. Create bill with payments
      const validPayments = payments.filter((p) => p.amount && parseFloat(p.amount) > 0)
      const billRes = await api.post('/api/bills', {
        orderId: orderRes.order.id,
        discount: discountAmt,
        discountReason: discountReason || undefined,
        discountReasonNote: discountReasonNote || undefined,
        payments: validPayments,
      })
      toast.success(`Bill ${billRes.bill.billNumber} created`)
      onDone()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setCreating(false)
    }
  }

  return (
    <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>Create Bill</DialogTitle>
      </DialogHeader>
      <div className="space-y-6">
        {/* Step 1: Patient */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-semibold">1. Select Patient</Label>
            {selectedPatient && (
              <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200">
                {selectedPatient.name} · {selectedPatient.patientId}
              </Badge>
            )}
          </div>
          {!selectedPatient ? (
            <>
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Search existing</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input value={patientSearch} onChange={(e) => setPatientSearch(e.target.value)} placeholder="Name / phone / patient ID" className="pl-9" />
                  </div>
                  {patients.length > 0 && (
                    <div className="mt-2 max-h-40 overflow-y-auto border rounded-lg">
                      {patients.map((p) => (
                        <button key={p.id} onClick={() => setSelectedPatient(p)} className="w-full text-left p-2 hover:bg-emerald-50 border-b last:border-0 text-sm">
                          <span className="font-medium">{p.name}</span>
                          <span className="text-muted-foreground ml-2">{p.patientId}</span>
                          {p.phone && <span className="text-muted-foreground ml-2">· {p.phone}</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="border-l pl-3">
                  <Label className="text-xs">Or create new</Label>
                  <Input value={newPatientName} onChange={(e) => setNewPatientName(e.target.value)} placeholder="Name" className="mb-2" />
                  <div className="flex gap-2">
                    <Input value={newPatientPhone} onChange={(e) => setNewPatientPhone(e.target.value)} placeholder="Phone" className="flex-1" />
                    <Input value={newPatientAge} onChange={(e) => setNewPatientAge(e.target.value)} placeholder="Age" className="w-20" />
                  </div>
                  <Select value={newPatientGender} onValueChange={setNewPatientGender}>
                    <SelectTrigger className="mt-2"><SelectValue placeholder="Gender" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button size="sm" onClick={createPatient} className="mt-2 w-full bg-brand-gradient text-white">Create Patient</Button>
                </div>
              </div>
            </>
          ) : (
            <Button variant="outline" size="sm" onClick={() => setSelectedPatient(null)}>Change patient</Button>
          )}
        </div>

        {/* Step 2: Doctor */}
        <div className="space-y-2">
          <Label className="text-sm font-semibold">2. Referral Doctor (optional)</Label>
          <Select value={selectedDoctor} onValueChange={setSelectedDoctor}>
            <SelectTrigger><SelectValue placeholder="Walk-in (no doctor)" /></SelectTrigger>
            <SelectContent>
              {doctors.map((d) => <SelectItem key={d.id} value={d.id}>{d.name} — {d.specialization}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* Step 3: Tests */}
        <div className="space-y-2">
          <Label className="text-sm font-semibold">3. Tests</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input value={testSearch} onChange={(e) => setTestSearch(e.target.value)} placeholder="Search tests by name or code" className="pl-9" />
          </div>
          {testSearch && (
            <div className="max-h-40 overflow-y-auto border rounded-lg">
              {filteredTests.map((t) => (
                <button key={t.id} onClick={() => { setSelectedTests((p) => [...p, t]); setTestSearch('') }} className="w-full text-left p-2 hover:bg-emerald-50 border-b last:border-0 text-sm flex justify-between">
                  <span><span className="font-medium">{t.name}</span> <span className="text-xs text-muted-foreground">({t.code})</span></span>
                  <span className="font-medium">{formatCurrency(t.price)}</span>
                </button>
              ))}
            </div>
          )}
          {selectedTests.length > 0 && (
            <div className="space-y-1">
              {selectedTests.map((t, i) => (
                <div key={t.id} className="flex items-center justify-between p-2 rounded bg-muted/40 text-sm">
                  <span>{t.name} <span className="text-xs text-muted-foreground">({t.code})</span></span>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{formatCurrency(t.price)}</span>
                    <Button size="sm" variant="ghost" onClick={() => setSelectedTests((p) => p.filter((_, idx) => idx !== i))} className="h-7 w-7 p-0 text-rose-600">
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Step 4: Discount */}
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <Label className="text-sm font-semibold">4. Discount (optional)</Label>
            <Input type="number" value={discount} onChange={(e) => setDiscount(e.target.value)} placeholder="0.00" />
          </div>
          <div>
            <Label className="text-sm font-semibold">Discount Reason</Label>
            <Input value={discountReason} onChange={(e) => setDiscountReason(e.target.value)} placeholder="e.g. Staff, Senior, Charity" disabled={parseFloat(discount || '0') <= 0} />
          </div>
        </div>

        {/* Step 5: Payments */}
        <div className="space-y-2">
          <Label className="text-sm font-semibold">5. Payment (optional — leave blank for due)</Label>
          {payments.map((p, i) => (
            <div key={i} className="flex gap-2">
              <Input type="number" value={p.amount} onChange={(e) => setPayments((arr) => arr.map((x, idx) => idx === i ? { ...x, amount: e.target.value } : x))} placeholder="Amount" className="flex-1" />
              <Select value={p.method} onValueChange={(v) => setPayments((arr) => arr.map((x, idx) => idx === i ? { ...x, method: v } : x))}>
                <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
              {payments.length > 1 && (
                <Button size="sm" variant="ghost" onClick={() => setPayments((arr) => arr.filter((_, idx) => idx !== i))} className="text-rose-600">
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>
          ))}
          <Button size="sm" variant="outline" onClick={() => setPayments((p) => [...p, { amount: '', method: 'cash' }])}>
            <Plus className="w-3 h-3 mr-1" /> Add payment
          </Button>
        </div>

        {/* Summary */}
        <div className="p-4 rounded-lg bg-gradient-to-br from-emerald-50 to-amber-50 border border-emerald-100">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>Subtotal:</div><div className="text-right font-medium">{formatCurrency(subtotal)}</div>
            <div>Discount:</div><div className="text-right font-medium text-rose-600">-{formatCurrency(discountAmt)}</div>
            <div className="text-base font-semibold">Total:</div><div className="text-right text-base font-bold">{formatCurrency(total)}</div>
            <div>Paid now:</div><div className="text-right font-medium text-emerald-600">{formatCurrency(paidNow)}</div>
            <div className="font-semibold">Balance:</div><div className="text-right font-semibold text-amber-600">{formatCurrency(balance)}</div>
          </div>
        </div>
      </div>

      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button onClick={submit} disabled={creating} className="bg-brand-gradient hover:opacity-90 text-white">
          {creating ? 'Creating...' : 'Create Bill'}
        </Button>
      </DialogFooter>
    </DialogContent>
  )
}

function DuesList({ bills, onChanged }: { bills: Bill[]; onChanged: () => void }) {
  if (bills.length === 0) {
    return <Card><CardContent className="p-8 text-center text-muted-foreground">No outstanding dues 🎉</CardContent></Card>
  }
  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Bill #</TableHead>
              <TableHead>Patient</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Paid</TableHead>
              <TableHead className="text-right">Balance</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {bills.map((b) => (
              <TableRow key={b.id}>
                <TableCell className="font-medium">{b.billNumber}</TableCell>
                <TableCell>{b.patient.name}</TableCell>
                <TableCell>{b.patient.phone || '—'}</TableCell>
                <TableCell className="text-right">{formatCurrency(b.totalAmount)}</TableCell>
                <TableCell className="text-right text-emerald-600">{formatCurrency(b.paidAmount)}</TableCell>
                <TableCell className="text-right font-semibold text-amber-600">{formatCurrency(b.balanceAmount)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

function RecordPaymentForm({ bills, onDone }: { bills: Bill[]; onDone: () => void }) {
  const api = useApi()
  const [billId, setBillId] = useState('')
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState('cash')
  const [reference, setReference] = useState('')
  const [loading, setLoading] = useState(false)

  const dueBills = bills.filter((b) => b.balanceAmount > 0 && b.status !== 'cancelled')
  const selectedBill = dueBills.find((b) => b.id === billId)

  const submit = async () => {
    if (!billId || !amount) { toast.error('Select bill and enter amount'); return }
    setLoading(true)
    try {
      await api.post('/api/payments', { billId, amount, method, reference })
      toast.success('Payment recorded')
      setBillId(''); setAmount(''); setReference('')
      onDone()
    } catch (e: any) { toast.error(e.message) } finally { setLoading(false) }
  }

  return (
    <Card>
      <CardHeader><CardTitle>Record Payment</CardTitle></CardHeader>
      <CardContent className="space-y-4 max-w-xl">
        <div>
          <Label>Bill</Label>
          <Select value={billId} onValueChange={setBillId}>
            <SelectTrigger><SelectValue placeholder="Select a bill with due" /></SelectTrigger>
            <SelectContent>
              {dueBills.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.billNumber} — {b.patient.name} — Due: {formatCurrency(b.balanceAmount)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {selectedBill && (
          <div className="text-sm text-muted-foreground bg-muted/40 p-3 rounded-lg">
            Bill {selectedBill.billNumber} · Total {formatCurrency(selectedBill.totalAmount)} · Paid {formatCurrency(selectedBill.paidAmount)} · Balance <span className="font-semibold text-amber-600">{formatCurrency(selectedBill.balanceAmount)}</span>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Amount</Label>
            <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
          </div>
          <div>
            <Label>Method</Label>
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PAYMENT_METHODS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div>
          <Label>Reference (optional)</Label>
          <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="UTR / cheque no" />
        </div>
        <Button onClick={submit} disabled={loading} className="bg-brand-gradient hover:opacity-90 text-white">
          {loading ? 'Recording...' : 'Record Payment'}
        </Button>
      </CardContent>
    </Card>
  )
}
