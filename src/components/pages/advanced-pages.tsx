'use client'

import { useState, useEffect } from 'react'
import { useApi } from '@/lib/auth-context'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { formatCurrency, formatDateTime, formatDate, todayIST } from '@/lib/format'
import { TestTube2, Printer, Search, QrCode, MapPin, User, Phone, Clock, Building2, FileText, TrendingUp, IndianRupee } from 'lucide-react'

// =====================================================
// SAMPLE TRACKING PAGE
// =====================================================
export function SamplesPage() {
  const api = useApi()
  const [samples, setSamples] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('')
  const [search, setSearch] = useState('')
  const [scanOpen, setScanOpen] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const status = statusFilter === 'all' ? '' : statusFilter
      const d = await api.get(`/api/samples?status=${status}&q=${encodeURIComponent(search)}`)
      setSamples(d.samples || [])
    } catch (e: any) { toast.error(e.message) } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [statusFilter, search])

  const updateStatus = async (id: string, status: string) => {
    try {
      await api.post(`/api/samples/${id}/status`, { status })
      toast.success(`Marked ${status}`)
      load()
    } catch (e: any) { toast.error(e.message) }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Sample Tracking</h1>
          <p className="text-muted-foreground text-sm mt-1">Barcoded sample tubes — collection, transit, lab, processing workflow</p>
        </div>
        <Button onClick={() => setScanOpen(true)} variant="outline">
          <QrCode className="w-4 h-4 mr-1" /> Scan Barcode
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Pending</p><p className="text-xl font-bold">{samples.filter((s) => s.status === 'pending').length}</p></CardContent></Card>
        <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Collected</p><p className="text-xl font-bold text-blue-600">{samples.filter((s) => s.status === 'collected').length}</p></CardContent></Card>
        <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">In Transit</p><p className="text-xl font-bold text-amber-600">{samples.filter((s) => s.status === 'in_transit').length}</p></CardContent></Card>
        <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">At Lab</p><p className="text-xl font-bold text-violet-600">{samples.filter((s) => s.status === 'at_lab' || s.status === 'processing').length}</p></CardContent></Card>
        <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Completed</p><p className="text-xl font-bold text-emerald-600">{samples.filter((s) => s.status === 'completed').length}</p></CardContent></Card>
      </div>

      <div className="flex gap-2 flex-wrap">
        {['all', 'pending', 'collected', 'in_transit', 'at_lab', 'processing', 'completed', 'discarded', 'rejected'].map((s) => (
          <Button key={s} variant={statusFilter === s ? 'default' : 'outline'} size="sm" onClick={() => setStatusFilter(s)} className="capitalize">{s.replace('_', ' ')}</Button>
        ))}
        <div className="flex-1" />
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search sample ID, patient..." className="pl-9" />
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? <p className="text-center py-8 text-muted-foreground">Loading...</p> : samples.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">No samples. Create samples from a bill in the Billing page.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Sample ID</TableHead>
                  <TableHead>Patient</TableHead>
                  <TableHead>Test</TableHead>
                  <TableHead>Bill #</TableHead>
                  <TableHead>Container</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Update</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {samples.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-mono text-xs">{s.sampleId}</TableCell>
                    <TableCell className="font-medium">{s.patientName}</TableCell>
                    <TableCell className="text-sm">{s.testName}</TableCell>
                    <TableCell className="text-xs">{s.billNumber || '—'}</TableCell>
                    <TableCell className="text-xs">{s.containerType || '—'}</TableCell>
                    <TableCell>{s.priority === 'urgent' ? <Badge variant="outline" className="text-rose-600 border-rose-300">Urgent</Badge> : '—'}</TableCell>
                    <TableCell><Badge variant="outline" className={
                      s.status === 'completed' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                      s.status === 'discarded' || s.status === 'rejected' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                      s.status === 'pending' ? 'bg-slate-50 text-slate-700' :
                      'bg-blue-50 text-blue-700 border-blue-200'
                    }>{s.status.replace('_', ' ')}</Badge></TableCell>
                    <TableCell className="text-xs">{formatDateTime(s.updatedAt)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-1 justify-end">
                        <Button size="sm" variant="ghost" onClick={() => window.open(`/api/samples/${s.id}/barcode`, '_blank')} title="View Barcode"><QrCode className="w-4 h-4" /></Button>
                        <Select onValueChange={(v) => updateStatus(s.id, v)}>
                          <SelectTrigger className="w-32 h-8 text-xs"><SelectValue placeholder="Update" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="collected">Collected</SelectItem>
                            <SelectItem value="in_transit">In Transit</SelectItem>
                            <SelectItem value="at_lab">At Lab</SelectItem>
                            <SelectItem value="processing">Processing</SelectItem>
                            <SelectItem value="completed">Completed</SelectItem>
                            <SelectItem value="discarded">Discarded</SelectItem>
                            <SelectItem value="rejected">Rejected</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={scanOpen} onOpenChange={setScanOpen}>
        <ScanBarcodeDialog onClose={() => setScanOpen(false)} />
      </Dialog>
    </div>
  )
}

function ScanBarcodeDialog({ onClose }: { onClose: () => void }) {
  const api = useApi()
  const [sampleId, setSampleId] = useState('')
  const [sample, setSample] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const lookup = async () => {
    if (!sampleId) return
    setLoading(true)
    try {
      const d = await api.get(`/api/samples/by-barcode/${encodeURIComponent(sampleId)}`)
      setSample(d.sample)
    } catch (e: any) {
      toast.error(e.message)
      setSample(null)
    } finally { setLoading(false) }
  }

  const updateStatus = async (status: string) => {
    if (!sample) return
    try {
      await api.post(`/api/samples/${sample.id}/status`, { status })
      toast.success(`Marked ${status}`)
      setSample({ ...sample, status })
    } catch (e: any) { toast.error(e.message) }
  }

  return (
    <DialogContent>
      <DialogHeader><DialogTitle>Scan / Enter Sample Barcode</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div>
          <Label>Sample ID (scan barcode or type)</Label>
          <div className="flex gap-2">
            <Input value={sampleId} onChange={(e) => setSampleId(e.target.value)} placeholder="S-20260709-0001" onKeyDown={(e) => e.key === 'Enter' && lookup()} />
            <Button onClick={lookup} disabled={loading}>Lookup</Button>
          </div>
        </div>
        {sample && (
          <div className="border rounded p-3 space-y-2">
            <div className="flex justify-between"><span className="text-muted-foreground">Sample ID:</span><span className="font-mono font-bold">{sample.sampleId}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Patient:</span><span className="font-medium">{sample.patientName}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Test:</span><span>{sample.testName}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Bill:</span><span className="text-xs">{sample.billNumber}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Status:</span><Badge variant="outline" className="capitalize">{sample.status.replace('_', ' ')}</Badge></div>
          </div>
        )}
        {sample && (
          <div>
            <Label>Quick Status Update</Label>
            <div className="grid grid-cols-3 gap-2">
              <Button size="sm" variant="outline" onClick={() => updateStatus('collected')}>Collected</Button>
              <Button size="sm" variant="outline" onClick={() => updateStatus('in_transit')}>In Transit</Button>
              <Button size="sm" variant="outline" onClick={() => updateStatus('at_lab')}>At Lab</Button>
              <Button size="sm" variant="outline" onClick={() => updateStatus('processing')}>Processing</Button>
              <Button size="sm" variant="outline" onClick={() => updateStatus('completed')} className="text-emerald-600">Completed</Button>
              <Button size="sm" variant="outline" onClick={() => updateStatus('discarded')} className="text-rose-600">Discarded</Button>
            </div>
          </div>
        )}
      </div>
    </DialogContent>
  )
}

// =====================================================
// HOME COLLECTION PAGE
// =====================================================
export function HomeCollectionPage() {
  const api = useApi()
  const [requests, setRequests] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('')
  const [date, setDate] = useState(todayIST())
  const [assignOpen, setAssignOpen] = useState<any>(null)

  const load = async () => {
    setLoading(true)
    try {
      const status = statusFilter === 'all' ? '' : statusFilter
      const d = await api.get(`/api/home-collection?status=${status}&date=${date}`)
      setRequests(d.requests || [])
    } catch (e: any) { toast.error(e.message) } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [statusFilter, date])

  const updateStatus = async (id: string, status: string) => {
    try {
      await api.post(`/api/home-collection/${id}/status`, { status })
      toast.success(`Marked ${status.replace('_', ' ')}`)
      load()
    } catch (e: any) { toast.error(e.message) }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Home Sample Collection</h1>
        <p className="text-muted-foreground text-sm mt-1">Patient-requested home visits — assign phlebotomist, track status</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Requested</p><p className="text-xl font-bold">{requests.filter((r) => r.status === 'requested').length}</p></CardContent></Card>
        <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Assigned</p><p className="text-xl font-bold text-blue-600">{requests.filter((r) => r.status === 'assigned').length}</p></CardContent></Card>
        <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">En Route</p><p className="text-xl font-bold text-amber-600">{requests.filter((r) => r.status === 'en_route').length}</p></CardContent></Card>
        <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Collected</p><p className="text-xl font-bold text-violet-600">{requests.filter((r) => r.status === 'collected').length}</p></CardContent></Card>
        <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Completed</p><p className="text-xl font-bold text-emerald-600">{requests.filter((r) => r.status === 'completed').length}</p></CardContent></Card>
      </div>

      <div className="flex gap-3 items-end flex-wrap">
        <div><Label className="text-xs">Date</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-44" /></div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40"><SelectValue placeholder="All statuses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="requested">Requested</SelectItem>
            <SelectItem value="assigned">Assigned</SelectItem>
            <SelectItem value="en_route">En Route</SelectItem>
            <SelectItem value="collected">Collected</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? <p className="text-center py-8 text-muted-foreground">Loading...</p> : requests.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">No home collection requests for this date.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Request #</TableHead>
                  <TableHead>Patient</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead>Tests/Package</TableHead>
                  <TableHead>Slot</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Phlebotomist</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-xs">{r.requestId}</TableCell>
                    <TableCell className="font-medium">{r.patientName}</TableCell>
                    <TableCell className="text-sm">{r.patientPhone}</TableCell>
                    <TableCell className="text-xs max-w-xs truncate"><MapPin className="w-3 h-3 inline mr-1" />{r.address}, {r.city} {r.pincode}</TableCell>
                    <TableCell className="text-xs">{r.packageName || JSON.parse(r.testNames || '[]').slice(0, 2).join(', ')}</TableCell>
                    <TableCell className="text-xs capitalize">{r.preferredDate} {r.preferredSlot}</TableCell>
                    <TableCell className="text-right">{formatCurrency(r.amount)}</TableCell>
                    <TableCell className="text-xs">{r.assignedPhlebotomistName || <span className="text-amber-600">Unassigned</span>}</TableCell>
                    <TableCell><Badge variant="outline" className={
                      r.status === 'completed' ? 'bg-emerald-50 text-emerald-700' :
                      r.status === 'cancelled' ? 'bg-rose-50 text-rose-700' :
                      r.status === 'requested' ? 'bg-amber-50 text-amber-700' :
                      'bg-blue-50 text-blue-700'
                    }>{r.status.replace('_', ' ')}</Badge></TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-1 justify-end">
                        {r.status === 'requested' && <Button size="sm" variant="outline" onClick={() => setAssignOpen(r)}>Assign</Button>}
                        {r.status === 'assigned' && <Button size="sm" variant="outline" onClick={() => updateStatus(r.id, 'en_route')}>En Route</Button>}
                        {r.status === 'en_route' && <Button size="sm" variant="outline" onClick={() => updateStatus(r.id, 'collected')}>Collected</Button>}
                        {r.status === 'collected' && <Button size="sm" variant="outline" onClick={() => updateStatus(r.id, 'completed')} className="text-emerald-600">Complete</Button>}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!assignOpen} onOpenChange={(o) => !o && setAssignOpen(null)}>
        {assignOpen && <AssignDialog request={assignOpen} onClose={() => setAssignOpen(null)} onDone={() => { setAssignOpen(null); load() }} />}
      </Dialog>
    </div>
  )
}

