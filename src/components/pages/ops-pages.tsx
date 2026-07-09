'use client'

import { useState, useEffect } from 'react'
import { apiPath } from '@/lib/base-path'
import { useApi } from '@/lib/auth-context'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import { formatDateTime, formatDate, todayIST, daysAgo } from '@/lib/format'
import { Calendar, Plus, Clock, MessageSquare, Send, Globe, Network, Phone, Mail, TestTube2, AlertCircle } from 'lucide-react'

// =====================================================
// APPOINTMENTS PAGE
// =====================================================
export function AppointmentsPage() {
  const api = useApi()
  const [appointments, setAppointments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [date, setDate] = useState(todayIST())
  const [createOpen, setCreateOpen] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const d = await api.get(`/api/appointments?date=${date}`)
      setAppointments(d.appointments || [])
    } catch (e: any) { toast.error(e.message) } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [date])

  const updateStatus = async (id: string, status: string) => {
    try {
      await api.patch(`/api/appointments/${id}`, { status })
      toast.success(`Marked ${status}`)
      load()
    } catch (e: any) { toast.error(e.message) }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Appointments</h1>
          <p className="text-muted-foreground text-sm mt-1">Slot-based appointment management (walk-in + online bookings)</p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="bg-brand-gradient text-white">
          <Plus className="w-4 h-4 mr-1" /> New Appointment
        </Button>
      </div>

      <div className="flex gap-3 items-end">
        <div>
          <Label>Date</Label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-48" />
        </div>
        <Button variant="outline" onClick={() => setDate(todayIST())}>Today</Button>
        <div className="flex-1" />
        <Badge variant="outline" className="text-sm">{appointments.length} appointments</Badge>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? <p className="text-center py-8 text-muted-foreground">Loading...</p> : appointments.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">No appointments for {date}.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Patient</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Package/Tests</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Fasting</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {appointments.sort((a, b) => a.timeSlot.localeCompare(b.timeSlot)).map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-mono font-bold">{a.timeSlot}</TableCell>
                    <TableCell className="font-medium">{a.patientName}</TableCell>
                    <TableCell className="text-sm">{a.patientPhone || '—'}</TableCell>
                    <TableCell className="text-sm">{a.packageName || 'Custom tests'}</TableCell>
                    <TableCell><Badge variant="outline" className="capitalize">{a.source}</Badge></TableCell>
                    <TableCell>{a.isFasting ? <Badge variant="outline" className="text-amber-700 border-amber-300">Yes</Badge> : '—'}</TableCell>
                    <TableCell><Badge variant="outline" className={
                      a.status === 'completed' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                      a.status === 'cancelled' || a.status === 'no-show' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                      a.status === 'arrived' || a.status === 'in-progress' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                      'bg-amber-50 text-amber-700 border-amber-200'
                    }>{a.status}</Badge></TableCell>
                    <TableCell className="text-right">
                      <Select onValueChange={(v) => updateStatus(a.id, v)}>
                        <SelectTrigger className="w-32 h-8 text-xs"><SelectValue placeholder="Update" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="arrived">Arrived</SelectItem>
                          <SelectItem value="in-progress">In Progress</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                          <SelectItem value="cancelled">Cancelled</SelectItem>
                          <SelectItem value="no-show">No-show</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <CreateAppointmentDialog onClose={() => setCreateOpen(false)} onDone={() => { setCreateOpen(false); load() }} defaultDate={date} />
      </Dialog>
    </div>
  )
}

