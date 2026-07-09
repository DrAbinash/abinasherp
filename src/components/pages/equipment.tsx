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
import { toast } from 'sonner'
import { formatCurrency, formatDate, todayIST } from '@/lib/format'
import {
  Microscope, Plus, Search, History, AlertTriangle, Wrench,
  CheckCircle2, ShieldAlert, Cog,
} from 'lucide-react'

export function EquipmentPage() {
  const [tab, setTab] = useState('equipment')
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Equipment</h1>
        <p className="text-muted-foreground text-sm mt-1">Lab equipment register — AMC, service scheduling, maintenance history</p>
      </div>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="equipment">Equipment</TabsTrigger>
          <TabsTrigger value="maintenance-due">Maintenance Due</TabsTrigger>
        </TabsList>
        <TabsContent value="equipment"><EquipmentTab /></TabsContent>
        <TabsContent value="maintenance-due"><MaintenanceDueTab /></TabsContent>
      </Tabs>
    </div>
  )
}

function EquipmentTab() {
  const api = useApi()
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const [historyItem, setHistoryItem] = useState<any | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const d = await api.get(`/api/equipment?q=${encodeURIComponent(search)}&status=${statusFilter}`)
      setItems(d.equipment || [])
    } catch (e: any) { toast.error(e.message) } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [search, statusFilter])

  const summary = {
    total: items.length,
    operational: items.filter((i) => i.status === 'operational').length,
    maintenance: items.filter((i) => i.status === 'under_maintenance').length,
    breakdown: items.filter((i) => i.status === 'breakdown').length,
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-border/60"><CardContent className="p-3"><p className="text-xs text-muted-foreground">Total Equipment</p><p className="text-xl font-bold">{summary.total}</p></CardContent></Card>
        <Card className="border-emerald-200 bg-emerald-50"><CardContent className="p-3"><p className="text-xs text-emerald-700">Operational</p><p className="text-xl font-bold text-emerald-700">{summary.operational}</p></CardContent></Card>
        <Card className="border-amber-200 bg-amber-50"><CardContent className="p-3"><p className="text-xs text-amber-700">Under Maintenance</p><p className="text-xl font-bold text-amber-700">{summary.maintenance}</p></CardContent></Card>
        <Card className="border-rose-200 bg-rose-50"><CardContent className="p-3"><p className="text-xs text-rose-700">Breakdown</p><p className="text-xl font-bold text-rose-700">{summary.breakdown}</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-3 flex-wrap">
          <div className="flex gap-2 items-center flex-1 min-w-0">
            <div className="relative max-w-md flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search equipment..." className="pl-9" />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40"><SelectValue placeholder="All Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="operational">Operational</SelectItem>
                <SelectItem value="under_maintenance">Under Maintenance</SelectItem>
                <SelectItem value="breakdown">Breakdown</SelectItem>
                <SelectItem value="retired">Retired</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild><Button className="bg-brand-gradient text-white"><Plus className="w-4 h-4 mr-1" /> New Equipment</Button></DialogTrigger>
            <NewEquipmentDialog onClose={() => setAddOpen(false)} onDone={() => { setAddOpen(false); load() }} />
          </Dialog>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? <p className="text-center py-8 text-muted-foreground">Loading...</p> : items.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">No equipment. Click "New Equipment" to add.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Equipment ID</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Model</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Next Service</TableHead>
                    <TableHead>AMC End</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((i) => (
                    <TableRow key={i.id} className="cursor-pointer hover:bg-muted/40" onClick={() => setHistoryItem(i)}>
                      <TableCell className="font-mono text-xs">{i.equipmentId}</TableCell>
                      <TableCell className="font-medium">{i.name}</TableCell>
                      <TableCell className="text-sm">{i.model || '—'}{i.manufacturer ? <span className="text-xs text-muted-foreground block">{i.manufacturer}</span> : null}</TableCell>
                      <TableCell><Badge variant="outline" className="capitalize">{i.category}</Badge></TableCell>
                      <TableCell className="text-sm">{i.location || '—'}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={
                          i.status === 'operational' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                          i.status === 'under_maintenance' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                          i.status === 'breakdown' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                          'bg-slate-50 text-slate-700 border-slate-200'
                        }>{i.status.replace('_', ' ')}</Badge>
                      </TableCell>
                      <TableCell className="text-sm">{formatDate(i.nextServiceDate)}</TableCell>
                      <TableCell className="text-sm">{formatDate(i.amcEndDate)}</TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); setHistoryItem(i) }} title="Maintenance history">
                          <History className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!historyItem} onOpenChange={(o) => !o && setHistoryItem(null)}>
        {historyItem && <MaintenanceHistoryDialog item={historyItem} onClose={() => setHistoryItem(null)} onDone={load} />}
      </Dialog>
    </div>
  )
}