function AssignDialog({ request, onClose, onDone }: { request: any; onClose: () => void; onDone: () => void }) {
  const api = useApi()
  const [staff, setStaff] = useState<any[]>([])
  const [selectedId, setSelectedId] = useState('')

  useEffect(() => {
    api.get('/api/staff?q=phlebotomist').then((d) => setStaff(d.staff || [])).catch(() => {})
    // Also load all staff in case phlebotomists aren't filtered
    api.get('/api/staff').then((d) => {
      const phlebo = (d.staff || []).filter((s: any) => s.role === 'phlebotomist' || s.role === 'lab-technician')
      if (phlebo.length > 0) setStaff(phlebo)
    }).catch(() => {})
  }, [])

  const assign = async () => {
    if (!selectedId) { toast.error('Select a phlebotomist'); return }
    const s = staff.find((x) => x.id === selectedId)
    try {
      await api.post(`/api/home-collection/${request.id}/assign`, {
        phlebotomistId: s.id,
        phlebotomistName: `${s.firstName} ${s.lastName || ''}`,
      })
      toast.success('Phlebotomist assigned')
      onDone()
    } catch (e: any) { toast.error(e.message) }
  }

  return (
    <DialogContent>
      <DialogHeader><DialogTitle>Assign Phlebotomist — {request.requestId}</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div className="bg-muted/30 rounded p-3 text-sm">
          <p><strong>{request.patientName}</strong> · {request.patientPhone}</p>
          <p className="text-xs text-muted-foreground mt-1"><MapPin className="w-3 h-3 inline" /> {request.address}, {request.city} {request.pincode}</p>
          <p className="text-xs mt-1">Slot: {request.preferredDate} {request.preferredSlot}</p>
        </div>
        <div>
          <Label>Select Phlebotomist</Label>
          <Select value={selectedId} onValueChange={setSelectedId}>
            <SelectTrigger><SelectValue placeholder="Choose staff member" /></SelectTrigger>
            <SelectContent>
              {staff.length === 0 ? <SelectItem value="none" disabled>No phlebotomist staff found</SelectItem> :
                staff.map((s) => <SelectItem key={s.id} value={s.id}>{s.firstName} {s.lastName || ''} — {s.role}</SelectItem>)
              }
            </SelectContent>
          </Select>
          {staff.length === 0 && <p className="text-xs text-amber-600 mt-1">Add staff with role &quot;phlebotomist&quot; in People → Staff first.</p>}
        </div>
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button onClick={assign} disabled={!selectedId} className="bg-brand-gradient text-white">Assign</Button>
      </DialogFooter>
    </DialogContent>
  )
}

