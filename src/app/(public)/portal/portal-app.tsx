'use client'

import { useState, useEffect, useCallback } from 'react'
import { apiPath } from '@/lib/base-path'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { toast } from 'sonner'
import { formatCurrency, formatDateTime, formatDate, todayIST, daysFromNow } from '@/lib/format'
import { Activity, Phone, KeyRound, FileText, Receipt, Calendar, LogOut, Loader2, CheckCircle, ArrowRight, Download } from 'lucide-react'

const PORTAL_TOKEN_KEY = 'care_portal_token'

export function PortalApp() {
  const [token, setToken] = useState<string | null>(null)
  const [patient, setPatient] = useState<any>(null)
  const [summary, setSummary] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const t = typeof window !== 'undefined' ? localStorage.getItem(PORTAL_TOKEN_KEY) : null
    if (t) {
      setToken(t)
      fetchPatient(t)
    } else {
      setIsLoading(false)
    }
  }, [])

  const fetchPatient = async (t: string) => {
    try {
      const res = await fetch(apiPath('/api/portal/me'), { headers: { Authorization: `Bearer ${t}` } })
      if (!res.ok) {
        localStorage.removeItem(PORTAL_TOKEN_KEY)
        setToken(null)
        setIsLoading(false)
        return
      }
      const data = await res.json()
      setPatient(data.patient)
      setSummary(data.summary)
    } catch {} finally { setIsLoading(false) }
  }

  const logout = async () => {
    if (token) {
      fetch(apiPath('/api/portal/me'), { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }).catch(() => {})
    }
    localStorage.removeItem(PORTAL_TOKEN_KEY)
    setToken(null)
    setPatient(null)
    setSummary(null)
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    )
  }

  if (!token || !patient) {
    return <LoginScreen onLogin={(t, p, s) => { setToken(t); setPatient(p); setSummary(s) }} />
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-amber-50">
      <header className="bg-brand-gradient text-white py-4 shadow-lg">
        <div className="max-w-5xl mx-auto px-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center">
              <Activity className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Patient Portal</h1>
              <p className="text-white/80 text-xs">Welcome, {patient.name}</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={logout} className="text-white hover:bg-white/20">
            <LogOut className="w-4 h-4 mr-1" /> Logout
          </Button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Total Visits</p><p className="text-2xl font-bold">{summary?.totalVisits || 0}</p></CardContent></Card>
          <Card className="bg-rose-50"><CardContent className="p-3"><p className="text-xs text-rose-700">Outstanding Dues</p><p className="text-2xl font-bold text-rose-600">{formatCurrency(summary?.outstandingDues || 0)}</p></CardContent></Card>
          <Card className="bg-emerald-50"><CardContent className="p-3"><p className="text-xs text-emerald-700">Reports Ready</p><p className="text-2xl font-bold text-emerald-600">{summary?.reportsReady || 0}</p></CardContent></Card>
          <Card className="bg-blue-50"><CardContent className="p-3"><p className="text-xs text-blue-700">Upcoming Appts</p><p className="text-2xl font-bold text-blue-600">{summary?.upcomingAppointments || 0}</p></CardContent></Card>
        </div>

        <Tabs defaultValue="reports">
          <TabsList className="grid w-full grid-cols-3 max-w-md">
            <TabsTrigger value="reports"><FileText className="w-4 h-4 mr-1" /> Reports</TabsTrigger>
            <TabsTrigger value="bills"><Receipt className="w-4 h-4 mr-1" /> Bills</TabsTrigger>
            <TabsTrigger value="appointments"><Calendar className="w-4 h-4 mr-1" /> Appointments</TabsTrigger>
          </TabsList>

          <TabsContent value="reports"><ReportsTab token={token} patientId={patient.id} /></TabsContent>
          <TabsContent value="bills"><BillsTab token={token} /></TabsContent>
          <TabsContent value="appointments"><AppointmentsTab token={token} patientId={patient.id} patientName={patient.name} patientPhone={patient.phone} /></TabsContent>
        </Tabs>
      </main>

      <footer className="text-center py-4 text-xs text-muted-foreground">
        © {new Date().getFullYear()} Care Diagnostic Centre · Patient Portal
      </footer>
    </div>
  )
}

