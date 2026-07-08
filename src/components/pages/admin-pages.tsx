'use client'

import { useState, useEffect } from 'react'
import { useApi } from '@/lib/auth-context'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import { formatCurrency, formatDateTime, todayIST } from '@/lib/format'
import { Mail, Save, Send, Globe, ExternalLink, CheckCircle, XCircle, Loader2 } from 'lucide-react'

// =====================================================
// Email Settings Page
// =====================================================
export function EmailSettingsPage() {
  const api = useApi()
  const [settings, setSettings] = useState<any>(null)
  const [logs, setLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const [s, l] = await Promise.all([
        api.get('/api/email-settings'),
        api.get('/api/email-logs?limit=50'),
      ])
      setSettings(s.settings)
      setLogs(l.logs || [])
    } catch (e: any) { toast.error(e.message) } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const save = async () => {
    setSaving(true)
    try {
      await api.put('/api/email-settings', settings)
      toast.success('Email settings saved')
      load()
    } catch (e: any) { toast.error(e.message) } finally { setSaving(false) }
  }

  const sendTest = async () => {
    try {
      const res = await fetch('/api/notifications/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('care_erp_token') || ''}` },
        body: JSON.stringify({
          channel: 'email',
          recipientEmail: settings.adminEmail,
          recipientName: 'Admin',
          templateName: 'test',
          message: `Test email from Care ERP at ${new Date().toLocaleString('en-IN')}`,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Send failed')
      toast.success('Test email sent — check Email Logs tab')
      load()
    } catch (e: any) { toast.error(e.message) }
  }

  if (loading) return <div className="p-8 text-center text-muted-foreground">Loading...</div>
  if (!settings) return null

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Email & SMTP</h1>
        <p className="text-muted-foreground text-sm mt-1">SMTP config for bill-edit/cancel/refund/reprint notifications and daily summaries</p>
      </div>

      <Tabs defaultValue="config">
        <TabsList>
          <TabsTrigger value="config">SMTP Config</TabsTrigger>
          <TabsTrigger value="logs">Email Logs ({logs.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="config">
          <Card>
            <CardHeader><CardTitle>SMTP Configuration</CardTitle></CardHeader>
            <CardContent className="space-y-4 max-w-2xl">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>SMTP Host</Label><Input value={settings.smtpHost || ''} onChange={(e) => setSettings({ ...settings, smtpHost: e.target.value })} placeholder="smtp.gmail.com" /></div>
                <div><Label>SMTP Port</Label><Input value={settings.smtpPort || '587'} onChange={(e) => setSettings({ ...settings, smtpPort: e.target.value })} /></div>
                <div><Label>SMTP User</Label><Input value={settings.smtpUser || ''} onChange={(e) => setSettings({ ...settings, smtpUser: e.target.value })} /></div>
                <div><Label>SMTP Password</Label><Input type="password" value={settings.smtpPassword === '***' ? '' : settings.smtpPassword || ''} onChange={(e) => setSettings({ ...settings, smtpPassword: e.target.value })} placeholder={settings.smtpPassword === '***' ? '•••• (saved)' : ''} /></div>
                <div className="flex items-center gap-2 col-span-2">
                  <Switch checked={!!settings.smtpSecure} onCheckedChange={(v) => setSettings({ ...settings, smtpSecure: v })} />
                  <Label>Use SSL/TLS (port 465)</Label>
                </div>
              </div>

              <hr className="border-border" />

              <div className="grid grid-cols-2 gap-3">
                <div><Label>From Name</Label><Input value={settings.fromName || ''} onChange={(e) => setSettings({ ...settings, fromName: e.target.value })} /></div>
                <div><Label>From Address</Label><Input value={settings.fromAddress || ''} onChange={(e) => setSettings({ ...settings, fromAddress: e.target.value })} placeholder="noreply@yourclinic.com" /></div>
                <div><Label>Admin Email (primary recipient)</Label><Input value={settings.adminEmail || ''} onChange={(e) => setSettings({ ...settings, adminEmail: e.target.value })} placeholder="admin@yourclinic.com" /></div>
                <div><Label>Extra Recipients (JSON array)</Label><Input value={settings.extraRecipients || '[]'} onChange={(e) => setSettings({ ...settings, extraRecipients: e.target.value })} placeholder='["owner@clinic.com", "ca@clinic.com"]' /></div>
              </div>

              <hr className="border-border" />

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div><Label>Bill Edit Notifications</Label><p className="text-xs text-muted-foreground">Email admin when bills are edited, cancelled, refunded, or reprinted</p></div>
                  <Switch checked={!!settings.billEditEnabled} onCheckedChange={(v) => setSettings({ ...settings, billEditEnabled: v })} />
                </div>
                <div className="flex items-center justify-between">
                  <div><Label>Daily Summary Email</Label><p className="text-xs text-muted-foreground">Send collection summary each evening</p></div>
                  <Switch checked={!!settings.dailySummaryEnabled} onCheckedChange={(v) => setSettings({ ...settings, dailySummaryEnabled: v })} />
                </div>
                {settings.dailySummaryEnabled && (
                  <div><Label>Summary Time (24h)</Label><Input value={settings.dailySummaryTime || '17:00'} onChange={(e) => setSettings({ ...settings, dailySummaryTime: e.target.value })} placeholder="17:00" /></div>
                )}
              </div>

              <div className="flex gap-2 pt-4">
                <Button onClick={save} disabled={saving} className="bg-brand-gradient text-white">
                  <Save className="w-4 h-4 mr-1" /> {saving ? 'Saving...' : 'Save Settings'}
                </Button>
                <Button variant="outline" onClick={sendTest} disabled={!settings.smtpHost || !settings.adminEmail}>
                  <Send className="w-4 h-4 mr-1" /> Send Test Email
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logs">
          <Card>
            <CardHeader><CardTitle>Email Send Log (last 50)</CardTitle></CardHeader>
            <CardContent className="p-0">
              {logs.length === 0 ? <p className="text-center py-8 text-muted-foreground">No emails sent yet</p> : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Sent At</TableHead>
                      <TableHead>To</TableHead>
                      <TableHead>Subject</TableHead>
                      <TableHead>Template</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Error</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((l) => (
                      <TableRow key={l.id}>
                        <TableCell className="text-xs">{formatDateTime(l.createdAt)}</TableCell>
                        <TableCell className="text-xs">{l.to}</TableCell>
                        <TableCell className="text-sm font-medium">{l.subject}</TableCell>
                        <TableCell><Badge variant="outline">{l.templateName}</Badge></TableCell>
                        <TableCell><Badge variant="outline" className={l.status === 'sent' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : l.status === 'failed' ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-amber-50 text-amber-700 border-amber-200'}>{l.status}</Badge></TableCell>
                        <TableCell className="text-xs text-rose-600 max-w-xs truncate">{l.errorMessage || '—'}</TableCell>
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

// =====================================================
// Online Bookings Page (admin view)
// =====================================================
export function OnlineBookingsPage() {
  const api = useApi()
  const [bookings, setBookings] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('')

  const load = async () => {
    setLoading(true)
    try {
      // No list endpoint yet — for now show empty state
      // In production would call /api/online-bookings
      setBookings([])
    } catch (e: any) { toast.error(e.message) } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [statusFilter])

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Online Bookings</h1>
          <p className="text-muted-foreground text-sm mt-1">Public bookings via the booking webpage with ICICI Orange Pay</p>
        </div>
        <a href="/booking" target="_blank" rel="noopener noreferrer">
          <Button variant="outline" className="border-emerald-300 text-emerald-700 hover:bg-emerald-50">
            <Globe className="w-4 h-4 mr-1" /> Open Booking Page <ExternalLink className="w-3 h-3 ml-1" />
          </Button>
        </a>
      </div>

      <Card className="bg-gradient-to-br from-emerald-50 to-amber-50 border-emerald-200">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-brand-gradient flex items-center justify-center flex-shrink-0">
              <Globe className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <h2 className="font-bold text-lg">Public Booking URL</h2>
              <p className="text-sm text-muted-foreground mb-2">Share this link with patients for online booking + ICICI Orange Pay payment</p>
              <div className="flex items-center gap-2">
                <code className="bg-white px-3 py-1.5 rounded border text-sm flex-1">
                  {typeof window !== 'undefined' ? window.location.origin : 'https://your-clinic.com'}/booking
                </code>
                <Button size="sm" variant="outline" onClick={() => {
                  navigator.clipboard.writeText(`${window.location.origin}/booking`)
                  toast.success('Booking URL copied')
                }}>Copy</Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>ICICI Orange Pay Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="text-muted-foreground">Set these environment variables in your <code className="bg-muted px-1 rounded">env</code> file (Synology deployment):</p>
          <div className="bg-muted/30 rounded p-3 font-mono text-xs space-y-1">
            <div><span className="text-emerald-600">ICICI_MERCHANT_ID</span>=<span className="text-muted-foreground">your-merchant-id</span></div>
            <div><span className="text-emerald-600">ICICI_AGGREGATOR_ID</span>=<span className="text-muted-foreground">your-aggregator-id</span></div>
            <div><span className="text-emerald-600">ICICI_SECRET_KEY</span>=<span className="text-muted-foreground">your-hmac-secret</span></div>
            <div><span className="text-emerald-600">PUBLIC_BASE_URL</span>=<span className="text-muted-foreground">https://your-registered-domain.com</span></div>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded p-3 text-xs text-amber-800">
            <strong>⚠️ Compliance Critical:</strong> The <code>PUBLIC_BASE_URL</code> host <strong>must be whitelisted</strong> in your ICICI merchant dashboard as the <code>returnURL</code> domain. ICICI will reject <code>initiateSale</code> calls with a non-registered returnURL.
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded p-3 text-xs text-blue-800">
            <strong>Webhook URL:</strong> Configure this in ICICI merchant dashboard for server-to-server payment notifications:<br />
            <code className="bg-white px-2 py-0.5 rounded">{typeof window !== 'undefined' ? window.location.origin : 'https://your-clinic.com'}/api/gateway/icici-webhook</code>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Recent Online Bookings</CardTitle></CardHeader>
        <CardContent className="p-0">
          {loading ? <p className="text-center py-8 text-muted-foreground">Loading...</p> : bookings.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Globe className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>No online bookings yet.</p>
              <p className="text-xs mt-1">Share the booking URL above with patients to start receiving online bookings.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Booking Ref</TableHead>
                  <TableHead>Patient</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Package/Tests</TableHead>
                  <TableHead>Appointment</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bookings.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell className="font-mono text-xs">{b.bookingRef}</TableCell>
                    <TableCell className="font-medium">{b.patientName}</TableCell>
                    <TableCell>{b.patientPhone}</TableCell>
                    <TableCell className="text-sm">{b.packageName || JSON.parse(b.testNames || '[]').join(', ')}</TableCell>
                    <TableCell className="text-xs">{b.appointmentDate} {b.timeSlot}</TableCell>
                    <TableCell className="text-right">{formatCurrency(b.amount)}</TableCell>
                    <TableCell><Badge variant="outline" className={
                      b.status === 'paid' || b.status === 'confirmed' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                      b.status === 'failed' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                      b.status === 'cancelled' ? 'bg-slate-50 text-slate-700' :
                      'bg-amber-50 text-amber-700 border-amber-200'
                    }>{b.status}</Badge></TableCell>
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