// =====================================================
// CORPORATE / TPA BILLING PAGE
// =====================================================
export function CorporatePage() {
  const [tab, setTab] = useState('corporates')
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Corporate / TPA Billing</h1>
        <p className="text-muted-foreground text-sm mt-1">Corporate master, negotiated rate cards, credit billing, monthly invoices, aging report</p>
      </div>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="corporates">Corporates</TabsTrigger>
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
          <TabsTrigger value="aging">Aging Report</TabsTrigger>
        </TabsList>
        <TabsContent value="corporates"><CorporatesTab /></TabsContent>
        <TabsContent value="invoices"><InvoicesTab /></TabsContent>
        <TabsContent value="aging"><AgingTab /></TabsContent>
      </Tabs>
    </div>
  )
}

function CorporatesTab() {
  const api = useApi()
  const [corporates, setCorporates] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [editCorp, setEditCorp] = useState<any>(null)
  const [createOpen, setCreateOpen] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const d = await api.get('/api/corporates')
      setCorporates(d.corporates || [])
    } catch (e: any) { toast.error(e.message) } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setCreateOpen(true)} className="bg-brand-gradient text-white"><Building2 className="w-4 h-4 mr-1" /> New Corporate</Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? <p className="text-center py-8 text-muted-foreground">Loading...</p> : corporates.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">No corporates yet. Add corporate/TPA/insurance partners.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Corporate ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead className="text-right">Credit Terms</TableHead>
                  <TableHead className="text-right">Outstanding</TableHead>
                  <TableHead className="text-right">Rate Cards</TableHead>
                  <TableHead className="text-right">Patients</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {corporates.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-mono text-xs">{c.corporateId}</TableCell>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell><Badge variant="outline" className="capitalize">{c.type}</Badge></TableCell>
                    <TableCell className="text-sm">{c.contactPerson || '—'} {c.phone ? `· ${c.phone}` : ''}</TableCell>
                    <TableCell className="text-right text-sm">{c.creditTermsDays} days</TableCell>
                    <TableCell className="text-right font-bold text-rose-600">{formatCurrency(c.outstandingBalance)}</TableCell>
                    <TableCell className="text-right">{c._count?.rateCards || 0}</TableCell>
                    <TableCell className="text-right">{c._count?.patients || 0}</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="ghost" onClick={() => setEditCorp(c)}><FileText className="w-4 h-4" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <CorporateDialog onClose={() => setCreateOpen(false)} onDone={() => { setCreateOpen(false); load() }} />
      </Dialog>
      <Dialog open={!!editCorp} onOpenChange={(o) => !o && setEditCorp(null)}>
        {editCorp && <CorporateDialog corp={editCorp} onClose={() => setEditCorp(null)} onDone={() => { setEditCorp(null); load() }} />}
      </Dialog>
    </div>
  )
}

