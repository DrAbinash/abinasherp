'use client'

import { useState, useEffect } from 'react'
import { useApi } from '@/lib/auth-context'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
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
import { formatDate, todayIST } from '@/lib/format'
import { ClipboardCheck, Plus, Search, FileSearch } from 'lucide-react'

const CATEGORY_STYLE: Record<string, string> = {
  internal_audit: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  eqa: 'bg-blue-50 text-blue-700 border-blue-200',
  corrective_action: 'bg-amber-50 text-amber-700 border-amber-200',
  management_review: 'bg-violet-50 text-violet-700 border-violet-200',
}

const SEVERITY_STYLE: Record<string, string> = {
  minor: 'bg-amber-50 text-amber-700 border-amber-200',
  major: 'bg-orange-50 text-orange-700 border-orange-200',
  critical: 'bg-rose-50 text-rose-700 border-rose-200',
}

const STATUS_STYLE: Record<string, string> = {
  open: 'bg-rose-50 text-rose-700 border-rose-200',
  in_progress: 'bg-amber-50 text-amber-700 border-amber-200',
  implemented: 'bg-blue-50 text-blue-700 border-blue-200',
  verified: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  closed: 'bg-slate-100 text-slate-600 border-slate-200',
}

export function NablPage() {
  const [tab, setTab] = useState('checklists')
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">NABL Compliance</h1>
        <p className="text-muted-foreground text-sm mt-1">National Accreditation Board for Testing & Calibration Laboratories</p>
      </div>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="checklists">Checklists</TabsTrigger>
          <TabsTrigger value="corrective-actions">Corrective Actions</TabsTrigger>
        </TabsList>
        <TabsContent value="checklists"><ChecklistsTab /></TabsContent>
        <TabsContent value="corrective-actions"><CorrectiveActionsTab /></TabsContent>
      </Tabs>
    </div>
  )
}

function ChecklistsTab() {
  const api = useApi()
  const [checklists, setChecklists] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const [detail, setDetail] = useState<any | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const d = await api.get(`/api/nabl?category=${categoryFilter}`)
      let list = d.checklists || []
      if (search) {
        const q = search.toLowerCase()
        list = list.filter((c: any) => (c.title || '').toLowerCase().includes(q) || (c.checklistId || '').toLowerCase().includes(q) || (c.auditorName || '').toLowerCase().includes(q))
      }
      setChecklists(list)
    } catch (e: any) { toast.error(e.message) } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [categoryFilter, search])

  const summary = {
    total: checklists.length,
    open: checklists.filter((c) => c.status === 'open' || c.status === 'in_progress').length,
    closed: checklists.filter((c) => c.status === 'closed' || c.status === 'completed').length,
    openFindings: checklists.reduce((s, c) => s + Math.max(0, (c.totalFindings || 0) - (c.closedFindings || 0)), 0),
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-border/60"><CardContent className="p-3"><p className="text-xs text-muted-foreground">Total Checklists</p><p className="text-xl font-bold">{summary.total}</p></CardContent></Card>
        <Card className="border-amber-200 bg-amber-50"><CardContent className="p-3"><p className="text-xs text-amber-700">Open / In Progress</p><p className="text-xl font-bold text-amber-700">{summary.open}</p></CardContent></Card>
        <Card className="border-emerald-200 bg-emerald-50"><CardContent className="p-3"><p className="text-xs text-emerald-700">Closed / Completed</p><p className="text-xl font-bold text-emerald-700">{summary.closed}</p></CardContent></Card>
        <Card className="border-rose-200 bg-rose-50"><CardContent className="p-3"><p className="text-xs text-rose-700">Open Findings</p><p className="text-xl font-bold text-rose-700">{summary.openFindings}</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-3 flex-wrap">
          <div className="flex gap-2 items-center flex-1 min-w-0">
            <div className="relative max-w-md flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search checklists..." className="pl-9" />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-44"><SelectValue placeholder="All Categories" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="internal_audit">Internal Audit</SelectItem>
                <SelectItem value="eqa">EQA</SelectItem>
                <SelectItem value="corrective_action">Corrective Action</SelectItem>
                <SelectItem value="management_review">Management Review</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild><Button className="bg-brand-gradient text-white"><Plus className="w-4 h-4 mr-1" /> New Checklist</Button></DialogTrigger>
            <NewChecklistDialog onClose={() => setAddOpen(false)} onDone={() => { setAddOpen(false); load() }} />
          </Dialog>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? <p className="text-center py-8 text-muted-foreground">Loading...</p> : checklists.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">No checklists. Click "New Checklist" to start an audit.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Checklist ID</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Audit Date</TableHead>
                    <TableHead>Auditor</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-center">Findings (Open/Total)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {checklists.map((c) => {
                    const open = Math.max(0, (c.totalFindings || 0) - (c.closedFindings || 0))
                    return (
                      <TableRow key={c.id} className="cursor-pointer hover:bg-muted/40" onClick={() => setDetail(c)}>
                        <TableCell className="font-mono text-xs">{c.checklistId}</TableCell>
                        <TableCell className="font-medium">{c.title}</TableCell>
                        <TableCell><Badge variant="outline" className={`capitalize ${CATEGORY_STYLE[c.category] || ''}`}>{c.category.replace('_', ' ')}</Badge></TableCell>
                        <TableCell className="text-sm">{formatDate(c.auditDate)}</TableCell>
                        <TableCell className="text-sm">{c.auditorName || '—'}</TableCell>
                        <TableCell><Badge variant="outline" className={
                          c.status === 'closed' || c.status === 'completed' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                          c.status === 'in_progress' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                          'bg-rose-50 text-rose-700 border-rose-200'
                        }>{c.status.replace('_', ' ')}</Badge></TableCell>
                        <TableCell className="text-center">
                          <span className={open > 0 ? 'text-rose-600 font-semibold' : 'text-emerald-600'}>
                            {open}/{c.totalFindings || 0}
                          </span>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        {detail && <ChecklistDetailDialog checklist={detail} onClose={() => setDetail(null)} onDone={load} />}
      </Dialog>
    </div>
  )
}