function NewEquipmentDialog({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const api = useApi()
  const [form, setForm] = useState({
    name: '', model: '', manufacturer: '', serialNumber: '', category: 'general', location: '',
    purchaseDate: '', purchaseCost: '', amcVendor: '', amcStartDate: '', amcEndDate: '', amcContractNo: '',
    lastServiceDate: '', nextServiceDate: '', calibrationDate: '', nextCalibrationDate: '',
    status: 'operational', notes: '',
  })
  const [loading, setLoading] = useState(false)

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }))

  const submit = async () => {
    if (!form.name) { toast.error('Name required'); return }
    setLoading(true)
    try {
      await api.post('/api/equipment', form)
      toast.success('Equipment created')
      onDone()
    } catch (e: any) { toast.error(e.message) } finally { setLoading(false) }
  }

  return (
    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
      <DialogHeader><DialogTitle className="flex items-center gap-2"><Microscope className="w-5 h-5 text-emerald-600" /> New Equipment</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Name *</Label><Input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Auto Analyzer 3000" /></div>
          <div><Label>Category</Label>
            <Select value={form.category} onValueChange={(v) => set('category', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="general">General</SelectItem>
                <SelectItem value="analyzer">Analyzer</SelectItem>
                <SelectItem value="usg">USG</SelectItem>
                <SelectItem value="xray">X-Ray</SelectItem>
                <SelectItem value="mri">MRI</SelectItem>
                <SelectItem value="ct">CT</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label>Model</Label><Input value={form.model} onChange={(e) => set('model', e.target.value)} /></div>
          <div><Label>Manufacturer</Label><Input value={form.manufacturer} onChange={(e) => set('manufacturer', e.target.value)} /></div>
          <div><Label>Serial Number</Label><Input value={form.serialNumber} onChange={(e) => set('serialNumber', e.target.value)} /></div>
          <div><Label>Location</Label><Input value={form.location} onChange={(e) => set('location', e.target.value)} placeholder="Lab Room 1" /></div>
          <div><Label>Purchase Date</Label><Input type="date" value={form.purchaseDate} onChange={(e) => set('purchaseDate', e.target.value)} /></div>
          <div><Label>Purchase Cost (₹)</Label><Input type="number" value={form.purchaseCost} onChange={(e) => set('purchaseCost', e.target.value)} /></div>
        </div>

        <div className="border-t pt-3">
          <p className="text-sm font-semibold mb-2 flex items-center gap-1"><ShieldAlert className="w-4 h-4 text-amber-600" /> AMC Details</p>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>AMC Vendor</Label><Input value={form.amcVendor} onChange={(e) => set('amcVendor', e.target.value)} /></div>
            <div><Label>AMC Contract #</Label><Input value={form.amcContractNo} onChange={(e) => set('amcContractNo', e.target.value)} /></div>
            <div><Label>AMC Start</Label><Input type="date" value={form.amcStartDate} onChange={(e) => set('amcStartDate', e.target.value)} /></div>
            <div><Label>AMC End</Label><Input type="date" value={form.amcEndDate} onChange={(e) => set('amcEndDate', e.target.value)} /></div>
          </div>
        </div>

        <div className="border-t pt-3">
          <p className="text-sm font-semibold mb-2 flex items-center gap-1"><Wrench className="w-4 h-4 text-emerald-600" /> Service & Calibration</p>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Last Service Date</Label><Input type="date" value={form.lastServiceDate} onChange={(e) => set('lastServiceDate', e.target.value)} /></div>
            <div><Label>Next Service Date</Label><Input type="date" value={form.nextServiceDate} onChange={(e) => set('nextServiceDate', e.target.value)} /></div>
            <div><Label>Calibration Date</Label><Input type="date" value={form.calibrationDate} onChange={(e) => set('calibrationDate', e.target.value)} /></div>
            <div><Label>Next Calibration Date</Label><Input type="date" value={form.nextCalibrationDate} onChange={(e) => set('nextCalibrationDate', e.target.value)} /></div>
            <div><Label>Initial Status</Label>
              <Select value={form.status} onValueChange={(v) => set('status', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="operational">Operational</SelectItem>
                  <SelectItem value="under_maintenance">Under Maintenance</SelectItem>
                  <SelectItem value="breakdown">Breakdown</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="mt-3"><Label>Notes</Label><Input value={form.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Optional notes" /></div>
        </div>
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button onClick={submit} disabled={loading} className="bg-brand-gradient text-white">{loading ? 'Creating...' : 'Create Equipment'}</Button>
      </DialogFooter>
    </DialogContent>
  )
}

function MaintenanceHistoryDialog({ item, onClose, onDone }: { item: any; onClose: () => void; onDone: () => void }) {
  const api = useApi()
  const [logs, setLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({
    type: 'scheduled', serviceDate: todayIST(), performedBy: '', vendorName: '',
    description: '', cost: '', partsReplaced: '', downtimeHours: '', nextServiceDate: '', status: 'completed',
  })
  const [saving, setSaving] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const d = await api.get(`/api/equipment/${item.id}/maintenance`)
      setLogs(d.logs || [])
    } catch (e: any) { toast.error(e.message) } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [item.id])

  const submit = async () => {
    if (!form.type || !form.serviceDate || !form.description) { toast.error('Type, date and description required'); return }
    setSaving(true)
    try {
      await api.post(`/api/equipment/${item.id}/maintenance`, form)
      toast.success('Maintenance log added')
      setAdding(false)
      setForm({ type: 'scheduled', serviceDate: todayIST(), performedBy: '', vendorName: '', description: '', cost: '', partsReplaced: '', downtimeHours: '', nextServiceDate: '', status: 'completed' })
      load()
      onDone()
    } catch (e: any) { toast.error(e.message) } finally { setSaving(false) }
  }

  return (
    <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Cog className="w-5 h-5 text-emerald-600" /> Maintenance History — {item.name}
        </DialogTitle>
      </DialogHeader>
      <div className="text-xs text-muted-foreground mb-2">
        <span className="font-mono">{item.equipmentId}</span> · {item.model || '—'} · {item.manufacturer || '—'} · {item.location || '—'}
      </div>

      {!adding ? (
        <Button onClick={() => setAdding(true)} size="sm" className="bg-brand-gradient text-white"><Plus className="w-4 h-4 mr-1" /> Add Maintenance Log</Button>
      ) : (
        <div className="border rounded-lg p-3 space-y-2 bg-muted/30">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Type</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                  <SelectItem value="breakdown">Breakdown</SelectItem>
                  <SelectItem value="calibration">Calibration</SelectItem>
                  <SelectItem value="amc_visit">AMC Visit</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">Service Date</Label><Input type="date" value={form.serviceDate} onChange={(e) => setForm({ ...form, serviceDate: e.target.value })} /></div>
            <div><Label className="text-xs">Performed By</Label><Input value={form.performedBy} onChange={(e) => setForm({ ...form, performedBy: e.target.value })} /></div>
            <div><Label className="text-xs">Vendor Name</Label><Input value={form.vendorName} onChange={(e) => setForm({ ...form, vendorName: e.target.value })} /></div>
            <div><Label className="text-xs">Cost (₹)</Label><Input type="number" value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} /></div>
            <div><Label className="text-xs">Downtime (hrs)</Label><Input type="number" value={form.downtimeHours} onChange={(e) => setForm({ ...form, downtimeHours: e.target.value })} /></div>
            <div><Label className="text-xs">Next Service Date</Label><Input type="date" value={form.nextServiceDate} onChange={(e) => setForm({ ...form, nextServiceDate: e.target.value })} /></div>
            <div>
              <Label className="text-xs">Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="deferred">Deferred</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div><Label className="text-xs">Description *</Label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="What was done?" /></div>
          <div><Label className="text-xs">Parts Replaced</Label><Input value={form.partsReplaced} onChange={(e) => setForm({ ...form, partsReplaced: e.target.value })} /></div>
          <div className="flex gap-2 justify-end">
            <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>Cancel</Button>
            <Button size="sm" onClick={submit} disabled={saving} className="bg-brand-gradient text-white">{saving ? 'Saving...' : 'Save Log'}</Button>
          </div>
        </div>
      )}

      <div className="mt-2">
        {loading ? <p className="text-center py-4 text-muted-foreground">Loading...</p> : logs.length === 0 ? (
          <p className="text-center py-4 text-muted-foreground">No maintenance history yet.</p>
        ) : (
          <div className="border rounded-lg divide-y max-h-96 overflow-y-auto">
            {logs.map((l) => (
              <div key={l.id} className="p-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="capitalize">{l.type.replace('_', ' ')}</Badge>
                    <Badge variant="outline" className={l.status === 'completed' ? 'bg-emerald-50 text-emerald-700' : l.status === 'in_progress' ? 'bg-amber-50 text-amber-700' : 'bg-slate-50 text-slate-700'}>{l.status.replace('_', ' ')}</Badge>
                    <span className="text-xs text-muted-foreground">{formatDate(l.serviceDate)}</span>
                  </div>
                  {l.cost > 0 && <span className="text-sm font-semibold text-emerald-700">{formatCurrency(l.cost)}</span>}
                </div>
                <p className="text-sm mt-1">{l.description}</p>
                <div className="text-xs text-muted-foreground mt-1 flex gap-3 flex-wrap">
                  {l.performedBy && <span>By: {l.performedBy}</span>}
                  {l.vendorName && <span>Vendor: {l.vendorName}</span>}
                  {l.partsReplaced && <span>Parts: {l.partsReplaced}</span>}
                  {l.downtimeHours > 0 && <span>Downtime: {l.downtimeHours}h</span>}
                  {l.nextServiceDate && <span>Next: {formatDate(l.nextServiceDate)}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DialogContent>
  )
}

function MaintenanceDueTab() {
  const api = useApi()
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/api/equipment').then((d) => { setItems(d.equipment || []); setLoading(false) }).catch((e) => { toast.error(e.message); setLoading(false) })
  }, [])

  const today = new Date(todayIST() + 'T00:00:00')
  const inSevenDays = new Date(today)
  inSevenDays.setDate(inSevenDays.getDate() + 7)

  const due = items.filter((i) => {
    const check = (d: string | null | undefined) => {
      if (!d) return false
      const date = new Date(d + 'T00:00:00')
      return date <= inSevenDays
    }
    return check(i.nextServiceDate) || check(i.nextCalibrationDate)
  })

  const isOverdue = (d: string | null | undefined) => {
    if (!d) return false
    return new Date(d + 'T00:00:00') < today
  }

  return (
    <div className="space-y-4">
      <Card className="border-amber-200 bg-amber-50/50">
        <CardContent className="p-4 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600" />
          <div>
            <p className="font-medium text-amber-800">{due.length} equipment need attention</p>
            <p className="text-xs text-amber-700">Service or calibration past due or due within 7 days</p>
          </div>
        </CardContent>
      </Card>

      {loading ? <p className="text-center py-8 text-muted-foreground">Loading...</p> : due.length === 0 ? (
        <Card><CardContent className="p-8 text-center">
          <CheckCircle2 className="w-12 h-12 mx-auto text-emerald-500 mb-3" />
          <p className="font-medium">All equipment are up to date</p>
          <p className="text-sm text-muted-foreground">No maintenance due in the next 7 days.</p>
        </CardContent></Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {due.map((i) => {
            const serviceOverdue = isOverdue(i.nextServiceDate)
            const calibOverdue = isOverdue(i.nextCalibrationDate)
            return (
              <Card key={i.id} className={serviceOverdue || calibOverdue ? 'border-rose-200' : 'border-amber-200'}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold">{i.name}</p>
                      <p className="text-xs text-muted-foreground font-mono">{i.equipmentId} · {i.model || '—'}</p>
                      <p className="text-xs text-muted-foreground">{i.location || '—'} · <span className="capitalize">{i.category}</span></p>
                    </div>
                    <Badge variant="outline" className={
                      i.status === 'operational' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                      i.status === 'under_maintenance' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                      'bg-rose-50 text-rose-700 border-rose-200'
                    }>{i.status.replace('_', ' ')}</Badge>
                  </div>
                  <div className="mt-3 space-y-1.5 text-sm">
                    {i.nextServiceDate && (
                      <div className={`flex items-center justify-between p-2 rounded ${serviceOverdue ? 'bg-rose-50 text-rose-800' : 'bg-amber-50 text-amber-800'}`}>
                        <span className="flex items-center gap-1.5"><Wrench className="w-3.5 h-3.5" /> Service {serviceOverdue ? 'overdue' : 'due'}</span>
                        <span className="font-semibold">{formatDate(i.nextServiceDate)}</span>
                      </div>
                    )}
                    {i.nextCalibrationDate && (
                      <div className={`flex items-center justify-between p-2 rounded ${calibOverdue ? 'bg-rose-50 text-rose-800' : 'bg-amber-50 text-amber-800'}`}>
                        <span className="flex items-center gap-1.5"><ShieldAlert className="w-3.5 h-3.5" /> Calibration {calibOverdue ? 'overdue' : 'due'}</span>
                        <span className="font-semibold">{formatDate(i.nextCalibrationDate)}</span>
                      </div>
                    )}
                  </div>
                  {i.amcEndDate && (
                    <p className="text-xs text-muted-foreground mt-2">AMC ends: {formatDate(i.amcEndDate)} {i.amcVendor ? `(${i.amcVendor})` : ''}</p>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