function CorporateDialog({ corp, onClose, onDone }: { corp?: any; onClose: () => void; onDone: () => void }) {
  const api = useApi()
  const [form, setForm] = useState({
    name: corp?.name || '', type: corp?.type || 'corporate', contactPerson: corp?.contactPerson || '',
    phone: corp?.phone || '', email: corp?.email || '', gstin: corp?.gstin || '', pan: corp?.pan || '',
    address: corp?.address || '', city: corp?.city || '', state: corp?.state || '', pincode: corp?.pincode || '',
    creditTermsDays: corp?.creditTermsDays ? String(corp.creditTermsDays) : '30',
    creditLimit: corp?.creditLimit ? String(corp.creditLimit) : '0',
    notes: corp?.notes || '',
  })
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    if (!form.name) { toast.error('Name required'); return }
    setLoading(true)
    try {
      if (corp) {
        await api.patch(`/api/corporates/${corp.id}`, form)
        toast.success('Corporate updated')
      } else {
        await api.post('/api/corporates', form)
        toast.success('Corporate created')
      }
      onDone()
    } catch (e: any) { toast.error(e.message) } finally { setLoading(false) }
  }

  return (
    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
      <DialogHeader><DialogTitle>{corp ? 'Edit Corporate' : 'New Corporate / TPA'}</DialogTitle></DialogHeader>
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
        <div>
          <Label>Type</Label>
          <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="corporate">Corporate</SelectItem>
              <SelectItem value="tpa">TPA (Third Party Administrator)</SelectItem>
              <SelectItem value="insurance">Insurance</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div><Label>Contact Person</Label><Input value={form.contactPerson} onChange={(e) => setForm({ ...form, contactPerson: e.target.value })} /></div>
        <div><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
        <div><Label>Email</Label><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
        <div><Label>GSTIN</Label><Input value={form.gstin} onChange={(e) => setForm({ ...form, gstin: e.target.value.toUpperCase() })} /></div>
        <div><Label>PAN</Label><Input value={form.pan} onChange={(e) => setForm({ ...form, pan: e.target.value.toUpperCase() })} /></div>
        <div><Label>Credit Terms (days)</Label><Input type="number" value={form.creditTermsDays} onChange={(e) => setForm({ ...form, creditTermsDays: e.target.value })} /></div>
        <div><Label>Credit Limit (₹, 0=unlimited)</Label><Input type="number" value={form.creditLimit} onChange={(e) => setForm({ ...form, creditLimit: e.target.value })} /></div>
        <div className="col-span-2"><Label>Address</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
        <div><Label>City</Label><Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div>
        <div><Label>State</Label><Input value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} /></div>
        <div><Label>Pincode</Label><Input value={form.pincode} onChange={(e) => setForm({ ...form, pincode: e.target.value })} /></div>
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button onClick={submit} disabled={loading} className="bg-brand-gradient text-white">{loading ? 'Saving...' : 'Save'}</Button>
      </DialogFooter>
    </DialogContent>
  )
}