function LoginScreen({ onLogin }: { onLogin: (token: string, patient: any, summary: any) => void }) {
  const [step, setStep] = useState<'phone' | 'otp'>('phone')
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [loading, setLoading] = useState(false)
  const [devOtp, setDevOtp] = useState('')

  const sendOtp = async () => {
    if (!phone || phone.length < 10) { toast.error('Enter valid phone number'); return }
    setLoading(true)
    try {
      const res = await fetch(apiPath('/api/portal/otp/send'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success('OTP sent via WhatsApp')
      if (data.devOtp) setDevOtp(data.devOtp)
      setStep('otp')
    } catch (e: any) { toast.error(e.message) } finally { setLoading(false) }
  }

  const verifyOtp = async () => {
    if (!otp || otp.length !== 6) { toast.error('Enter 6-digit OTP'); return }
    setLoading(true)
    try {
      const res = await fetch(apiPath('/api/portal/otp/verify'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, code: otp }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      localStorage.setItem(PORTAL_TOKEN_KEY, data.token)
      toast.success(`Welcome, ${data.patient.name}`)
      // Fetch summary
      const meRes = await fetch(apiPath('/api/portal/me'), { headers: { Authorization: `Bearer ${data.token}` } })
      const meData = await meRes.json()
      onLogin(data.token, data.patient, meData.summary)
    } catch (e: any) { toast.error(e.message) } finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 to-amber-50 p-4">
      <Card className="max-w-md w-full shadow-xl">
        <div className="bg-brand-gradient text-white p-6 text-center rounded-t-lg">
          <div className="w-14 h-14 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center mx-auto mb-3">
            <Activity className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold">Patient Portal</h1>
          <p className="text-white/80 text-sm mt-1">Care Diagnostic Centre</p>
        </div>
        <CardContent className="p-6 space-y-4">
          {step === 'phone' ? (
            <>
              <p className="text-sm text-muted-foreground text-center">Enter your registered phone number to receive an OTP via WhatsApp</p>
              <div>
                <Label>Phone Number</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="10-digit mobile" className="pl-9" type="tel" />
                </div>
              </div>
              <Button onClick={sendOtp} disabled={loading} className="w-full bg-brand-gradient text-white">
                {loading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : null}
                Send OTP
              </Button>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground text-center">Enter the 6-digit OTP sent to {phone}</p>
              {devOtp && <div className="bg-amber-50 border border-amber-200 p-2 rounded text-sm text-amber-800 text-center">Dev mode OTP: <strong>{devOtp}</strong></div>}
              <div>
                <Label>OTP</Label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input value={otp} onChange={(e) => setOtp(e.target.value)} placeholder="6-digit code" className="pl-9 text-center text-lg tracking-widest" maxLength={6} inputMode="numeric" />
                </div>
              </div>
              <Button onClick={verifyOtp} disabled={loading} className="w-full bg-brand-gradient text-white">
                {loading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : null}
                Verify & Login
              </Button>
              <Button variant="ghost" size="sm" onClick={() => { setStep('phone'); setOtp('') }} className="w-full">Change phone number</Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function ReportsTab({ token, patientId }: { token: string; patientId: string }) {
  const [reports, setReports] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(apiPath('/api/portal/reports'), { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => { setReports(d.reports || []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [token])

  if (loading) return <p className="text-center py-8 text-muted-foreground">Loading...</p>
  if (reports.length === 0) return <p className="text-center py-8 text-muted-foreground">No reports available yet.</p>

  return (
    <Card>
      <CardHeader><CardTitle>Your Lab Reports</CardTitle></CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Report #</TableHead>
              <TableHead>Test</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {reports.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-mono text-xs">{r.reportNumber}</TableCell>
                <TableCell className="font-medium">{r.testName}</TableCell>
                <TableCell className="text-xs">{formatDate(r.createdAt)}</TableCell>
                <TableCell><Badge variant="outline" className="bg-emerald-50 text-emerald-700">{r.status}</Badge></TableCell>
                <TableCell className="text-right">
                  <Button size="sm" variant="outline" onClick={() => window.open(apiPath(`/api/patient-reports/${r.id}/pdf`), '_blank')}>
                    <Download className="w-3 h-3 mr-1" /> Download
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

function BillsTab({ token }: { token: string }) {
  const [bills, setBills] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(apiPath('/api/portal/bills'), { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => { setBills(d.bills || []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [token])

  if (loading) return <p className="text-center py-8 text-muted-foreground">Loading...</p>
  if (bills.length === 0) return <p className="text-center py-8 text-muted-foreground">No bills yet.</p>

  return (
    <Card>
      <CardHeader><CardTitle>Your Bills</CardTitle></CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Bill #</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Doctor</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Paid</TableHead>
              <TableHead className="text-right">Balance</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {bills.map((b) => (
              <TableRow key={b.id}>
                <TableCell className="font-mono text-xs">{b.billNumber}</TableCell>
                <TableCell className="text-xs">{formatDate(b.createdAt)}</TableCell>
                <TableCell className="text-sm">{b.order?.doctor?.name || 'Walk-in'}</TableCell>
                <TableCell className="text-right">{formatCurrency(b.totalAmount)}</TableCell>
                <TableCell className="text-right text-emerald-600">{formatCurrency(b.paidAmount)}</TableCell>
                <TableCell className="text-right font-semibold text-amber-600">{formatCurrency(b.balanceAmount)}</TableCell>
                <TableCell><Badge variant="outline" className={b.status === 'paid' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}>{b.status}</Badge></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

function AppointmentsTab({ token, patientId, patientName, patientPhone }: { token: string; patientId: string; patientName: string; patientPhone: string }) {
  const [appointments, setAppointments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [packages, setPackages] = useState<any[]>([])
  const [tests, setTests] = useState<any[]>([])
  const [showBook, setShowBook] = useState(false)

  const load = useCallback(() => {
    fetch(apiPath('/api/portal/appointments'), { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => { setAppointments(d.appointments || []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [token])

  useEffect(() => {
    load()
    // Load packages + tests for booking
    Promise.all([
      fetch(apiPath('/api/public/booking/packages')).then((r) => r.json()),
      fetch(apiPath('/api/public/booking/tests')).then((r) => r.json()),
    ]).then(([p, t]) => { setPackages(p.packages || []); setTests(t.tests || []) }).catch(() => {})
  }, [load])

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setShowBook(!showBook)} className="bg-brand-gradient text-white" size="sm">
          <Calendar className="w-4 h-4 mr-1" /> Book Appointment
        </Button>
      </div>

      {showBook && <BookAppointment packages={packages} tests={tests} token={token} onDone={() => { setShowBook(false); load() }} />}

      <Card>
        <CardHeader><CardTitle>Your Appointments</CardTitle></CardHeader>
        <CardContent className="p-0">
          {loading ? <p className="text-center py-8 text-muted-foreground">Loading...</p> : appointments.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">No appointments yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead>Package/Tests</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {appointments.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">{a.appointmentDate}</TableCell>
                    <TableCell className="font-mono">{a.timeSlot}</TableCell>
                    <TableCell className="text-sm">{a.packageName || 'Custom tests'}</TableCell>
                    <TableCell><Badge variant="outline" className={a.status === 'completed' ? 'bg-emerald-50 text-emerald-700' : a.status === 'cancelled' ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-700'}>{a.status}</Badge></TableCell>
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

function BookAppointment({ packages, tests, token, onDone }: { packages: any[]; tests: any[]; token: string; onDone: () => void }) {
  const [packageId, setPackageId] = useState('')
  const [testIds, setTestIds] = useState<string[]>([])
  const [appointmentDate, setAppointmentDate] = useState(daysFromNow(1))
  const [timeSlot, setTimeSlot] = useState('')
  const [loading, setLoading] = useState(false)

  const slots = ['07:00', '07:30', '08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '14:00', '15:00', '16:00', '17:00', '18:00']

  const submit = async () => {
    if (!appointmentDate || !timeSlot) { toast.error('Select date and time'); return }
    if (!packageId && testIds.length === 0) { toast.error('Select package or tests'); return }
    setLoading(true)
    try {
      const res = await fetch(apiPath('/api/portal/appointments'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ packageId: packageId || undefined, testIds: packageId ? undefined : testIds, appointmentDate, timeSlot }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success('Appointment booked!')
      onDone()
    } catch (e: any) { toast.error(e.message) } finally { setLoading(false) }
  }

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div>
          <Label>Package</Label>
          <select className="w-full p-2 border rounded" value={packageId} onChange={(e) => setPackageId(e.target.value)}>
            <option value="">None — select tests</option>
            {packages.map((p) => <option key={p.id} value={p.id}>{p.name} — ₹{p.sellingPrice}</option>)}
          </select>
        </div>
        {!packageId && (
          <div>
            <Label>Tests</Label>
            <div className="border rounded max-h-40 overflow-y-auto">
              {tests.map((t) => (
                <label key={t.id} className="flex items-center gap-2 p-2 border-b last:border-0 cursor-pointer text-sm">
                  <input type="checkbox" checked={testIds.includes(t.id)} onChange={() => setTestIds(testIds.includes(t.id) ? testIds.filter((id) => id !== t.id) : [...testIds, t.id])} />
                  <span className="flex-1">{t.name}</span>
                  <span className="text-emerald-600">₹{t.price}</span>
                </label>
              ))}
            </div>
          </div>
        )}
        <div className="grid grid-cols-2 gap-2">
          <div><Label>Date</Label><Input type="date" value={appointmentDate} onChange={(e) => setAppointmentDate(e.target.value)} min={todayIST()} /></div>
          <div>
            <Label>Time</Label>
            <select className="w-full p-2 border rounded" value={timeSlot} onChange={(e) => setTimeSlot(e.target.value)}>
              <option value="">Select</option>
              {slots.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
        <Button onClick={submit} disabled={loading} className="w-full bg-brand-gradient text-white">
          {loading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : null}
          Book
        </Button>
      </CardContent>
    </Card>
  )
}