function CreateAppointmentDialog({ onClose, onDone, defaultDate }: { onClose: () => void; onDone: () => void; defaultDate: string }) {
  const api = useApi()
  const [packages, setPackages] = useState<any[]>([])
  const [tests, setTests] = useState<any[]>([])
  const [form, setForm] = useState({
    patientName: '', patientPhone: '', packageId: '', testIds: [] as string[],
    appointmentDate: defaultDate, timeSlot: '', source: 'walk-in', isFasting: false, notes: '',
  })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    Promise.all([api.get('/api/packages'), api.get('/api/tests')]).then(([p, t]) => { setPackages(p.packages || []); setTests(t.tests || []) }).catch(() => {})
  }, [])

  const submit = async () => {
    if (!form.patientName || !form.appointmentDate || !form.timeSlot) { toast.error('Patient name, date, time required'); return }
    if (!form.packageId && form.testIds.length === 0) { toast.error('Select package or tests'); return }
    setLoading(true)
    try {
      const pkg = packages.find((p) => p.id === form.packageId)
      await api.post('/api/appointments', {
        ...form,
        packageName: pkg?.name,
        testIds: form.packageId ? undefined : form.testIds,
      })
      toast.success('Appointment booked')
      onDone()
    } catch (e: any) { toast.error(e.message) } finally { setLoading(false) }
  }

  const slots = ['07:00', '07:30', '08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00', '14:00', '15:00', '16:00', '17:00', '18:00']

  return (
    <DialogContent className="max-w-xl">
      <DialogHeader><DialogTitle>New Appointment</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Patient Name *</Label><Input value={form.patientName} onChange={(e) => setForm({ ...form, patientName: e.target.value })} /></div>
          <div><Label>Phone</Label><Input value={form.patientPhone} onChange={(e) => setForm({ ...form, patientPhone: e.target.value })} /></div>
          <div><Label>Date *</Label><Input type="date" value={form.appointmentDate} onChange={(e) => setForm({ ...form, appointmentDate: e.target.value })} /></div>
          <div>
            <Label>Source</Label>
            <Select value={form.source} onValueChange={(v) => setForm({ ...form, source: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="walk-in">Walk-in</SelectItem>
                <SelectItem value="phone">Phone</SelectItem>
                <SelectItem value="online">Online</SelectItem>
                <SelectItem value="whatsapp">WhatsApp</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div>
          <Label>Package (optional)</Label>
          <Select value={form.packageId} onValueChange={(v) => setForm({ ...form, packageId: v, isFasting: packages.find((p) => p.id === v)?.fastingRequired || false })}>
            <SelectTrigger><SelectValue placeholder="None — select tests below" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">None</SelectItem>
              {packages.map((p) => <SelectItem key={p.id} value={p.id}>{p.name} — ₹{p.sellingPrice}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {!form.packageId && (
          <div>
            <Label>Tests</Label>
            <div className="border rounded max-h-40 overflow-y-auto">
              {tests.map((t) => (
                <label key={t.id} className="flex items-center gap-2 p-2 hover:bg-muted/30 border-b last:border-0 cursor-pointer text-sm">
                  <input type="checkbox" checked={form.testIds.includes(t.id)} onChange={() => setForm({ ...form, testIds: form.testIds.includes(t.id) ? form.testIds.filter((id) => id !== t.id) : [...form.testIds, t.id] })} />
                  <span className="flex-1">{t.name}</span>
                  <span className="text-emerald-600">₹{t.price}</span>
                </label>
              ))}
            </div>
          </div>
        )}
        <div>
          <Label>Time Slot *</Label>
          <div className="flex flex-wrap gap-2">
            {slots.map((s) => (
              <button key={s} onClick={() => setForm({ ...form, timeSlot: s })} className={`px-3 py-1.5 rounded-md text-sm border ${form.timeSlot === s ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-white hover:bg-emerald-50'}`}>{s}</button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={form.isFasting} onCheckedChange={(v) => setForm({ ...form, isFasting: v })} />
          <Label>Fasting Required</Label>
        </div>
        <div><Label>Notes</Label><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button onClick={submit} disabled={loading} className="bg-brand-gradient text-white">{loading ? 'Booking...' : 'Book Appointment'}</Button>
      </DialogFooter>
    </DialogContent>
  )
}

// =====================================================
// NOTIFICATIONS PAGE (WhatsApp + SMS + Email log)
// =====================================================
export function NotificationsPage() {
  const api = useApi()
  const [notifications, setNotifications] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [channelFilter, setChannelFilter] = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const d = await api.get(`/api/notifications${channelFilter ? `?channel=${channelFilter}` : ''}`)
      setNotifications(d.notifications || [])
    } catch (e: any) { toast.error(e.message) } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [channelFilter])

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Notifications</h1>
        <p className="text-muted-foreground text-sm mt-1">WhatsApp / SMS / Email send history</p>
      </div>

      <div className="flex gap-2">
        {['', 'whatsapp', 'sms', 'email'].map((c) => (
          <Button key={c || 'all'} variant={channelFilter === c ? 'default' : 'outline'} size="sm" onClick={() => setChannelFilter(c)} className="capitalize">
            {c || 'All'}
          </Button>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? <p className="text-center py-8 text-muted-foreground">Loading...</p> : notifications.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">No notifications sent yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Sent At</TableHead>
                  <TableHead>Channel</TableHead>
                  <TableHead>To</TableHead>
                  <TableHead>Template</TableHead>
                  <TableHead>Message (preview)</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>External ID</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {notifications.map((n) => (
                  <TableRow key={n.id}>
                    <TableCell className="text-xs">{formatDateTime(n.createdAt)}</TableCell>
                    <TableCell><Badge variant="outline" className={n.channel === 'whatsapp' ? 'bg-emerald-50 text-emerald-700' : n.channel === 'email' ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700'}>{n.channel}</Badge></TableCell>
                    <TableCell className="text-xs">{n.recipientPhone || n.recipientEmail || '—'}</TableCell>
                    <TableCell><Badge variant="outline">{n.templateName}</Badge></TableCell>
                    <TableCell className="text-xs max-w-xs truncate">{n.message.slice(0, 80)}...</TableCell>
                    <TableCell><Badge variant="outline" className={n.status === 'sent' ? 'bg-emerald-50 text-emerald-700' : n.status === 'failed' ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-700'}>{n.status}</Badge></TableCell>
                    <TableCell className="text-xs font-mono">{n.externalId?.slice(0, 20) || '—'}</TableCell>
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

// =====================================================
// BRANCHES PAGE
// =====================================================
export function BranchesPage() {
  const api = useApi()
  const [branches, setBranches] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const d = await api.get('/api/branches')
      setBranches(d.branches || [])
    } catch (e: any) { toast.error(e.message) } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Branches</h1>
          <p className="text-muted-foreground text-sm mt-1">Multi-location diagnostic centres</p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="bg-brand-gradient text-white">
          <Plus className="w-4 h-4 mr-1" /> New Branch
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? <p className="text-center py-8 text-muted-foreground">Loading...</p> : branches.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">No branches yet. Create your head office and additional locations.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Branch ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>GSTIN</TableHead>
                  <TableHead>Head Office</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {branches.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell className="font-mono text-xs">{b.branchId}</TableCell>
                    <TableCell className="font-medium">{b.name}</TableCell>
                    <TableCell><Badge variant="outline">{b.code}</Badge></TableCell>
                    <TableCell className="text-sm">{b.phone || '—'}</TableCell>
                    <TableCell className="text-xs font-mono">{b.gstin || '—'}</TableCell>
                    <TableCell>{b.isHeadOffice ? <Badge className="bg-brand-gradient text-white">Yes</Badge> : '—'}</TableCell>
                    <TableCell><Badge variant={b.isActive ? 'default' : 'secondary'}>{b.isActive ? 'Active' : 'Inactive'}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <CreateBranchDialog onClose={() => setCreateOpen(false)} onDone={() => { setCreateOpen(false); load() }} />
      </Dialog>
    </div>
  )
}

function CreateBranchDialog({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const api = useApi()
  const [form, setForm] = useState({ name: '', code: '', address: '', phone: '', email: '', gstin: '', isHeadOffice: false })
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    if (!form.name || !form.code) { toast.error('Name and code required'); return }
    setLoading(true)
    try {
      await api.post('/api/branches', form)
      toast.success('Branch created')
      onDone()
    } catch (e: any) { toast.error(e.message) } finally { setLoading(false) }
  }

  return (
    <DialogContent>
      <DialogHeader><DialogTitle>New Branch</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Main Branch" /></div>
          <div><Label>Code *</Label><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="HO, BR1, BR2" /></div>
          <div><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
          <div><Label>Email</Label><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
          <div><Label>GSTIN</Label><Input value={form.gstin} onChange={(e) => setForm({ ...form, gstin: e.target.value.toUpperCase() })} /></div>
          <div className="flex items-center gap-2 pt-6">
            <Switch checked={form.isHeadOffice} onCheckedChange={(v) => setForm({ ...form, isHeadOffice: v })} />
            <Label>Head Office</Label>
          </div>
        </div>
        <div><Label>Address</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button onClick={submit} disabled={loading} className="bg-brand-gradient text-white">{loading ? 'Creating...' : 'Create Branch'}</Button>
      </DialogFooter>
    </DialogContent>
  )
}

// =====================================================
// WHATSAPP SETTINGS PAGE
// =====================================================
export function WhatsAppSettingsPage() {
  const api = useApi()
  const [settings, setSettings] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testPhone, setTestPhone] = useState('')
  const [testing, setTesting] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const d = await api.get('/api/whatsapp/settings')
      setSettings(d.settings)
    } catch (e: any) { toast.error(e.message) } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const save = async () => {
    setSaving(true)
    try {
      await api.put('/api/whatsapp/settings', settings)
      toast.success('WhatsApp settings saved')
      load()
    } catch (e: any) { toast.error(e.message) } finally { setSaving(false) }
  }

  const sendTest = async () => {
    if (!testPhone) { toast.error('Enter test phone number'); return }
    setTesting(true)
    try {
      const res = await fetch(apiPath('/api/whatsapp/test'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('care_erp_token') || ''}` },
        body: JSON.stringify({ to: testPhone }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Test failed')
      toast.success('Test message sent!')
    } catch (e: any) { toast.error(e.message) } finally { setTesting(false) }
  }

  if (loading) return <div className="p-8 text-center text-muted-foreground">Loading...</div>
  if (!settings) return null

  return (
    <div className="space-y-6 animate-fade-in max-w-3xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">WhatsApp Settings</h1>
        <p className="text-muted-foreground text-sm mt-1">Configure WhatsApp Business API for report delivery, bill notifications, daily summaries</p>
      </div>

      <Card>
        <CardHeader><CardTitle>Provider Configuration</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Provider</Label>
              <Select value={settings.provider} onValueChange={(v) => setSettings({ ...settings, provider: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="gupshup">Gupshup</SelectItem>
                  <SelectItem value="interakt">Interakt</SelectItem>
                  <SelectItem value="wati">Wati</SelectItem>
                  <SelectItem value="twilio">Twilio</SelectItem>
                  <SelectItem value="meta">Meta Cloud API</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2 pt-6">
              <Switch checked={settings.isEnabled} onCheckedChange={(v) => setSettings({ ...settings, isEnabled: v })} />
              <Label>Enabled</Label>
            </div>
            <div><Label>API Key {settings.apiKey === '***' && '(saved)'}</Label><Input type="password" value={settings.apiKey === '***' ? '' : settings.apiKey} onChange={(e) => setSettings({ ...settings, apiKey: e.target.value })} placeholder={settings.apiKey === '***' ? '•••• (saved)' : 'Enter API key'} /></div>
            <div><Label>API Secret {settings.apiSecret === '***' && '(saved)'}</Label><Input type="password" value={settings.apiSecret === '***' ? '' : settings.apiSecret} onChange={(e) => setSettings({ ...settings, apiSecret: e.target.value })} placeholder={settings.apiSecret === '***' ? '•••• (saved)' : 'Enter API secret (Twilio only)'} /></div>
            <div><Label>Sender Phone Number</Label><Input value={settings.phoneNumber} onChange={(e) => setSettings({ ...settings, phoneNumber: e.target.value })} placeholder="919876543210" /></div>
            <div><Label>Template Namespace</Label><Input value={settings.templateNamespace} onChange={(e) => setSettings({ ...settings, templateNamespace: e.target.value })} placeholder="For Gupshup template messages" /></div>
          </div>

          <hr className="border-border" />

          <div className="space-y-2">
            <p className="font-medium text-sm">Auto-send Triggers</p>
            <div className="flex items-center justify-between">
              <div><Label>Report Ready</Label><p className="text-xs text-muted-foreground">Auto-send WhatsApp when lab report is approved</p></div>
              <Switch checked={settings.sendOnReportReady} onCheckedChange={(v) => setSettings({ ...settings, sendOnReportReady: v })} />
            </div>
            <div className="flex items-center justify-between">
              <div><Label>Bill Created</Label><p className="text-xs text-muted-foreground">Auto-send bill summary when bill is generated</p></div>
              <Switch checked={settings.sendOnBillCreated} onCheckedChange={(v) => setSettings({ ...settings, sendOnBillCreated: v })} />
            </div>
            <div className="flex items-center justify-between">
              <div><Label>Appointment Reminder</Label><p className="text-xs text-muted-foreground">Auto-send appointment confirmation</p></div>
              <Switch checked={settings.sendOnAppointmentReminder} onCheckedChange={(v) => setSettings({ ...settings, sendOnAppointmentReminder: v })} />
            </div>
          </div>

          <div className="flex gap-2 pt-4">
            <Button onClick={save} disabled={saving} className="bg-brand-gradient text-white">{saving ? 'Saving...' : 'Save Settings'}</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Test WhatsApp</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input value={testPhone} onChange={(e) => setTestPhone(e.target.value)} placeholder="Enter phone (with country code, e.g. 919876543210)" />
            <Button onClick={sendTest} disabled={testing || !settings.isEnabled} variant="outline">
              {testing ? 'Sending...' : 'Send Test'}
            </Button>
          </div>
          {!settings.isEnabled && <p className="text-xs text-amber-600">Enable WhatsApp and save settings before sending test.</p>}
          <div className="bg-blue-50 border border-blue-200 rounded p-3 text-xs text-blue-800">
            <strong>Provider setup guides:</strong>
            <ul className="list-disc list-inside mt-1 space-y-0.5">
              <li><strong>Gupshup</strong>: Get API key from https://gupshup.io. Register sender phone. Template namespace required for templated messages.</li>
              <li><strong>Interakt</strong>: Get API key from https://interakt.io. Phone number format: country code + 10 digits.</li>
              <li><strong>Wati</strong>: Get API token from https://wati.io. Instance ID is part of the API URL.</li>
              <li><strong>Twilio</strong>: Account SID = API key, Auth token = API secret. Sender phone is your Twilio WhatsApp number.</li>
              <li><strong>Meta Cloud API</strong>: Phone Number ID = phone field. Access token = API key. Requires Meta Business verification.</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