function InvoicesTab() {
  const api = useApi()
  const [invoices, setInvoices] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [corporates, setCorporates] = useState<any[]>([])
  const [generateOpen, setGenerateOpen] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const [inv, corp] = await Promise.all([api.get('/api/corporates/invoices'), api.get('/api/corporates')])
      setInvoices(inv.invoices || [])
      setCorporates(corp.corporates || [])
    } catch (e: any) { toast.error(e.message) } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const markPaid = async (id: string) => {
    try {
      await api.patch(`/api/corporates/invoices/${id}`, { status: 'paid' })
      toast.success('Invoice marked as paid')
      load()
    } catch (e: any) { toast.error(e.message) }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setGenerateOpen(true)} className="bg-brand-gradient text-white"><FileText className="w-4 h-4 mr-1" /> Generate Invoice</Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? <p className="text-center py-8 text-muted-foreground">Loading...</p> : invoices.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">No invoices generated yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Corporate</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead className="text-right">Bills</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Paid</TableHead>
                  <TableHead className="text-right">Outstanding</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell className="font-mono text-xs">{inv.invoiceNumber}</TableCell>
                    <TableCell className="font-medium">{inv.corporateName}</TableCell>
                    <TableCell className="text-xs">{inv.periodFrom} → {inv.periodTo}</TableCell>
                    <TableCell className="text-right">{inv.billCount}</TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(inv.totalAmount)}</TableCell>
                    <TableCell className="text-right text-emerald-600">{formatCurrency(inv.paidAmount)}</TableCell>
                    <TableCell className="text-right font-bold text-rose-600">{formatCurrency(inv.totalAmount - inv.paidAmount)}</TableCell>
                    <TableCell className="text-xs">{inv.dueDate}</TableCell>
                    <TableCell><Badge variant="outline" className={
                      inv.status === 'paid' ? 'bg-emerald-50 text-emerald-700' :
                      inv.status === 'overdue' ? 'bg-rose-50 text-rose-700' :
                      inv.status === 'partial' ? 'bg-amber-50 text-amber-700' :
                      'bg-blue-50 text-blue-700'
                    }>{inv.status}</Badge></TableCell>
                    <TableCell className="text-right">
                      {inv.status !== 'paid' && <Button size="sm" variant="ghost" onClick={() => markPaid(inv.id)} className="text-emerald-600">Mark Paid</Button>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={generateOpen} onOpenChange={setGenerateOpen}>
        <GenerateInvoiceDialog corporates={corporates} onClose={() => setGenerateOpen(false)} onDone={() => { setGenerateOpen(false); load() }} />
      </Dialog>
    </div>
  )
}