function NewChecklistDialog({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const api = useApi()
  const [form, setForm] = useState({ title: '', category: 'internal_audit', auditDate: todayIST(), auditorName: '', notes: '' })
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    if (!form.title || !form.category || !form.auditDate) { toast.error('Title, category and audit date required'); return }
    setLoading(true)
    try {
      await api.post('/api/nabl', form)
      toast.success('Checklist created')
      onDone()
    } catch (e: any) { toast.error(e.message) } finally { setLoading(false) }
  }

  return (
    <DialogContent>
      <DialogHeader><DialogTitle className="flex items-center gap-2"><ClipboardCheck className="w-5 h-5 text-emerald-600" /> New NABL Checklist</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div><Label>Title *</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Q1 2025 Internal Audit" /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Category *</Label>
            <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="internal_audit">Internal Audit</SelectItem>
                <SelectItem value="eqa">EQA</SelectItem>
                <SelectItem value="corrective_action">Corrective Action</SelectItem>
                <SelectItem value="management_review">Management Review</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label>Audit Date *</Label><Input type="date" value={form.auditDate} onChange={(e) => setForm({ ...form, auditDate: e.target.value })} /></div>
        </div>
        <div><Label>Auditor Name</Label><Input value={form.auditorName} onChange={(e) => setForm({ ...form, auditorName: e.target.value })} /></div>
        <div><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} /></div>
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button onClick={submit} disabled={loading} className="bg-brand-gradient text-white">{loading ? 'Creating...' : 'Create'}</Button>
      </DialogFooter>
    </DialogContent>
  )
}

