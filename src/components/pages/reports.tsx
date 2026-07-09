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
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { formatCurrency, formatDateTime, todayIST } from '@/lib/format'
import { FileText, Plus, Printer, Mail, MessageSquare, CheckCircle, Eye, FileEdit } from 'lucide-react'

export function ReportsPage() {
  const [tab, setTab] = useState('reports')
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Lab Reports</h1>
        <p className="text-muted-foreground text-sm mt-1">Create patient reports from templates, deliver via WhatsApp/Email/Print</p>
      </div>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="reports">Patient Reports</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
        </TabsList>
        <TabsContent value="reports"><PatientReportsTab /></TabsContent>
        <TabsContent value="templates"><TemplatesTab /></TabsContent>
      </Tabs>
    </div>
  )
}

// =====================================================
// PATIENT REPORTS
// =====================================================
function PatientReportsTab() {
  const api = useApi()
  const [reports, setReports] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('all')
  const [createOpen, setCreateOpen] = useState(false)
  const [editReport, setEditReport] = useState<any>(null)

  const load = async () => {
    setLoading(true)
    try {
      const status = statusFilter === 'all' ? '' : statusFilter
      const d = await api.get(`/api/patient-reports?status=${status}`)
      setReports(d.reports || [])
    } catch (e: any) { toast.error(e.message) } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [statusFilter])

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        {['all', 'draft', 'pending_review', 'approved', 'delivered', 'cancelled'].map((s) => (
          <Button key={s} variant={statusFilter === s ? 'default' : 'outline'} size="sm" onClick={() => setStatusFilter(s)} className="capitalize">
            {s.replace('_', ' ')}
          </Button>
        ))}
        <div className="flex-1" />
        <Button onClick={() => setCreateOpen(true)} className="bg-brand-gradient text-white">
          <Plus className="w-4 h-4 mr-1" /> New Report
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? <p className="text-center py-8 text-muted-foreground">Loading...</p> : reports.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">No reports yet. Create one to get started.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Report #</TableHead>
                  <TableHead>Patient</TableHead>
                  <TableHead>Test</TableHead>
                  <TableHead>Doctor</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Delivery</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reports.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-xs">{r.reportNumber}</TableCell>
                    <TableCell className="font-medium">{r.patientName}</TableCell>
                    <TableCell className="text-sm">{r.testName}</TableCell>
                    <TableCell className="text-sm">{r.doctorName || 'Self'}</TableCell>
                    <TableCell className="text-xs">{formatDateTime(r.createdAt)}</TableCell>
                    <TableCell><Badge variant="outline" className={
                      r.status === 'delivered' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                      r.status === 'approved' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                      r.status === 'cancelled' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                      r.status === 'pending_review' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                      'bg-slate-50 text-slate-700'
                    }>{r.status.replace('_', ' ')}</Badge></TableCell>
                    <TableCell>{r.deliveryMethod ? <Badge variant="outline" className="capitalize">{r.deliveryMethod}</Badge> : '—'}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-1 justify-end">
                        <Button size="sm" variant="ghost" onClick={() => setEditReport(r)} title="Edit / Approve / Deliver"><FileEdit className="w-4 h-4" /></Button>
                        {r.status === 'approved' || r.status === 'delivered' ? (
                          <Button size="sm" variant="ghost" onClick={() => window.open(`/api/patient-reports/${r.id}/pdf`, '_blank')} title="View PDF"><Printer className="w-4 h-4" /></Button>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <CreateReportDialog onClose={() => setCreateOpen(false)} onDone={() => { setCreateOpen(false); load() }} />
      </Dialog>

      <Dialog open={!!editReport} onOpenChange={(o) => !o && setEditReport(null)}>
        {editReport && <EditReportDialog report={editReport} onClose={() => setEditReport(null)} onDone={() => { setEditReport(null); load() }} />}
      </Dialog>
    </div>
  )
}

function CreateReportDialog({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const api = useApi()
  const [templates, setTemplates] = useState<any[]>([])
  const [tests, setTests] = useState<any[]>([])
  const [form, setForm] = useState({
    patientName: '', patientAge: '', patientGender: '', patientPhone: '',
    doctorName: '', testName: '', templateId: '', values: {} as Record<string, any>,
    notes: '', impression: '',
  })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    Promise.all([
      api.get('/api/report-templates'),
      api.get('/api/tests'),
    ]).then(([t, te]) => { setTemplates(t.templates || []); setTests(te.tests || []) }).catch(() => {})
  }, [])

  // When template changes, pre-fill values structure
  useEffect(() => {
    if (form.templateId) {
      const tmpl = templates.find((t) => t.id === form.templateId)
      if (tmpl) {
        try {
          const t = JSON.parse(tmpl.template)
          const fields = t.fields || []
          const defaults = tmpl.defaultValues ? JSON.parse(tmpl.defaultValues) : {}
          const newValues: Record<string, any> = {}
          for (const f of fields) {
            newValues[f.name] = defaults[f.name] || ''
          }
          setForm({ ...form, values: newValues, testName: tmpl.testName })
        } catch {}
      }
    }
  }, [form.templateId])

  const submit = async () => {
    if (!form.patientName || !form.testName) { toast.error('Patient name and test name required'); return }
    setLoading(true)
    try {
      await api.post('/api/patient-reports', form)
      toast.success('Report created as draft')
      onDone()
    } catch (e: any) { toast.error(e.message) } finally { setLoading(false) }
  }

  const fields = form.templateId ? (() => {
    const tmpl = templates.find((t) => t.id === form.templateId)
    if (!tmpl) return []
    try { return JSON.parse(tmpl.template).fields || [] } catch { return [] }
  })() : []

  return (
    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
      <DialogHeader><DialogTitle>New Patient Report</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Patient Name *</Label><Input value={form.patientName} onChange={(e) => setForm({ ...form, patientName: e.target.value })} /></div>
          <div><Label>Phone</Label><Input value={form.patientPhone} onChange={(e) => setForm({ ...form, patientPhone: e.target.value })} /></div>
          <div><Label>Age</Label><Input type="number" value={form.patientAge} onChange={(e) => setForm({ ...form, patientAge: e.target.value })} /></div>
          <div>
            <Label>Gender</Label>
            <Select value={form.patientGender} onValueChange={(v) => setForm({ ...form, patientGender: v })}>
              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent><SelectItem value="male">Male</SelectItem><SelectItem value="female">Female</SelectItem><SelectItem value="other">Other</SelectItem></SelectContent>
            </Select>
          </div>
          <div><Label>Referring Doctor</Label><Input value={form.doctorName} onChange={(e) => setForm({ ...form, doctorName: e.target.value })} /></div>
          <div>
            <Label>Use Template</Label>
            <Select value={form.templateId} onValueChange={(v) => setForm({ ...form, templateId: v })}>
              <SelectTrigger><SelectValue placeholder="Blank report" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">Blank Report</SelectItem>
                {templates.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div><Label>Test Name *</Label><Input value={form.testName} onChange={(e) => setForm({ ...form, testName: e.target.value })} /></div>
        </div>

        {/* Template fields */}
        {fields.length > 0 && (
          <div className="border rounded p-3 bg-muted/30">
            <p className="font-medium text-sm mb-2">Test Parameters</p>
            <div className="grid grid-cols-2 gap-3">
              {fields.map((f: any) => (
                <div key={f.name}>
                  <Label className="text-xs">{f.name} {f.unit ? `(${f.unit})` : ''}</Label>
                  <Input
                    value={form.values[f.name] || ''}
                    onChange={(e) => setForm({ ...form, values: { ...form.values, [f.name]: e.target.value } })}
                    placeholder={f.refRange ? `Ref: ${f.refRange}` : ''}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        <div>
          <Label>Impression / Notes</Label>
          <Textarea value={form.impression} onChange={(e) => setForm({ ...form, impression: e.target.value })} rows={3} placeholder="Clinical impression, notes for patient..." />
        </div>
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button onClick={submit} disabled={loading} className="bg-brand-gradient text-white">{loading ? 'Creating...' : 'Create Report'}</Button>
      </DialogFooter>
    </DialogContent>
  )
}

function EditReportDialog({ report, onClose, onDone }: { report: any; onClose: () => void; onDone: () => void }) {
  const api = useApi()
  const [form, setForm] = useState<any>({ ...report, values: (() => { try { return JSON.parse(report.values || '{}') } catch { return {} } })() })
  const [loading, setLoading] = useState(false)
  const [deliverOpen, setDeliverOpen] = useState(false)

  const save = async (newStatus?: string) => {
    setLoading(true)
    try {
      const update: any = {
        patientName: form.patientName,
        patientAge: form.patientAge,
        patientPhone: form.patientPhone,
        doctorName: form.doctorName,
        impression: form.impression,
        notes: form.notes,
        values: form.values,
      }
      if (newStatus) update.status = newStatus
      await api.patch(`/api/patient-reports/${report.id}`, update)
      toast.success(`Report ${newStatus ? `marked ${newStatus}` : 'saved'}`)
      onDone()
    } catch (e: any) { toast.error(e.message) } finally { setLoading(false) }
  }

  const deliver = async (method: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/patient-reports/${report.id}/deliver`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('care_erp_token') || ''}` },
        body: JSON.stringify({ method }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Delivery failed')
      toast.success(`Report delivered via ${method}`)
      onDone()
    } catch (e: any) { toast.error(e.message) } finally { setLoading(false) }
  }

  return (
    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
      <DialogHeader><DialogTitle>Report — {report.reportNumber}</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div className="bg-muted/30 rounded p-3 text-sm flex justify-between">
          <span>Status: <strong>{report.status}</strong></span>
          <span>Test: <strong>{report.testName}</strong></span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Patient Name</Label><Input value={form.patientName || ''} onChange={(e) => setForm({ ...form, patientName: e.target.value })} /></div>
          <div><Label>Phone</Label><Input value={form.patientPhone || ''} onChange={(e) => setForm({ ...form, patientPhone: e.target.value })} /></div>
          <div><Label>Age</Label><Input value={form.patientAge || ''} onChange={(e) => setForm({ ...form, patientAge: e.target.value })} /></div>
          <div><Label>Doctor</Label><Input value={form.doctorName || ''} onChange={(e) => setForm({ ...form, doctorName: e.target.value })} /></div>
        </div>

        {/* Values editor — show existing keys */}
        {Object.keys(form.values || {}).length > 0 && (
          <div className="border rounded p-3 bg-muted/30">
            <p className="font-medium text-sm mb-2">Test Values</p>
            <div className="grid grid-cols-2 gap-3">
              {Object.entries(form.values).map(([k, v]: [string, any]) => (
                <div key={k}>
                  <Label className="text-xs">{k}</Label>
                  <Input value={typeof v === 'object' ? v.value || '' : v} onChange={(e) => setForm({ ...form, values: { ...form.values, [k]: e.target.value } })} />
                </div>
              ))}
            </div>
          </div>
        )}

        <div>
          <Label>Impression</Label>
          <Textarea value={form.impression || ''} onChange={(e) => setForm({ ...form, impression: e.target.value })} rows={3} />
        </div>
      </div>
      <DialogFooter className="flex-wrap gap-2">
        <Button variant="ghost" onClick={onClose}>Close</Button>
        <Button variant="outline" onClick={() => save()} disabled={loading}>Save</Button>
        {report.status === 'draft' && (
          <Button variant="outline" onClick={() => save('pending_review')} disabled={loading}>Submit for Review</Button>
        )}
        {report.status === 'pending_review' && (
          <Button onClick={() => save('approved')} disabled={loading} className="bg-blue-500 text-white">Approve</Button>
        )}
        {(report.status === 'approved' || report.status === 'delivered') && (
          <>
            <Button variant="outline" size="sm" onClick={() => deliver('whatsapp')} disabled={loading} className="text-emerald-600">
              <MessageSquare className="w-4 h-4 mr-1" /> WhatsApp
            </Button>
            <Button variant="outline" size="sm" onClick={() => deliver('email')} disabled={loading}>
              <Mail className="w-4 h-4 mr-1" /> Email
            </Button>
            <Button variant="outline" size="sm" onClick={() => window.open(`/api/patient-reports/${report.id}/pdf`, '_blank')}>
              <Printer className="w-4 h-4 mr-1" /> Print
            </Button>
          </>
        )}
      </DialogFooter>
    </DialogContent>
  )
}

// =====================================================
// TEMPLATES
// =====================================================
function TemplatesTab() {
  const api = useApi()
  const [templates, setTemplates] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [editTmpl, setEditTmpl] = useState<any>(null)
  const [createOpen, setCreateOpen] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const d = await api.get('/api/report-templates')
      setTemplates(d.templates || [])
    } catch (e: any) { toast.error(e.message) } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setCreateOpen(true)} className="bg-brand-gradient text-white">
          <Plus className="w-4 h-4 mr-1" /> New Template
        </Button>
      </div>
      <Card>
        <CardContent className="p-0">
          {loading ? <p className="text-center py-8 text-muted-foreground">Loading...</p> : templates.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">No templates yet. Create one to speed up report generation.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Test</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Fields</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {templates.map((t) => {
                  const fieldCount = (() => { try { return JSON.parse(t.template).fields?.length || 0 } catch { return 0 } })()
                  return (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium">{t.name}</TableCell>
                      <TableCell>{t.testName}</TableCell>
                      <TableCell><Badge variant="outline" className="capitalize">{t.category}</Badge></TableCell>
                      <TableCell>{fieldCount} fields</TableCell>
                      <TableCell><Badge variant={t.isActive ? 'default' : 'secondary'}>{t.isActive ? 'Active' : 'Inactive'}</Badge></TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="ghost" onClick={() => setEditTmpl(t)}><FileEdit className="w-4 h-4" /></Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <TemplateDialog onClose={() => setCreateOpen(false)} onDone={() => { setCreateOpen(false); load() }} />
      </Dialog>
      <Dialog open={!!editTmpl} onOpenChange={(o) => !o && setEditTmpl(null)}>
        {editTmpl && <TemplateDialog template={editTmpl} onClose={() => setEditTmpl(null)} onDone={() => { setEditTmpl(null); load() }} />}
      </Dialog>
    </div>
  )
}

function TemplateDialog({ template, onClose, onDone }: { template?: any; onClose: () => void; onDone: () => void }) {
  const api = useApi()
  const [form, setForm] = useState({
    name: template?.name || '',
    testName: template?.testName || '',
    category: template?.category || 'general',
    notes: template?.notes || '',
    fields: template ? (() => { try { return JSON.parse(template.template).fields || [] } catch { return [] } })() : [{ name: '', unit: '', refRange: '' }],
  })
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    if (!form.name || !form.testName) { toast.error('Name and test name required'); return }
    setLoading(true)
    try {
      const payload = { ...form, template: JSON.stringify({ fields: form.fields.filter((f) => f.name) }) }
      if (template) {
        await api.patch(`/api/report-templates/${template.id}`, payload)
        toast.success('Template updated')
      } else {
        await api.post('/api/report-templates', payload)
        toast.success('Template created')
      }
      onDone()
    } catch (e: any) { toast.error(e.message) } finally { setLoading(false) }
  }

  return (
    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
      <DialogHeader><DialogTitle>{template ? 'Edit Template' : 'New Template'}</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Template Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div><Label>Test Name *</Label><Input value={form.testName} onChange={(e) => setForm({ ...form, testName: e.target.value })} /></div>
          <div>
            <Label>Category</Label>
            <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {['general', 'hematology', 'biochemistry', 'microbiology', 'pathology', 'cardiology'].map((c) => (
                  <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <Label>Fields (Parameters)</Label>
            <Button size="sm" variant="outline" onClick={() => setForm({ ...form, fields: [...form.fields, { name: '', unit: '', refRange: '' }] })}>
              <Plus className="w-3 h-3 mr-1" /> Add Field
            </Button>
          </div>
          <div className="space-y-2 max-h-60 overflow-y-auto border rounded p-2">
            {form.fields.map((f, i) => (
              <div key={i} className="grid grid-cols-[1fr_80px_1fr_36px] gap-2 items-end">
                <Input placeholder="Parameter name (e.g. Hemoglobin)" value={f.name} onChange={(e) => setForm({ ...form, fields: form.fields.map((x, idx) => idx === i ? { ...x, name: e.target.value } : x) })} />
                <Input placeholder="Unit" value={f.unit} onChange={(e) => setForm({ ...form, fields: form.fields.map((x, idx) => idx === i ? { ...x, unit: e.target.value } : x) })} />
                <Input placeholder="Ref range" value={f.refRange} onChange={(e) => setForm({ ...form, fields: form.fields.map((x, idx) => idx === i ? { ...x, refRange: e.target.value } : x) })} />
                <Button size="sm" variant="ghost" onClick={() => setForm({ ...form, fields: form.fields.filter((_, idx) => idx !== i) })} className="text-rose-600 px-2">✕</Button>
              </div>
            ))}
          </div>
        </div>
        <div><Label>Notes</Label><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button onClick={submit} disabled={loading} className="bg-brand-gradient text-white">{loading ? 'Saving...' : 'Save Template'}</Button>
      </DialogFooter>
    </DialogContent>
  )
}