function GenerateInvoiceDialog({ corporates, onClose, onDone }: { corporates: any[]; onClose: () => void; onDone: () => void }) {
  const api = useApi()
  const [corporateId, setCorporateId] = useState('')
  const [periodFrom, setPeriodFrom] = useState('')
  const [periodTo, setPeriodTo] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    if (!corporateId || !periodFrom || !periodTo) { toast.error('Select corporate and period'); return }
    setLoading(true)
    try {
      const d = await api.post('/api/corporates/invoices', { corporateId, periodFrom, periodTo })
      toast.success(`Invoice ${d.invoice.invoiceNumber} generated — ${d.billCount} bills, ${formatCurrency(d.totalAmount)}`)
      onDone()
    } catch (e: any) { toast.error(e.message) } finally { setLoading(false) }
  }

  // Default to last month
  useEffect(() => {
    const now = new Date()
    const first = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const last = new Date(now.getFullYear(), now.getMonth(), 0)
    setPeriodFrom(first.toISOString().slice(0, 10))
    setPeriodTo(last.toISOString().slice(0, 10))
  }, [])

  return (
    <DialogContent>
      <DialogHeader><DialogTitle>Generate Monthly Invoice</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div>
          <Label>Corporate</Label>
          <Select value={corporateId} onValueChange={setCorporateId}>
            <SelectTrigger><SelectValue placeholder="Select corporate" /></SelectTrigger>
            <SelectContent>
              {corporates.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Period From</Label><Input type="date" value={periodFrom} onChange={(e) => setPeriodFrom(e.target.value)} /></div>
          <div><Label>Period To</Label><Input type="date" value={periodTo} onChange={(e) => setPeriodTo(e.target.value)} /></div>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded p-3 text-xs text-blue-800">
          This will consolidate all bills for patients enrolled with this corporate in the selected period into a single invoice.
        </div>
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button onClick={submit} disabled={loading} className="bg-brand-gradient text-white">{loading ? 'Generating...' : 'Generate'}</Button>
      </DialogFooter>
    </DialogContent>
  )
}

