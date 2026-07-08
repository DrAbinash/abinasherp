'use client'

import { useState, useEffect } from 'react'
import { useApi, useAuth } from '@/lib/auth-context'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { formatCurrency, formatDate, todayIST, daysAgo } from '@/lib/format'
import { Stethoscope, Plus, Percent, FileText, Users, UserCog, ShieldCheck, ScrollText, Settings, Banknote } from 'lucide-react'

// ============================================================
// REFERRAL DOCTORS
// ============================================================
export function ReferralsPage() {
  const api = useApi()
  const [doctors, setDoctors] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const d = await api.get(`/api/doctors?q=${encodeURIComponent(search)}`)
      setDoctors(d.doctors || [])
    } catch (e: any) { toast.error(e.message) } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [search])

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Referral Doctors</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage referring physicians, commission rules, payouts</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button className="bg-brand-gradient text-white"><Plus className="w-4 h-4 mr-1" /> New Doctor</Button></DialogTrigger>
          <NewDoctorDialog onClose={() => setOpen(false)} onDone={() => { setOpen(false); load() }} />
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <Input placeholder="Search by name, specialization, phone..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-md" />
        </CardHeader>
        <CardContent className="p-0">
          {loading ? <p className="text-center py-8 text-muted-foreground">Loading...</p> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Specialization</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Reg #</TableHead>
                  <TableHead>Default Commission</TableHead>
                  <TableHead>Orders</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {doctors.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="font-medium">{d.name}</TableCell>
                    <TableCell>{d.specialization}</TableCell>
                    <TableCell className="text-sm">{d.phone || '—'}</TableCell>
                    <TableCell className="text-xs font-mono">{d.registrationNumber || '—'}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {d.defaultCommissionType === 'percentage' ? `${d.defaultCommission}%` : formatCurrency(d.defaultCommission)}
                      </Badge>
                    </TableCell>
                    <TableCell>{d._count?.orders || 0}</TableCell>
                    <TableCell><Badge variant={d.isActive ? 'default' : 'secondary'}>{d.isActive ? 'Active' : 'Inactive'}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function NewDoctorDialog({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const api = useApi()
  const [form, setForm] = useState({
    name: '', specialization: '', phone: '', email: '', hospitalAffiliation: '',
    address: '', area: '', registrationNumber: '', defaultCommissionType: 'percentage', defaultCommission: '0',
  })
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    if (!form.name || !form.specialization) { toast.error('Name and specialization required'); return }
    setLoading(true)
    try {
      await api.post('/api/doctors', form)
      toast.success('Doctor created')
      onDone()
    } catch (e: any) { toast.error(e.message) } finally { setLoading(false) }
  }

  return (
    <DialogContent className="max-w-xl">
      <DialogHeader><DialogTitle>New Referral Doctor</DialogTitle></DialogHeader>
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
        <div><Label>Specialization *</Label><Input value={form.specialization} onChange={(e) => setForm({ ...form, specialization: e.target.value })} /></div>
        <div><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
        <div><Label>Email</Label><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
        <div><Label>Hospital</Label><Input value={form.hospitalAffiliation} onChange={(e) => setForm({ ...form, hospitalAffiliation: e.target.value })} /></div>
        <div><Label>Registration #</Label><Input value={form.registrationNumber} onChange={(e) => setForm({ ...form, registrationNumber: e.target.value })} /></div>
        <div><Label>Area</Label><Input value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} /></div>
        <div><Label>Address</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
        <div>
          <Label>Commission Type</Label>
          <Select value={form.defaultCommissionType} onValueChange={(v) => setForm({ ...form, defaultCommissionType: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="percentage">Percentage %</SelectItem><SelectItem value="fixed">Fixed Amount</SelectItem></SelectContent>
          </Select>
        </div>
        <div><Label>Default Commission</Label><Input type="number" value={form.defaultCommission} onChange={(e) => setForm({ ...form, defaultCommission: e.target.value })} /></div>
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button onClick={submit} disabled={loading} className="bg-brand-gradient text-white">{loading ? 'Creating...' : 'Create'}</Button>
      </DialogFooter>
    </DialogContent>
  )
}

// ============================================================
// COMMISSION REPORT (Super-admin only)
// ============================================================
export function CommissionPage() {
  const api = useApi()
  const [tab, setTab] = useState('summary')
  const [summary, setSummary] = useState<any>(null)
  const [detailed, setDetailed] = useState<any>(null)
  const [from, setFrom] = useState(daysAgo(30))
  const [to, setTo] = useState(todayIST())
  const [loading, setLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      if (tab === 'summary') {
        const d = await api.get(`/api/commission/report?from=${from}&to=${to}`)
        setSummary(d)
      } else {
        const d = await api.get(`/api/commission/report-detailed?from=${from}&to=${to}&groupBy=test`)
        setDetailed(d)
      }
    } catch (e: any) { toast.error(e.message) } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [tab, from, to])

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Commission Report</h1>
        <p className="text-muted-foreground text-sm mt-1">Per-doctor commission based on rules, defaults, and clinic discount mode</p>
      </div>

      <Card>
        <CardContent className="p-4 flex flex-wrap gap-3 items-end">
          <div><Label>From</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-44" /></div>
          <div><Label>To</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-44" /></div>
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList>
              <TabsTrigger value="summary">Summary</TabsTrigger>
              <TabsTrigger value="detailed">Detailed</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardContent>
      </Card>

      {loading ? <p className="text-center py-8 text-muted-foreground">Loading...</p> : tab === 'summary' && summary ? (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <Card className="bg-brand-gradient text-white border-0"><CardContent className="p-4"><p className="text-white/80 text-xs">Total Doctors</p><p className="text-2xl font-bold">{summary.grandTotal.doctors}</p></CardContent></Card>
            <Card className="bg-brand-gradient-blue text-white border-0"><CardContent className="p-4"><p className="text-white/80 text-xs">Total Revenue</p><p className="text-2xl font-bold">{formatCurrency(summary.grandTotal.revenue)}</p></CardContent></Card>
            <Card className="bg-brand-gradient-amber text-white border-0"><CardContent className="p-4"><p className="text-white/80 text-xs">Total Commission</p><p className="text-2xl font-bold">{formatCurrency(summary.grandTotal.commission)}</p></CardContent></Card>
          </div>
          <Card>
            <CardHeader><CardTitle>Per-Doctor Summary</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Doctor</TableHead>
                    <TableHead>Specialization</TableHead>
                    <TableHead className="text-right">Orders</TableHead>
                    <TableHead className="text-right">Tests</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                    <TableHead className="text-right">Commission</TableHead>
                    <TableHead className="text-right">Effective Rate</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {summary.report.map((r: any) => (
                    <TableRow key={r.doctor.id}>
                      <TableCell className="font-medium">{r.doctor.name}</TableCell>
                      <TableCell>{r.doctor.specialization}</TableCell>
                      <TableCell className="text-right">{r.orderCount}</TableCell>
                      <TableCell className="text-right">{r.testCount}</TableCell>
                      <TableCell className="text-right">{formatCurrency(r.totalRevenue)}</TableCell>
                      <TableCell className="text-right font-semibold text-emerald-600">{formatCurrency(r.totalCommission)}</TableCell>
                      <TableCell className="text-right">{r.effectiveRate.toFixed(2)}%</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      ) : detailed ? (
        <Card>
          <CardHeader><CardTitle>Detailed Commission by Test</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Doctor</TableHead>
                  <TableHead>Bill #</TableHead>
                  <TableHead>Patient</TableHead>
                  <TableHead>Test</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead className="text-right">Commission</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {detailed.rows.map((r: any, i: number) => (
                  <TableRow key={i}>
                    <TableCell>{r.doctorName}</TableCell>
                    <TableCell className="font-mono text-xs">{r.billNumber}</TableCell>
                    <TableCell>{r.patientName}</TableCell>
                    <TableCell>{r.testName}</TableCell>
                    <TableCell className="text-xs">{r.category}</TableCell>
                    <TableCell className="text-right">{formatCurrency(r.price)}</TableCell>
                    <TableCell className="text-right font-semibold text-emerald-600">{formatCurrency(r.commission)}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="font-bold bg-muted/40">
                  <TableCell colSpan={5}>Grand Total ({detailed.grandTotal.tests} tests)</TableCell>
                  <TableCell className="text-right">{formatCurrency(detailed.grandTotal.revenue)}</TableCell>
                  <TableCell className="text-right text-emerald-700">{formatCurrency(detailed.grandTotal.commission)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}

// ============================================================
// DOCTOR LEDGER (Super-admin only)
// ============================================================
export function DoctorLedgerPage() {
  const api = useApi()
  const [summary, setSummary] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [detail, setDetail] = useState<any>(null)
  const [payoutOpen, setPayoutOpen] = useState(false)
  const [selectedDoctor, setSelectedDoctor] = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const d = await api.get('/api/doctor-ledger')
      setSummary(d.summary || [])
    } catch (e: any) { toast.error(e.message) } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const viewDetail = async (doctorId: string) => {
    try {
      const d = await api.get(`/api/doctor-ledger/${doctorId}`)
      setDetail(d)
      setSelectedDoctor(doctorId)
    } catch (e: any) { toast.error(e.message) }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Doctor Ledger</h1>
        <p className="text-muted-foreground text-sm mt-1">Earned vs paid commission per doctor — track outstanding payouts</p>
      </div>

      <Card>
        <CardHeader><CardTitle>Doctor Outstanding Summary</CardTitle></CardHeader>
        <CardContent className="p-0">
          {loading ? <p className="text-center py-8 text-muted-foreground">Loading...</p> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Doctor</TableHead>
                  <TableHead>Specialization</TableHead>
                  <TableHead className="text-right">Orders</TableHead>
                  <TableHead className="text-right">Earned (Life)</TableHead>
                  <TableHead className="text-right">Paid (Life)</TableHead>
                  <TableHead className="text-right">Outstanding</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summary.map((s) => (
                  <TableRow key={s.doctorId}>
                    <TableCell className="font-medium">{s.doctorName}</TableCell>
                    <TableCell>{s.specialization}</TableCell>
                    <TableCell className="text-right">{s.orderCount}</TableCell>
                    <TableCell className="text-right">{formatCurrency(s.earnedLifetime)}</TableCell>
                    <TableCell className="text-right text-emerald-600">{formatCurrency(s.paidLifetime)}</TableCell>
                    <TableCell className="text-right font-semibold text-amber-600">{formatCurrency(s.outstanding)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-1 justify-end">
                        <Button size="sm" variant="ghost" onClick={() => viewDetail(s.doctorId)}><FileText className="w-4 h-4" /></Button>
                        <Button size="sm" variant="ghost" onClick={() => { setSelectedDoctor(s.doctorId); setPayoutOpen(true) }} className="text-emerald-600"><Banknote className="w-4 h-4" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {detail && (
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Ledger — {detail.doctor.name}</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => setDetail(null)}>Close</Button>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <div className="p-3 rounded-lg bg-emerald-50"><p className="text-xs text-muted-foreground">Total Revenue</p><p className="text-lg font-bold">{formatCurrency(detail.summary.totalRevenue)}</p></div>
              <div className="p-3 rounded-lg bg-amber-50"><p className="text-xs text-muted-foreground">Total Earned</p><p className="text-lg font-bold">{formatCurrency(detail.summary.totalEarned)}</p></div>
              <div className="p-3 rounded-lg bg-blue-50"><p className="text-xs text-muted-foreground">Total Paid</p><p className="text-lg font-bold">{formatCurrency(detail.summary.totalPaid)}</p></div>
              <div className="p-3 rounded-lg bg-rose-50"><p className="text-xs text-muted-foreground">Outstanding</p><p className="text-lg font-bold">{formatCurrency(detail.summary.outstanding)}</p></div>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {detail.entries.map((e: any, i: number) => (
                  <TableRow key={i}>
                    <TableCell className="text-xs">{formatDate(e.date)}</TableCell>
                    <TableCell><Badge variant="outline" className={e.type === 'earned' ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-blue-700'}>{e.type}</Badge></TableCell>
                    <TableCell className="text-sm">{e.description}</TableCell>
                    <TableCell className="text-xs">{e.reference}</TableCell>
                    <TableCell className={`text-right font-medium ${e.amount >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{e.amount >= 0 ? '+' : ''}{formatCurrency(e.amount)}</TableCell>
                    <TableCell className="text-right font-semibold">{formatCurrency(e.balance)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Dialog open={payoutOpen} onOpenChange={setPayoutOpen}>
        <PayoutDialog doctorId={selectedDoctor} onClose={() => setPayoutOpen(false)} onDone={() => { setPayoutOpen(false); load() }} />
      </Dialog>
    </div>
  )
}

function PayoutDialog({ doctorId, onClose, onDone }: { doctorId: string; onClose: () => void; onDone: () => void }) {
  const api = useApi()
  const [amount, setAmount] = useState('')
  const [paymentDate, setPaymentDate] = useState(todayIST())
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [reference, setReference] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    if (!amount || parseFloat(amount) <= 0) { toast.error('Enter positive amount'); return }
    setLoading(true)
    try {
      await api.post(`/api/doctor-ledger/${doctorId}/payouts`, { amount, paymentDate, paymentMethod, reference, notes })
      toast.success('Payout recorded')
      onDone()
    } catch (e: any) { toast.error(e.message) } finally { setLoading(false) }
  }

  return (
    <DialogContent>
      <DialogHeader><DialogTitle>Record Payout</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div><Label>Amount</Label><Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
        <div><Label>Date</Label><Input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} /></div>
        <div>
          <Label>Method</Label>
          <Select value={paymentMethod} onValueChange={setPaymentMethod}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {['cash', 'bank', 'upi', 'cheque', 'card', 'other'].map((m) => <SelectItem key={m} value={m} className="capitalize">{m}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div><Label>Reference (optional)</Label><Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Cheque # / UTR" /></div>
        <div><Label>Notes</Label><Input value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button onClick={submit} disabled={loading} className="bg-brand-gradient text-white">{loading ? 'Recording...' : 'Record'}</Button>
      </DialogFooter>
    </DialogContent>
  )
}

// ============================================================
// STAFF (HR)
// ============================================================
export function StaffPage() {
  const api = useApi()
  const [staff, setStaff] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const d = await api.get(`/api/staff?q=${encodeURIComponent(search)}`)
      setStaff(d.staff || [])
    } catch (e: any) { toast.error(e.message) } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [search])

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Staff</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage employees, advances, salary, attendance</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button className="bg-brand-gradient text-white"><Plus className="w-4 h-4 mr-1" /> New Staff</Button></DialogTrigger>
          <NewStaffDialog onClose={() => setOpen(false)} onDone={() => { setOpen(false); load() }} />
        </Dialog>
      </div>

      <Card>
        <CardHeader><Input placeholder="Search by name, staff ID, phone..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-md" /></CardHeader>
        <CardContent className="p-0">
          {loading ? <p className="text-center py-8 text-muted-foreground">Loading...</p> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Staff ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead className="text-right">Salary</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {staff.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-mono text-xs">{s.staffId}</TableCell>
                    <TableCell className="font-medium">{s.firstName} {s.lastName || ''}</TableCell>
                    <TableCell><Badge variant="outline" className="capitalize">{s.role}</Badge></TableCell>
                    <TableCell className="text-sm">{s.department || '—'}</TableCell>
                    <TableCell className="text-sm">{s.phone || '—'}</TableCell>
                    <TableCell className="text-xs">{formatDate(s.joiningDate)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(s.baseSalary)}</TableCell>
                    <TableCell><Badge variant={s.isActive ? 'default' : 'secondary'}>{s.isActive ? 'Active' : 'Inactive'}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function NewStaffDialog({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const api = useApi()
  const [form, setForm] = useState({
    firstName: '', lastName: '', phone: '', email: '', role: 'receptionist', department: '',
    joiningDate: todayIST(), baseSalary: '0', address: '', emergencyContact: '', bankAccount: '', ifsc: '', notes: '',
  })
  const [loading, setLoading] = useState(false)
  const ROLES = ['receptionist', 'lab-technician', 'radiologist', 'phlebotomist', 'doctor', 'nurse', 'manager', 'accountant', 'cleaner', 'security', 'other']

  const submit = async () => {
    if (!form.firstName) { toast.error('First name required'); return }
    setLoading(true)
    try {
      await api.post('/api/staff', form)
      toast.success('Staff member added')
      onDone()
    } catch (e: any) { toast.error(e.message) } finally { setLoading(false) }
  }

  return (
    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
      <DialogHeader><DialogTitle>New Staff Member</DialogTitle></DialogHeader>
      <div className="grid grid-cols-2 gap-3">
        <div><Label>First Name *</Label><Input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} /></div>
        <div><Label>Last Name</Label><Input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} /></div>
        <div><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
        <div><Label>Email</Label><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
        <div>
          <Label>Role</Label>
          <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{ROLES.map((r) => <SelectItem key={r} value={r} className="capitalize">{r}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label>Department</Label><Input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} /></div>
        <div><Label>Joining Date</Label><Input type="date" value={form.joiningDate} onChange={(e) => setForm({ ...form, joiningDate: e.target.value })} /></div>
        <div><Label>Base Salary</Label><Input type="number" value={form.baseSalary} onChange={(e) => setForm({ ...form, baseSalary: e.target.value })} /></div>
        <div><Label>Bank Account</Label><Input value={form.bankAccount} onChange={(e) => setForm({ ...form, bankAccount: e.target.value })} /></div>
        <div><Label>IFSC</Label><Input value={form.ifsc} onChange={(e) => setForm({ ...form, ifsc: e.target.value })} /></div>
        <div><Label>Emergency Contact</Label><Input value={form.emergencyContact} onChange={(e) => setForm({ ...form, emergencyContact: e.target.value })} /></div>
        <div><Label>Address</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button onClick={submit} disabled={loading} className="bg-brand-gradient text-white">{loading ? 'Adding...' : 'Add Staff'}</Button>
      </DialogFooter>
    </DialogContent>
  )
}

// ============================================================
// USERS & ROLES (Super-admin / admin)
// ============================================================
export function UsersPage() {
  const api = useApi()
  const [users, setUsers] = useState<any[]>([])
  const [roles, setRoles] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [editUser, setEditUser] = useState<any>(null)

  const load = async () => {
    setLoading(true)
    try {
      const d = await api.get('/api/users')
      setUsers(d.users || [])
      setRoles(d.roles || [])
    } catch (e: any) { toast.error(e.message) } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const toggleActive = async (u: any) => {
    try {
      await api.patch(`/api/users/${u.id}`, { isActive: !u.isActive })
      toast.success(`User ${!u.isActive ? 'activated' : 'deactivated'}`)
      load()
    } catch (e: any) { toast.error(e.message) }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Users & Roles</h1>
          <p className="text-muted-foreground text-sm mt-1">Login accounts, role assignments, permissions</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button className="bg-brand-gradient text-white"><Plus className="w-4 h-4 mr-1" /> New User</Button></DialogTrigger>
          <NewUserDialog roles={roles} onClose={() => setOpen(false)} onDone={() => { setOpen(false); load() }} />
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? <p className="text-center py-8 text-muted-foreground">Loading...</p> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Max Discount</TableHead>
                  <TableHead>Remote Login</TableHead>
                  <TableHead>Must Change PIN</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.name}</TableCell>
                    <TableCell className="text-sm">{u.email}</TableCell>
                    <TableCell><Badge variant="outline" className={u.role === 'super_admin' ? 'bg-amber-50 text-amber-700 border-amber-200' : u.role === 'admin' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : ''}>{u.role}</Badge></TableCell>
                    <TableCell className="text-right">{u.maxDiscount}%</TableCell>
                    <TableCell>{u.remoteLoginEnabled ? <Badge variant="outline" className="bg-blue-50 text-blue-700">Yes</Badge> : '—'}</TableCell>
                    <TableCell>{u.mustChangePin ? <Badge variant="outline" className="bg-amber-50 text-amber-700">Yes</Badge> : '—'}</TableCell>
                    <TableCell><Badge variant={u.isActive ? 'default' : 'secondary'}>{u.isActive ? 'Active' : 'Inactive'}</Badge></TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-1 justify-end">
                        <Button size="sm" variant="ghost" onClick={() => setEditUser(u)}><UserCog className="w-4 h-4" /></Button>
                        <Button size="sm" variant="ghost" onClick={() => toggleActive(u)} className={u.isActive ? 'text-rose-600' : 'text-emerald-600'}>
                          {u.isActive ? 'Deactivate' : 'Activate'}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!editUser} onOpenChange={(o) => !o && setEditUser(null)}>
        {editUser && <EditUserDialog user={editUser} roles={roles} onClose={() => setEditUser(null)} onDone={() => { setEditUser(null); load() }} />}
      </Dialog>
    </div>
  )
}

function NewUserDialog({ roles, onClose, onDone }: { roles: string[]; onClose: () => void; onDone: () => void }) {
  const api = useApi()
  const [form, setForm] = useState({ name: '', email: '', username: '', role: 'receptionist', pin: '', maxDiscount: '0', remoteLoginEnabled: false })
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    if (!form.name || !form.email || !form.pin) { toast.error('Name, email, PIN required'); return }
    setLoading(true)
    try {
      await api.post('/api/users', form)
      toast.success('User created')
      onDone()
    } catch (e: any) { toast.error(e.message) } finally { setLoading(false) }
  }

  return (
    <DialogContent>
      <DialogHeader><DialogTitle>New User</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div><Label>Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
        <div><Label>Email *</Label><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
        <div><Label>Username (optional)</Label><Input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} /></div>
        <div>
          <Label>Role</Label>
          <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{roles.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>PIN *</Label><Input type="password" value={form.pin} onChange={(e) => setForm({ ...form, pin: e.target.value })} /></div>
          <div><Label>Max Discount %</Label><Input type="number" value={form.maxDiscount} onChange={(e) => setForm({ ...form, maxDiscount: e.target.value })} /></div>
        </div>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={form.remoteLoginEnabled} onChange={(e) => setForm({ ...form, remoteLoginEnabled: e.target.checked })} />
          Allow remote super-admin login (bypass USB key)
        </label>
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button onClick={submit} disabled={loading} className="bg-brand-gradient text-white">{loading ? 'Creating...' : 'Create'}</Button>
      </DialogFooter>
    </DialogContent>
  )
}

function EditUserDialog({ user, roles, onClose, onDone }: { user: any; roles: string[]; onClose: () => void; onDone: () => void }) {
  const api = useApi()
  const [form, setForm] = useState({
    name: user.name, email: user.email, username: user.username || '',
    role: user.role, maxDiscount: String(user.maxDiscount || 0),
    remoteLoginEnabled: user.remoteLoginEnabled, pin: '',
  })
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    setLoading(true)
    try {
      const update: any = { name: form.name, email: form.email, username: form.username, role: form.role, maxDiscount: form.maxDiscount, remoteLoginEnabled: form.remoteLoginEnabled }
      if (form.pin) update.pin = form.pin
      await api.patch(`/api/users/${user.id}`, update)
      toast.success('User updated')
      onDone()
    } catch (e: any) { toast.error(e.message) } finally { setLoading(false) }
  }

  return (
    <DialogContent>
      <DialogHeader><DialogTitle>Edit User — {user.name}</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
        <div><Label>Email</Label><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
        <div><Label>Username</Label><Input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} /></div>
        <div>
          <Label>Role</Label>
          <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{roles.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label>Max Discount %</Label><Input type="number" value={form.maxDiscount} onChange={(e) => setForm({ ...form, maxDiscount: e.target.value })} /></div>
        <div><Label>Reset PIN (leave blank to keep)</Label><Input type="password" value={form.pin} onChange={(e) => setForm({ ...form, pin: e.target.value })} /></div>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={form.remoteLoginEnabled} onChange={(e) => setForm({ ...form, remoteLoginEnabled: e.target.checked })} />
          Allow remote super-admin login
        </label>
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button onClick={submit} disabled={loading} className="bg-brand-gradient text-white">{loading ? 'Saving...' : 'Save'}</Button>
      </DialogFooter>
    </DialogContent>
  )
}

// ============================================================
// ROLE PERMISSIONS MATRIX (Super-admin only)
// ============================================================
export function RolePermissionsPage() {
  const api = useApi()
  const [perms, setPerms] = useState<any[]>([])
  const [roles, setRoles] = useState<string[]>([])
  const [modules, setModules] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try {
      const d = await api.get('/api/role-permissions')
      setPerms(d.perms || [])
      setRoles(d.roles || [])
      setModules(d.modules || [])
    } catch (e: any) { toast.error(e.message) } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const seed = async () => {
    try {
      await api.post('/api/role-permissions', {})
      toast.success('Default permissions seeded')
      load()
    } catch (e: any) { toast.error(e.message) }
  }

  const toggle = async (role: string, module: string, flag: string, current: boolean) => {
    try {
      await api.put('/api/role-permissions', { role, module, [flag]: !current })
      load()
    } catch (e: any) { toast.error(e.message) }
  }

  const getPerm = (role: string, module: string) => perms.find((p) => p.role === role && p.module === module)
  const FLAGS = ['canView', 'canCreate', 'canEdit', 'canDelete', 'canPrint', 'canReprint', 'canRefund', 'canExport', 'canApprove', 'canFinalize']

  if (loading) return <div className="p-8 text-center text-muted-foreground">Loading...</div>

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Role Permissions Matrix</h1>
          <p className="text-muted-foreground text-sm mt-1">Granular per-role, per-module permission flags</p>
        </div>
        <Button onClick={seed} variant="outline">Seed Defaults</Button>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="sticky left-0 bg-card">Role</TableHead>
                <TableHead className="sticky left-0 bg-card">Module</TableHead>
                {FLAGS.map((f) => <TableHead key={f} className="text-center text-xs">{f.replace('can', '')}</TableHead>)}
              </TableRow>
            </TableHeader>
            <TableBody>
              {roles.filter((r) => r !== 'super_admin' && r !== 'admin').map((role) =>
                modules.map((mod) => {
                  const p = getPerm(role, mod) || {}
                  return (
                    <TableRow key={`${role}-${mod}`}>
                      <TableCell className="font-medium sticky left-0 bg-card">{role}</TableCell>
                      <TableCell className="sticky left-0 bg-card ml-20">{mod}</TableCell>
                      {FLAGS.map((f) => (
                        <TableCell key={f} className="text-center">
                          <button
                            onClick={() => toggle(role, mod, f, !!p[f])}
                            className={`w-6 h-6 rounded ${p[f] ? 'bg-emerald-500 text-white' : 'bg-muted text-muted-foreground'}`}
                          >
                            {p[f] ? '✓' : '·'}
                          </button>
                        </TableCell>
                      ))}
                    </TableRow>
                  )
                }),
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

// ============================================================
// CLINIC SETTINGS
// ============================================================
export function ClinicPage() {
  const api = useApi()
  const [clinic, setClinic] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<any>({})

  const load = async () => {
    setLoading(true)
    try {
      const d = await api.get('/api/clinic')
      setClinic(d.clinic)
      setForm(d.clinic || {})
    } catch (e: any) { toast.error(e.message) } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const save = async () => {
    setSaving(true)
    try {
      await api.put('/api/clinic', form)
      toast.success('Clinic settings saved')
      load()
    } catch (e: any) { toast.error(e.message) } finally { setSaving(false) }
  }

  if (loading) return <div className="p-8 text-center text-muted-foreground">Loading...</div>

  return (
    <div className="space-y-6 animate-fade-in max-w-3xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Clinic Settings</h1>
        <p className="text-muted-foreground text-sm mt-1">Configure clinic info, commission mode, session timeout</p>
      </div>

      <Card>
        <CardHeader><CardTitle>General</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Clinic Name</Label><Input value={form.name || ''} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label>Phone</Label><Input value={form.phone || ''} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            <div><Label>Email</Label><Input value={form.email || ''} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div><Label>GSTIN</Label><Input value={form.gstin || ''} onChange={(e) => setForm({ ...form, gstin: e.target.value })} /></div>
            <div><Label>Registration #</Label><Input value={form.registrationNo || ''} onChange={(e) => setForm({ ...form, registrationNo: e.target.value })} /></div>
            <div><Label>Currency</Label><Input value={form.currency || 'INR'} onChange={(e) => setForm({ ...form, currency: e.target.value })} /></div>
          </div>
          <div><Label>Address</Label><Input value={form.address || ''} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Commission & Financial</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Commission Discount Mode</Label>
              <Select value={form.commissionDiscountMode || 'none'} onValueChange={(v) => setForm({ ...form, commissionDiscountMode: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="deduct">Deduct (floor 0)</SelectItem>
                  <SelectItem value="deduct_rollover">Deduct + Rollover (can go negative)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>VIP Percentage</Label><Input type="number" value={form.vipPercentage || 50} onChange={(e) => setForm({ ...form, vipPercentage: e.target.value })} /></div>
            <div><Label>Session Idle Timeout (min)</Label><Input type="number" value={form.sessionIdleTimeoutMinutes || 30} onChange={(e) => setForm({ ...form, sessionIdleTimeoutMinutes: e.target.value })} /></div>
          </div>
        </CardContent>
      </Card>

      <Button onClick={save} disabled={saving} className="bg-brand-gradient text-white">
        {saving ? 'Saving...' : 'Save Settings'}
      </Button>
    </div>
  )
}

// ============================================================
// AUDIT LOGS
// ============================================================
export function AuditLogsPage() {
  const api = useApi()
  const [logs, setLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/api/audit-logs?limit=200').then((d) => { setLogs(d.logs || []); setLoading(false) }).catch((e) => { toast.error(e.message); setLoading(false) })
  }, [])

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Audit Logs</h1>
        <p className="text-muted-foreground text-sm mt-1">System-wide audit trail of user actions</p>
      </div>
      <Card>
        <CardContent className="p-0">
          {loading ? <p className="text-center py-8 text-muted-foreground">Loading...</p> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Module</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead>Details</TableHead>
                  <TableHead>IP</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="text-xs">{formatDate(l.createdAt)} {new Date(l.createdAt).toLocaleTimeString()}</TableCell>
                    <TableCell>{l.userName || '—'}</TableCell>
                    <TableCell><Badge variant="outline">{l.module}</Badge></TableCell>
                    <TableCell className="font-medium">{l.action}</TableCell>
                    <TableCell className="text-xs font-mono">{l.entityId?.slice(-8) || '—'}</TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-xs truncate">{l.details}</TableCell>
                    <TableCell className="text-xs">{l.ipAddress}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ============================================================
// DAY CLOSE
// ============================================================
export function DayClosePage() {
  const api = useApi()
  const { user } = useAuth()
  const [tab, setTab] = useState('clinic')
  const [closures, setClosures] = useState<any[]>([])
  const [myClosures, setMyClosures] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const [d1, d2] = await Promise.all([
        api.get('/api/day-close'),
        api.get('/api/day-close/my-close'),
      ])
      setClosures(d1.closures || [])
      setMyClosures(d2.closures || [])
    } catch (e: any) { toast.error(e.message) } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Day Close</h1>
          <p className="text-muted-foreground text-sm mt-1">End-of-day reconciliation — clinic-level and per-user drawer</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DayCloseDialog isOwner={user?.normalizedRole === 'admin' || user?.normalizedRole === 'super_admin'} onClose={() => setOpen(false)} onDone={() => { setOpen(false); load() }} />
          </DialogContent>
        </Dialog>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="clinic">Clinic Day Close</TabsTrigger>
          <TabsTrigger value="my">My Drawer Close</TabsTrigger>
        </TabsList>
        <TabsContent value="clinic">
          <Card>
            <CardHeader><CardTitle>Clinic Day Closures</CardTitle></CardHeader>
            <CardContent className="p-0">
              {loading ? <p className="text-center py-8 text-muted-foreground">Loading...</p> : closures.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">No closures yet</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Closed By</TableHead>
                      <TableHead className="text-right">Expected</TableHead>
                      <TableHead className="text-right">Actual</TableHead>
                      <TableHead className="text-right">Variance</TableHead>
                      <TableHead>Bills</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {closures.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell>{formatDate(c.closureDate)}</TableCell>
                        <TableCell>{c.closedByName}</TableCell>
                        <TableCell className="text-right">{formatCurrency(c.totalExpected)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(c.totalActual)}</TableCell>
                        <TableCell className={`text-right font-medium ${c.variance === 0 ? 'text-emerald-600' : c.variance > 0 ? 'text-amber-600' : 'text-rose-600'}`}>{formatCurrency(c.variance)}</TableCell>
                        <TableCell>{c.billsCount}</TableCell>
                        <TableCell><Badge variant="outline" className={c.status === 'closed' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}>{c.status}</Badge></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="my">
          <Card>
            <CardHeader><CardTitle>My Drawer Closures</CardTitle></CardHeader>
            <CardContent className="p-0">
              {loading ? <p className="text-center py-8 text-muted-foreground">Loading...</p> : myClosures.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">No personal closures yet</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Expected</TableHead>
                      <TableHead className="text-right">Actual</TableHead>
                      <TableHead className="text-right">Variance</TableHead>
                      <TableHead>Drawer Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {myClosures.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell>{formatDate(c.closureDate)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(c.totalExpected)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(c.totalActual)}</TableCell>
                        <TableCell className={`text-right font-medium ${c.variance === 0 ? 'text-emerald-600' : 'text-amber-600'}`}>{formatCurrency(c.variance)}</TableCell>
                        <TableCell><Badge variant="outline" className={
                          c.drawerStatus === 'balanced' ? 'bg-emerald-50 text-emerald-700' :
                          c.drawerStatus === 'mismatch' ? 'bg-amber-50 text-amber-700' :
                          c.drawerStatus === 'approved' ? 'bg-blue-50 text-blue-700' : 'bg-slate-50'
                        }>{c.drawerStatus}</Badge></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function DayCloseDialog({ isOwner, onClose, onDone }: { isOwner: boolean; onClose: () => void; onDone: () => void }) {
  const api = useApi()
  const [actuals, setActuals] = useState({ cash: '', upi: '', card: '', cheque: '', other: '' })
  const [varianceNote, setVarianceNote] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    setLoading(true)
    try {
      if (isOwner) {
        await api.post('/api/day-close', { ...actuals, varianceNote })
      } else {
        await api.post('/api/day-close/my-close', { ...actuals, varianceNote })
      }
      toast.success('Day closed successfully')
      onDone()
    } catch (e: any) { toast.error(e.message) } finally { setLoading(false) }
  }

  return (
    <>
      <DialogHeader><DialogTitle>{isOwner ? 'Clinic Day Close' : 'My Drawer Close'}</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg text-sm">
          Enter the actual counted amounts for each payment method. The system will calculate variance from expected.
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Actual Cash</Label><Input type="number" value={actuals.cash} onChange={(e) => setActuals({ ...actuals, cash: e.target.value })} /></div>
          <div><Label>Actual UPI</Label><Input type="number" value={actuals.upi} onChange={(e) => setActuals({ ...actuals, upi: e.target.value })} /></div>
          <div><Label>Actual Card</Label><Input type="number" value={actuals.card} onChange={(e) => setActuals({ ...actuals, card: e.target.value })} /></div>
          <div><Label>Actual Cheque</Label><Input type="number" value={actuals.cheque} onChange={(e) => setActuals({ ...actuals, cheque: e.target.value })} /></div>
          <div><Label>Actual Other</Label><Input type="number" value={actuals.other} onChange={(e) => setActuals({ ...actuals, other: e.target.value })} /></div>
        </div>
        <div><Label>Variance Note (optional)</Label><Input value={varianceNote} onChange={(e) => setVarianceNote(e.target.value)} placeholder="Explanation for any variance" /></div>
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button onClick={submit} disabled={loading} className="bg-brand-gradient text-white">{loading ? 'Closing...' : 'Close Day'}</Button>
      </DialogFooter>
    </>
  )
}