function ChecklistDetailDialog({ checklist, onClose, onDone }: { checklist: any; onClose: () => void; onDone: () => void }) {
  const api = useApi()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ finding: '', severity: 'minor', rootCause: '', correctiveAction: '', preventiveAction: '', assignedTo: '', dueDate: '', status: 'open' })
  const [saving, setSaving] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const d = await api.get(`/api/nabl/${checklist.id}`)
      setData(d.checklist)
    } catch (e: any) { toast.error(e.message) } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [checklist.id])

  const submit = async () => {
    if (!form.finding) { toast.error('Finding required'); return }
    setSaving(true)
    try {
      await api.post(`/api/nabl/${checklist.id}/corrective-actions`, form)
      toast.success('Corrective action added')
      setAdding(false)
      setForm({ finding: '', severity: 'minor', rootCause: '', correctiveAction: '', preventiveAction: '', assignedTo: '', dueDate: '', status: 'open' })
      load()
      onDone()
    } catch (e: any) { toast.error(e.message) } finally { setSaving(false) }
  }

  return (
    <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2"><FileSearch className="w-5 h-5 text-emerald-600" /> {checklist.title}</DialogTitle>
      </DialogHeader>
      <div className="text-xs text-muted-foreground mb-2 flex flex-wrap gap-3">
        <span className="font-mono">{checklist.checklistId}</span>
        <Badge variant="outline" className={`capitalize ${CATEGORY_STYLE[checklist.category] || ''}`}>{checklist.category.replace('_', ' ')}</Badge>
        <span>Audit: {formatDate(checklist.auditDate)}</span>
        {checklist.auditorName && <span>Auditor: {checklist.auditorName}</span>}
      </div>

      {!adding ? (
        <Button onClick={() => setAdding(true)} size="sm" className="bg-brand-gradient text-white"><Plus className="w-4 h-4 mr-1" /> Add Corrective Action</Button>
      ) : (
        <div className="border rounded-lg p-3 space-y-2 bg-muted/30">
          <div><Label className="text-xs">Finding *</Label><Textarea value={form.finding} onChange={(e) => setForm({ ...form, finding: e.target.value })} rows={2} /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label className="text-xs">Severity</Label>
              <Select value={form.severity} onValueChange={(v) => setForm({ ...form, severity: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="minor">Minor</SelectItem>
                  <SelectItem value="major">Major</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="implemented">Implemented</SelectItem>
                  <SelectItem value="verified">Verified</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">Assigned To</Label><Input value={form.assignedTo} onChange={(e) => setForm({ ...form, assignedTo: e.target.value })} /></div>
            <div><Label className="text-xs">Due Date</Label><Input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} /></div>
          </div>
          <div><Label className="text-xs">Root Cause</Label><Input value={form.rootCause} onChange={(e) => setForm({ ...form, rootCause: e.target.value })} /></div>
          <div><Label className="text-xs">Corrective Action</Label><Textarea value={form.correctiveAction} onChange={(e) => setForm({ ...form, correctiveAction: e.target.value })} rows={2} /></div>
          <div><Label className="text-xs">Preventive Action</Label><Textarea value={form.preventiveAction} onChange={(e) => setForm({ ...form, preventiveAction: e.target.value })} rows={2} /></div>
          <div className="flex gap-2 justify-end">
            <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>Cancel</Button>
            <Button size="sm" onClick={submit} disabled={saving} className="bg-brand-gradient text-white">{saving ? 'Saving...' : 'Save'}</Button>
          </div>
        </div>
      )}

      <div className="mt-2">
        <p className="text-sm font-semibold mb-2">Corrective Actions ({data?.correctiveActions?.length || 0})</p>
        {loading ? <p className="text-center py-4 text-muted-foreground">Loading...</p> : !data || !data.correctiveActions || data.correctiveActions.length === 0 ? (
          <p className="text-center py-4 text-muted-foreground text-sm">No corrective actions yet.</p>
        ) : (
          <div className="border rounded-lg divide-y max-h-96 overflow-y-auto">
            {data.correctiveActions.map((a: any) => (
              <div key={a.id} className="p-3">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <Badge variant="outline" className={`capitalize ${SEVERITY_STYLE[a.severity] || ''}`}>{a.severity}</Badge>
                  <Badge variant="outline" className={`capitalize ${STATUS_STYLE[a.status] || ''}`}>{a.status.replace('_', ' ')}</Badge>
                  {a.dueDate && <span className="text-xs text-muted-foreground">Due: {formatDate(a.dueDate)}</span>}
                  {a.assignedTo && <span className="text-xs text-muted-foreground">· {a.assignedTo}</span>}
                </div>
                <p className="text-sm font-medium">{a.finding}</p>
                {a.rootCause && <p className="text-xs text-muted-foreground mt-1"><strong>Root cause:</strong> {a.rootCause}</p>}
                {a.correctiveAction && <p className="text-xs text-muted-foreground"><strong>Corrective:</strong> {a.correctiveAction}</p>}
                {a.preventiveAction && <p className="text-xs text-muted-foreground"><strong>Preventive:</strong> {a.preventiveAction}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </DialogContent>
  )
}

function CorrectiveActionsTab() {
  const api = useApi()
  const [checklists, setChecklists] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [severityFilter, setSeverityFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  useEffect(() => {
    (async () => {
      setLoading(true)
      try {
        const d = await api.get('/api/nabl')
        const list = d.checklists || []
        const withActions = await Promise.all(
          list.map((c: any) => api.get(`/api/nabl/${c.id}`).then((r) => ({ ...c, actions: r.checklist?.correctiveActions || [] })).catch(() => ({ ...c, actions: [] })))
        )
        setChecklists(withActions)
      } catch (e: any) { toast.error(e.message) } finally { setLoading(false) }
    })()
  }, [])

  const allActions = checklists.flatMap((c) => (c.actions || []).map((a: any) => ({ ...a, checklistTitle: c.title, checklistId: c.checklistId })))
  const filtered = allActions.filter((a) => {
    if (severityFilter && a.severity !== severityFilter) return false
    if (statusFilter && a.status !== statusFilter) return false
    return true
  })

  const counts = {
    minor: allActions.filter((a) => a.severity === 'minor').length,
    major: allActions.filter((a) => a.severity === 'major').length,
    critical: allActions.filter((a) => a.severity === 'critical').length,
    open: allActions.filter((a) => a.status !== 'closed' && a.status !== 'verified').length,
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-amber-200 bg-amber-50"><CardContent className="p-3"><p className="text-xs text-amber-700">Minor</p><p className="text-xl font-bold text-amber-700">{counts.minor}</p></CardContent></Card>
        <Card className="border-orange-200 bg-orange-50"><CardContent className="p-3"><p className="text-xs text-orange-700">Major</p><p className="text-xl font-bold text-orange-700">{counts.major}</p></CardContent></Card>
        <Card className="border-rose-200 bg-rose-50"><CardContent className="p-3"><p className="text-xs text-rose-700">Critical</p><p className="text-xl font-bold text-rose-700">{counts.critical}</p></CardContent></Card>
        <Card className="border-border/60"><CardContent className="p-3"><p className="text-xs text-muted-foreground">Open / In Progress</p><p className="text-xl font-bold">{counts.open}</p></CardContent></Card>
      </div>

      <div className="flex gap-2 flex-wrap items-center">
        <span className="text-sm text-muted-foreground">Severity:</span>
        {['', 'minor', 'major', 'critical'].map((s) => (
          <Button key={s || 'all'} variant={severityFilter === s ? 'default' : 'outline'} size="sm" onClick={() => setSeverityFilter(s)} className="capitalize">{s || 'All'}</Button>
        ))}
        <span className="text-sm text-muted-foreground ml-2">Status:</span>
        {['', 'open', 'in_progress', 'implemented', 'verified', 'closed'].map((s) => (
          <Button key={s || 'all'} variant={statusFilter === s ? 'default' : 'outline'} size="sm" onClick={() => setStatusFilter(s)} className="capitalize">{s ? s.replace('_', ' ') : 'All'}</Button>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? <p className="text-center py-8 text-muted-foreground">Loading...</p> : filtered.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">No corrective actions match your filters.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Severity</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Finding</TableHead>
                    <TableHead>Checklist</TableHead>
                    <TableHead>Assigned To</TableHead>
                    <TableHead>Due Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell><Badge variant="outline" className={`capitalize ${SEVERITY_STYLE[a.severity] || ''}`}>{a.severity}</Badge></TableCell>
                      <TableCell><Badge variant="outline" className={`capitalize ${STATUS_STYLE[a.status] || ''}`}>{a.status.replace('_', ' ')}</Badge></TableCell>
                      <TableCell className="text-sm max-w-md">
                        <p className="font-medium">{a.finding}</p>
                        {a.correctiveAction && <p className="text-xs text-muted-foreground mt-0.5">{a.correctiveAction}</p>}
                      </TableCell>
                      <TableCell className="text-xs">
                        <span className="font-mono">{a.checklistId}</span>
                        <p className="text-muted-foreground">{a.checklistTitle}</p>
                      </TableCell>
                      <TableCell className="text-sm">{a.assignedTo || '—'}</TableCell>
                      <TableCell className="text-sm">{formatDate(a.dueDate)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