function AgingTab() {
  const api = useApi()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/api/corporates/aging').then((d) => { setData(d); setLoading(false) }).catch((e) => { toast.error(e.message); setLoading(false) })
  }, [])

  if (loading) return <p className="text-center py-8 text-muted-foreground">Loading...</p>
  if (!data || data.aging.length === 0) return <Card><CardContent className="p-8 text-center text-muted-foreground">No outstanding corporate dues 🎉</CardContent></Card>

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card className="bg-rose-50"><CardContent className="p-3"><p className="text-xs text-rose-700">Total Outstanding</p><p className="text-xl font-bold text-rose-600">{formatCurrency(data.totals.totalOutstanding)}</p></CardContent></Card>
        <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">0-30 days</p><p className="text-lg font-bold text-emerald-600">{formatCurrency(data.totals.bucket030)}</p></CardContent></Card>
        <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">31-60 days</p><p className="text-lg font-bold text-amber-600">{formatCurrency(data.totals.bucket3160)}</p></CardContent></Card>
        <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">61-90 days</p><p className="text-lg font-bold text-orange-600">{formatCurrency(data.totals.bucket6190)}</p></CardContent></Card>
        <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">90+ days</p><p className="text-lg font-bold text-rose-600">{formatCurrency(data.totals.bucket90Plus)}</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Corporate-wise Aging</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Corporate</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Credit Terms</TableHead>
                <TableHead className="text-right">0-30 days</TableHead>
                <TableHead className="text-right">31-60 days</TableHead>
                <TableHead className="text-right">61-90 days</TableHead>
                <TableHead className="text-right">90+ days</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.aging.map((a: any) => (
                <TableRow key={a.corporateId}>
                  <TableCell className="font-medium">{a.corporateName}</TableCell>
                  <TableCell><Badge variant="outline" className="capitalize">{a.type}</Badge></TableCell>
                  <TableCell className="text-right text-sm">{a.creditTermsDays} days</TableCell>
                  <TableCell className="text-right text-emerald-600">{formatCurrency(a.bucket030)}</TableCell>
                  <TableCell className="text-right text-amber-600">{formatCurrency(a.bucket3160)}</TableCell>
                  <TableCell className="text-right text-orange-600">{formatCurrency(a.bucket6190)}</TableCell>
                  <TableCell className="text-right text-rose-600">{formatCurrency(a.bucket90Plus)}</TableCell>
                  <TableCell className="text-right font-bold">{formatCurrency(a.totalOutstanding)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
