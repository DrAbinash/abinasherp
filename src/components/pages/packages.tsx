'use client'

import { useState, useEffect } from 'react'
import { useApi } from '@/lib/auth-context'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'
import { formatCurrency } from '@/lib/format'
import { Package as PackageIcon, Plus, Edit, Trash2, FlaskConical, Clock, AlertTriangle } from 'lucide-react'

export function PackagesPage() {
  const api = useApi()
  const [packages, setPackages] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [editPkg, setEditPkg] = useState<any>(null)
  const [createOpen, setCreateOpen] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const d = await api.get('/api/packages')
      setPackages(d.packages || [])
    } catch (e: any) { toast.error(e.message) } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Health Packages</h1>
          <p className="text-muted-foreground text-sm mt-1">Pre-built health check profiles — Executive, Master, Senior, Women, Pre-employment</p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="bg-brand-gradient text-white">
          <Plus className="w-4 h-4 mr-1" /> New Package
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Total Packages</p><p className="text-2xl font-bold">{packages.length}</p></CardContent></Card>
        <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Total MRP Value</p><p className="text-2xl font-bold text-emerald-600">{formatCurrency(packages.reduce((s, p) => s + p.mrp, 0))}</p></CardContent></Card>
        <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Total Selling Price</p><p className="text-2xl font-bold text-blue-600">{formatCurrency(packages.reduce((s, p) => s + p.sellingPrice, 0))}</p></CardContent></Card>
        <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Total Discount</p><p className="text-2xl font-bold text-rose-600">{formatCurrency(packages.reduce((s, p) => s + (p.mrp - p.sellingPrice), 0))}</p></CardContent></Card>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? <p className="text-center py-8 text-muted-foreground">Loading...</p> : packages.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">No packages yet. Create health check profiles like &quot;Executive Checkup ₹2999&quot;.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Package ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Tests</TableHead>
                  <TableHead className="text-right">MRP</TableHead>
                  <TableHead className="text-right">Selling</TableHead>
                  <TableHead className="text-right">Discount</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Fasting</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {packages.map((p) => {
                  const discount = p.mrp > p.sellingPrice ? Math.round((1 - p.sellingPrice / p.mrp) * 100) : 0
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="font-mono text-xs">{p.packageId}</TableCell>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell><Badge variant="outline" className="capitalize">{p.category}</Badge></TableCell>
                      <TableCell className="text-right">{p.totalTests}</TableCell>
                      <TableCell className="text-right text-muted-foreground line-through">{formatCurrency(p.mrp)}</TableCell>
                      <TableCell className="text-right font-bold text-emerald-600">{formatCurrency(p.sellingPrice)}</TableCell>
                      <TableCell className="text-right">{discount > 0 ? <Badge variant="outline" className="text-rose-600 border-rose-300">{discount}% OFF</Badge> : '—'}</TableCell>
                      <TableCell className="text-sm">{p.durationHours}h</TableCell>
                      <TableCell>{p.fastingRequired ? <Badge variant="outline" className="text-amber-700 border-amber-300">Yes</Badge> : '—'}</TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="ghost" onClick={() => setEditPkg(p)}><Edit className="w-4 h-4" /></Button>
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
        <PackageDialog onClose={() => setCreateOpen(false)} onDone={() => { setCreateOpen(false); load() }} />
      </Dialog>
      <Dialog open={!!editPkg} onOpenChange={(o) => !o && setEditPkg(null)}>
        {editPkg && <PackageDialog pkg={editPkg} onClose={() => setEditPkg(null)} onDone={() => { setEditPkg(null); load() }} />}
      </Dialog>
    </div>
  )
}

function PackageDialog({ pkg, onClose, onDone }: { pkg?: any; onClose: () => void; onDone: () => void }) {
  const api = useApi()
  const [tests, setTests] = useState<any[]>([])
  const [form, setForm] = useState({
    name: pkg?.name || '',
    description: pkg?.description || '',
    category: pkg?.category || 'general',
    mrp: pkg?.mrp ? String(pkg.mrp) : '',
    sellingPrice: pkg?.sellingPrice ? String(pkg.sellingPrice) : '',
    durationHours: pkg?.durationHours ? String(pkg.durationHours) : '2',
    fastingRequired: pkg?.fastingRequired || false,
    instructions: pkg?.instructions || '',
    testIds: pkg ? (() => { try { return JSON.parse(pkg.testIds || '[]') } catch { return [] } })() : [] as string[],
  })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    api.get('/api/tests').then((d) => setTests(d.tests || [])).catch(() => {})
  }, [])

  const toggleTest = (testId: string) => {
    setForm({
      ...form,
      testIds: form.testIds.includes(testId)
        ? form.testIds.filter((id) => id !== testId)
        : [...form.testIds, testId],
    })
  }

  const submit = async () => {
    if (!form.name) { toast.error('Name required'); return }
    if (form.testIds.length === 0) { toast.error('Select at least one test'); return }
    setLoading(true)
    try {
      const payload = { ...form, mrp: parseFloat(form.mrp || '0'), sellingPrice: parseFloat(form.sellingPrice || '0'), durationHours: parseInt(form.durationHours || '2') }
      if (pkg) {
        await api.patch(`/api/packages/${pkg.id}`, payload)
        toast.success('Package updated')
      } else {
        await api.post('/api/packages', payload)
        toast.success('Package created')
      }
      onDone()
    } catch (e: any) { toast.error(e.message) } finally { setLoading(false) }
  }

  const categories = ['general', 'executive', 'master', 'senior', 'women', 'child', 'pre-employment']

  return (
    <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
      <DialogHeader><DialogTitle>{pkg ? 'Edit Package' : 'New Health Package'}</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Package Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Executive Health Checkup" /></div>
          <div>
            <Label>Category</Label>
            <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {categories.map((c) => <SelectItem key={c} value={c} className="capitalize">{c.replace('-', ' ')}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div><Label>MRP (₹)</Label><Input type="number" value={form.mrp} onChange={(e) => setForm({ ...form, mrp: e.target.value })} /></div>
          <div><Label>Selling Price (₹)</Label><Input type="number" value={form.sellingPrice} onChange={(e) => setForm({ ...form, sellingPrice: e.target.value })} /></div>
          <div><Label>Duration (hours)</Label><Input type="number" value={form.durationHours} onChange={(e) => setForm({ ...form, durationHours: e.target.value })} /></div>
          <div className="flex items-center gap-2 pt-6">
            <Switch checked={form.fastingRequired} onCheckedChange={(v) => setForm({ ...form, fastingRequired: v })} />
            <Label>Fasting Required</Label>
          </div>
        </div>
        <div><Label>Description</Label><Input value={form.instructions} onChange={(e) => setForm({ ...form, instructions: e.target.value })} placeholder="Pre-test instructions for patient" /></div>

        <div>
          <Label>Select Tests ({form.testIds.length} selected)</Label>
          <div className="border rounded max-h-60 overflow-y-auto">
            {tests.map((t) => (
              <label key={t.id} className="flex items-center gap-2 p-2 hover:bg-muted/30 border-b last:border-0 cursor-pointer text-sm">
                <input
                  type="checkbox"
                  checked={form.testIds.includes(t.id)}
                  onChange={() => toggleTest(t.id)}
                  className="rounded"
                />
                <span className="flex-1">{t.name} <span className="text-xs text-muted-foreground">({t.code})</span></span>
                <span className="text-emerald-600 font-medium">₹{t.price}</span>
              </label>
            ))}
          </div>
        </div>
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button onClick={submit} disabled={loading} className="bg-brand-gradient text-white">{loading ? 'Saving...' : 'Save Package'}</Button>
      </DialogFooter>
    </DialogContent>
  )
}
