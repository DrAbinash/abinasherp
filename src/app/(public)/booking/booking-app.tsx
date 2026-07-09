'use client'

import { useState, useEffect } from 'react'
import { apiPath } from '@/lib/base-path'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import { formatCurrency, todayIST, daysFromNow } from '@/lib/format'
import { Activity, Calendar, Clock, User, Phone, Mail, Package as PackageIcon, FlaskConical, CheckCircle, Loader2, ArrowLeft, ArrowRight, ShieldCheck } from 'lucide-react'

interface Package {
  id: string; packageId: string; name: string; description?: string; category: string
  totalTests: number; mrp: number; sellingPrice: number; durationHours: number
  fastingRequired: boolean; instructions?: string | null
}
interface Test {
  id: string; code: string; name: string; price: number; unit?: string; categoryName?: string | null
}
interface SlotData {
  slots: { morning: string[]; afternoon: string[]; evening: string[] }
  note: string
}

export function BookingApp() {
  const [step, setStep] = useState(1)
  const [tab, setTab] = useState('packages')
  const [packages, setPackages] = useState<Package[]>([])
  const [tests, setTests] = useState<Test[]>([])
  const [slotData, setSlotData] = useState<SlotData | null>(null)
  const [selectedPackage, setSelectedPackage] = useState<Package | null>(null)
  const [selectedTests, setSelectedTests] = useState<Test[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  // Form state
  const [patientName, setPatientName] = useState('')
  const [patientPhone, setPatientPhone] = useState('')
  const [patientEmail, setPatientEmail] = useState('')
  const [patientAge, setPatientAge] = useState('')
  const [patientGender, setPatientGender] = useState('')
  const [appointmentDate, setAppointmentDate] = useState(daysFromNow(1))
  const [timeSlot, setTimeSlot] = useState('')

  // Result state
  const [result, setResult] = useState<any>(null)

  useEffect(() => {
    Promise.all([
      fetch(apiPath('/api/public/booking/packages')).then((r) => r.json()),
      fetch(apiPath('/api/public/booking/tests')).then((r) => r.json()),
      fetch(apiPath('/api/public/booking/slots')).then((r) => r.json()),
    ]).then(([p, t, s]) => {
      setPackages(p.packages || [])
      setTests(t.tests || [])
      setSlotData(s)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const totalAmount = selectedPackage
    ? selectedPackage.sellingPrice
    : selectedTests.reduce((s, t) => s + t.price, 0)

  const handleInitiate = async () => {
    if (!patientName || !patientPhone || !appointmentDate || !timeSlot) {
      toast.error('Please fill all required fields')
      return
    }
    if (!selectedPackage && selectedTests.length === 0) {
      toast.error('Please select a package or tests')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch(apiPath('/api/public/booking/initiate'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientName, patientPhone, patientEmail, patientAge, patientGender,
          packageId: selectedPackage?.id,
          testIds: selectedPackage ? undefined : selectedTests.map((t) => t.id),
          appointmentDate, timeSlot,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Booking failed')

      if (data.redirectUrl) {
        // Redirect to ICICI Orange Pay
        toast.success('Redirecting to secure payment...')
        setTimeout(() => { window.location.href = data.redirectUrl }, 800)
        setResult({ ...data, redirect: true })
      } else {
        // Pay at centre
        setResult({ ...data, redirect: false })
        setStep(4)
      }
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    )
  }

  if (result && result.redirect) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 to-amber-50 p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <Loader2 className="w-12 h-12 mx-auto animate-spin text-emerald-600 mb-4" />
            <h2 className="text-xl font-bold mb-2">Redirecting to Payment</h2>
            <p className="text-sm text-muted-foreground">You are being redirected to ICICI Orange Pay secure payment gateway...</p>
            <p className="text-xs text-muted-foreground mt-4">Booking Ref: <span className="font-mono font-semibold">{result.bookingRef}</span></p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (result && !result.redirect) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 to-amber-50 p-4">
        <Card className="max-w-md w-full">
          <div className="bg-emerald-500 text-white p-8 text-center rounded-t-lg">
            <CheckCircle className="w-16 h-16 mx-auto mb-3" />
            <h1 className="text-2xl font-bold">Booking Confirmed!</h1>
          </div>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground mb-4 text-center">
              Your appointment has been booked. Payment will be collected at the centre.
            </p>
            <div className="space-y-2 text-sm border rounded-lg p-4 bg-muted/30">
              <div className="flex justify-between"><span className="text-muted-foreground">Booking Ref</span><span className="font-mono font-semibold">{result.bookingRef}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Patient</span><span className="font-medium">{patientName}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Phone</span><span>{patientPhone}</span></div>
              {result.packageName && <div className="flex justify-between"><span className="text-muted-foreground">Package</span><span>{result.packageName}</span></div>}
              <div className="flex justify-between"><span className="text-muted-foreground">Date & Time</span><span>{appointmentDate} {timeSlot}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Amount</span><span className="font-bold">₹{result.amount.toFixed(2)}</span></div>
            </div>
            <Button onClick={() => window.location.reload()} className="w-full mt-4 bg-brand-gradient text-white">
              Book Another
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-amber-50">
      {/* Header */}
      <header className="bg-brand-gradient text-white py-6 shadow-lg">
        <div className="max-w-5xl mx-auto px-4 flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center">
            <Activity className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Care Diagnostic Centre</h1>
            <p className="text-white/80 text-sm">Online Booking — Tests & Health Packages</p>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        {/* Stepper */}
        <div className="flex items-center justify-center mb-8">
          {['Select', 'Patient Details', 'Payment', 'Confirm'].map((label, i) => (
            <div key={label} className="flex items-center">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center font-semibold text-sm ${i + 1 === step ? 'bg-emerald-500 text-white' : i + 1 < step ? 'bg-emerald-100 text-emerald-700' : 'bg-muted text-muted-foreground'}`}>
                {i + 1 < step ? '✓' : i + 1}
              </div>
              <span className={`ml-2 text-sm font-medium ${i + 1 === step ? 'text-emerald-700' : 'text-muted-foreground'}`}>{label}</span>
              {i < 3 && <div className={`w-12 h-0.5 mx-3 ${i + 1 < step ? 'bg-emerald-300' : 'bg-border'}`} />}
            </div>
          ))}
        </div>

        {/* Step 1: Select package/tests */}
        {step === 1 && (
          <div className="space-y-6">
            <Tabs value={tab} onValueChange={setTab}>
              <TabsList className="grid w-full grid-cols-2 max-w-md mx-auto">
                <TabsTrigger value="packages"><PackageIcon className="w-4 h-4 mr-1" /> Packages</TabsTrigger>
                <TabsTrigger value="tests"><FlaskConical className="w-4 h-4 mr-1" /> Individual Tests</TabsTrigger>
              </TabsList>

              <TabsContent value="packages" className="mt-6">
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {packages.map((p) => (
                    <Card key={p.id} className={`cursor-pointer transition-all hover:shadow-lg ${selectedPackage?.id === p.id ? 'ring-2 ring-emerald-500 shadow-lg' : ''}`} onClick={() => { setSelectedPackage(p); setSelectedTests([]) }}>
                      <CardHeader className="bg-brand-gradient text-white rounded-t-lg pb-4">
                        <Badge className="bg-white/20 text-white border-white/30 w-fit mb-1">{p.category}</Badge>
                        <CardTitle className="text-lg">{p.name}</CardTitle>
                      </CardHeader>
                      <CardContent className="p-4">
                        {p.description && <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{p.description}</p>}
                        <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3">
                          <span><FlaskConical className="w-3 h-3 inline mr-1" />{p.totalTests} tests</span>
                          <span><Clock className="w-3 h-3 inline mr-1" />{p.durationHours}h</span>
                          {p.fastingRequired && <Badge variant="outline" className="text-amber-700 border-amber-300">Fasting</Badge>}
                        </div>
                        <div className="flex items-baseline gap-2">
                          <span className="text-2xl font-bold text-emerald-600">₹{p.sellingPrice}</span>
                          {p.mrp > p.sellingPrice && <span className="text-sm text-muted-foreground line-through">₹{p.mrp}</span>}
                          {p.mrp > p.sellingPrice && <Badge variant="outline" className="text-rose-600 border-rose-300">{Math.round((1 - p.sellingPrice / p.mrp) * 100)}% OFF</Badge>}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="tests" className="mt-6">
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {tests.map((t) => {
                    const selected = selectedTests.some((s) => s.id === t.id)
                    return (
                      <Card key={t.id} className={`cursor-pointer transition-all hover:shadow-md ${selected ? 'ring-2 ring-emerald-500' : ''}`} onClick={() => {
                        setSelectedPackage(null)
                        setSelectedTests((arr) => selected ? arr.filter((s) => s.id !== t.id) : [...arr, t])
                      }}>
                        <CardContent className="p-3 flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{t.name}</p>
                            <p className="text-xs text-muted-foreground">{t.code} {t.categoryName ? `· ${t.categoryName}` : ''}</p>
                          </div>
                          <div className="text-right ml-2">
                            <p className="font-bold text-emerald-600">₹{t.price}</p>
                            {selected && <CheckCircle className="w-4 h-4 text-emerald-500 ml-auto" />}
                          </div>
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              </TabsContent>
            </Tabs>

            {/* Summary bar */}
            {(selectedPackage || selectedTests.length > 0) && (
              <div className="sticky bottom-4 bg-white border rounded-lg shadow-lg p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Selected</p>
                  <p className="font-semibold">
                    {selectedPackage ? selectedPackage.name : `${selectedTests.length} test(s)`}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Total</p>
                  <p className="text-2xl font-bold text-emerald-600">₹{totalAmount.toFixed(2)}</p>
                </div>
                <Button onClick={() => setStep(2)} className="bg-brand-gradient text-white ml-4">
                  Continue <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Step 2: Patient details */}
        {step === 2 && (
          <Card className="max-w-2xl mx-auto">
            <CardHeader><CardTitle>Patient Details</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <Label>Full Name *</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input value={patientName} onChange={(e) => setPatientName(e.target.value)} className="pl-9" placeholder="Patient name" />
                  </div>
                </div>
                <div>
                  <Label>Phone Number *</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input value={patientPhone} onChange={(e) => setPatientPhone(e.target.value)} className="pl-9" placeholder="10-digit mobile" type="tel" />
                  </div>
                </div>
                <div>
                  <Label>Email (optional)</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input value={patientEmail} onChange={(e) => setPatientEmail(e.target.value)} className="pl-9" placeholder="For receipt" type="email" />
                  </div>
                </div>
                <div>
                  <Label>Age</Label>
                  <Input value={patientAge} onChange={(e) => setPatientAge(e.target.value)} type="number" placeholder="Years" />
                </div>
                <div>
                  <Label>Gender</Label>
                  <Select value={patientGender} onValueChange={setPatientGender}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Appointment Date *</Label>
                  <Input type="date" value={appointmentDate} onChange={(e) => setAppointmentDate(e.target.value)} min={todayIST()} />
                </div>
              </div>

              {/* Time slots */}
              {slotData && (
                <div>
                  <Label>Time Slot *</Label>
                  {selectedPackage?.fastingRequired || selectedTests.some((t) => /lipid|sugar|glucose|fasting/i.test(t.name)) ? (
                    <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2 mb-2">
                      ⚠️ Some selected tests require fasting. Morning slots (7-10 AM) recommended.
                    </p>
                  ) : null}
                  <div className="space-y-2">
                    {[
                      { label: 'Morning', icon: '🌅', slots: slotData.slots.morning },
                      { label: 'Afternoon', icon: '☀️', slots: slotData.slots.afternoon },
                      { label: 'Evening', icon: '🌆', slots: slotData.slots.evening },
                    ].map((group) => (
                      <div key={group.label}>
                        <p className="text-xs text-muted-foreground mb-1">{group.icon} {group.label}</p>
                        <div className="flex flex-wrap gap-2">
                          {group.slots.map((s) => (
                            <button key={s} onClick={() => setTimeSlot(s)} className={`px-3 py-1.5 rounded-md text-sm border transition-colors ${timeSlot === s ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-white hover:bg-emerald-50 hover:border-emerald-300'}`}>
                              {s}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-between pt-4">
                <Button variant="ghost" onClick={() => setStep(1)}><ArrowLeft className="w-4 h-4 mr-1" /> Back</Button>
                <Button onClick={() => setStep(3)} disabled={!patientName || !patientPhone || !timeSlot} className="bg-brand-gradient text-white">
                  Review <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Review & Pay */}
        {step === 3 && (
          <Card className="max-w-2xl mx-auto">
            <CardHeader><CardTitle>Review & Pay</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-muted/30 rounded-lg p-4 space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Patient</span><span className="font-medium">{patientName}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Phone</span><span>{patientPhone}</span></div>
                {patientEmail && <div className="flex justify-between"><span className="text-muted-foreground">Email</span><span>{patientEmail}</span></div>}
                {patientAge && <div className="flex justify-between"><span className="text-muted-foreground">Age/Gender</span><span>{patientAge} / {patientGender || '-'}</span></div>}
                <div className="flex justify-between"><span className="text-muted-foreground">Appointment</span><span className="font-medium">{appointmentDate} at {timeSlot}</span></div>
              </div>

              <div className="border rounded-lg p-4">
                <p className="font-semibold mb-2">{selectedPackage ? 'Package' : 'Tests Selected'}</p>
                {selectedPackage ? (
                  <>
                    <p className="font-medium text-emerald-700">{selectedPackage.name}</p>
                    <p className="text-xs text-muted-foreground">{selectedPackage.totalTests} tests · {selectedPackage.durationHours}h duration</p>
                    {selectedPackage.fastingRequired && <Badge variant="outline" className="text-amber-700 border-amber-300 mt-1">Fasting Required</Badge>}
                  </>
                ) : (
                  <ul className="text-sm space-y-1">
                    {selectedTests.map((t) => (
                      <li key={t.id} className="flex justify-between">
                        <span>{t.name}</span>
                        <span>₹{t.price}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 flex items-center justify-between">
                <span className="font-semibold">Total Payable</span>
                <span className="text-2xl font-bold text-emerald-600">₹{totalAmount.toFixed(2)}</span>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start gap-2 text-sm">
                <ShieldCheck className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-blue-800">Secure Payment via ICICI Orange Pay</p>
                  <p className="text-xs text-blue-700 mt-1">You will be redirected to ICICI Bank's secure payment page. We do not store your card/UPI details.</p>
                </div>
              </div>

              <div className="flex justify-between pt-4">
                <Button variant="ghost" onClick={() => setStep(2)}><ArrowLeft className="w-4 h-4 mr-1" /> Back</Button>
                <Button onClick={handleInitiate} disabled={submitting} className="bg-brand-gradient text-white">
                  {submitting ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Processing...</> : <>Pay ₹{totalAmount.toFixed(2)} <ArrowRight className="w-4 h-4 ml-1" /></>}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </main>

      <footer className="text-center py-6 text-xs text-muted-foreground">
        <p>© {new Date().getFullYear()} Care Diagnostic Centre · Secure Online Booking</p>
        <p className="mt-1">Payment gateway: ICICI Orange Pay · 256-bit SSL encrypted</p>
      </footer>
    </div>
  )
}
