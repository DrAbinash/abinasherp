'use client'

import { useState, useEffect, useRef } from 'react'
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
import { formatCurrency, formatDateTime } from '@/lib/format'
import { FlaskConical, Plus, Search, ArrowDownCircle, ArrowUpCircle, SlidersHorizontal, History, AlertTriangle, Package as PackageIcon } from 'lucide-react'

export function InventoryPage() {
  const [tab, setTab] = useState('items')
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Inventory</h1>
        <p className="text-muted-foreground text-sm mt-1">Reagents, consumables, equipment — stock ledger with low-stock alerts</p>
      </div>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="items">Items</TabsTrigger>
          <TabsTrigger value="low-stock">Low Stock</TabsTrigger>
          <TabsTrigger value="consumption-rules">Consumption Rules</TabsTrigger>
        </TabsList>
        <TabsContent value="items"><ItemsTab /></TabsContent>
        <TabsContent value="low-stock"><LowStockTab /></TabsContent>
        <TabsContent value="consumption-rules"><ConsumptionRulesTab /></TabsContent>
      </Tabs>
    </div>
  )
}

function ItemsTab() {
  const api = useApi()
  const [items, setItems] = useState<any[]>([])
  const [summary, setSummary] = useState<any>(null)
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const [movementItem, setMovementItem] = useState<any>(null)
  const [historyItem, setHistoryItem] = useState<any>(null)

  const load = async () => {
    setLoading(true)
    try {
      const [d, s] = await Promise.all([
        api.get(`/api/inventory?q=${encodeURIComponent(search)}`),
        api.get('/api/suppliers'),
      ])
      setItems(d.items || [])
      setSummary(d.summary)
      setSuppliers(s.suppliers || [])
    } catch (e: any) { toast.error(e.message) } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [search])

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="border-border/60"><CardContent className="p-3"><p className="text-xs text-muted-foreground">Total Items</p><p className="text-xl font-bold">{summary.totalItems}</p></CardContent></Card>
          <Card className="border-border/60"><CardContent className="p-3"><p className="text-xs text-muted-foreground">Stock Value</p><p className="text-xl font-bold text-emerald-600">{formatCurrency(summary.totalStockValue)}</p></CardContent></Card>
          <Card className="border-amber-200 bg-amber-50"><CardContent className="p-3"><p className="text-xs text-amber-700">Low Stock</p><p className="text-xl font-bold text-amber-700">{summary.lowStockCount}</p></CardContent></Card>
          <Card className="border-rose-200 bg-rose-50"><CardContent className="p-3"><p className="text-xs text-rose-700">Out of Stock</p><p className="text-xl font-bold text-rose-700">{summary.outOfStockCount}</p></CardContent></Card>
        </div>
      )}

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search items..." className="pl-9" />
          </div>
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild><Button className="bg-brand-gradient text-white"><Plus className="w-4 h-4 mr-1" /> New Item</Button></DialogTrigger>
            <NewItemDialog suppliers={suppliers} onClose={() => setAddOpen(false)} onDone={() => { setAddOpen(false); load() }} />
          </Dialog>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? <p className="text-center py-8 text-muted-foreground">Loading...</p> : items.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">No items. Click "New Item" to add.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead className="text-right">Stock</TableHead>
                  <TableHead className="text-right">Min</TableHead>
                  <TableHead className="text-right">Cost/Unit</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((i) => (
                  <TableRow key={i.id}>
                    <TableCell className="font-mono text-xs">{i.itemId}</TableCell>
                    <TableCell className="font-medium">{i.name}</TableCell>
                    <TableCell><Badge variant="outline">{i.category}</Badge></TableCell>
                    <TableCell className="text-sm">{i.unit}</TableCell>
                    <TableCell className="text-right font-medium">{i.currentStock}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{i.minStock}</TableCell>
                    <TableCell className="text-right">{formatCurrency(i.costPrice)}</TableCell>
                    <TableCell><Badge variant="outline" className={
                      i.stockStatus === 'Out of Stock' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                      i.stockStatus === 'Low Stock' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                      'bg-emerald-50 text-emerald-700 border-emerald-200'
                    }>{i.stockStatus}</Badge></TableCell>
                    <TableCell className="text-xs">{i.preferredVendorName || '—'}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-1 justify-end">
                        <Button size="sm" variant="ghost" onClick={() => setMovementItem(i)} title="Stock Movement"><SlidersHorizontal className="w-4 h-4" /></Button>
                        <Button size="sm" variant="ghost" onClick={() => setHistoryItem(i)} title="History"><History className="w-4 h-4" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!movementItem} onOpenChange={(o) => !o && setMovementItem(null)}>
        {movementItem && <MovementDialog item={movementItem} suppliers={suppliers} onClose={() => setMovementItem(null)} onDone={() => { setMovementItem(null); load() }} />}
      </Dialog>

      <Dialog open={!!historyItem} onOpenChange={(o) => !o && setHistoryItem(null)}>
        {historyItem && <HistoryDialog item={historyItem} onClose={() => setHistoryItem(null)} />}
      </Dialog>
    </div>
  )
}

function NewItemDialog({ suppliers, onClose, onDone }: { suppliers: any[]; onClose: () => void; onDone: () => void }) {
  const api = useApi()
  const [form, setForm] = useState({ name: '', unit: 'unit', category: 'consumable', currentStock: '0', minStock: '0', costPrice: '0', preferredVendorId: '' })
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    if (!form.name) { toast.error('Name required'); return }
    setLoading(true)
    try {
      await api.post('/api/inventory', form)
      toast.success('Item created')
      onDone()
    } catch (e: any) { toast.error(e.message) } finally { setLoading(false) }
  }

  return (
    <DialogContent>
      <DialogHeader><DialogTitle>New Inventory Item</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div><Label>Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Unit</Label><Input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="ml, vial, box, gm" /></div>
          <div><Label>Category</Label><Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="reagent, consumable" /></div>
          <div><Label>Initial Stock</Label><Input type="number" value={form.currentStock} onChange={(e) => setForm({ ...form, currentStock: e.target.value })} /></div>
          <div><Label>Min Stock (alert)</Label><Input type="number" value={form.minStock} onChange={(e) => setForm({ ...form, minStock: e.target.value })} /></div>
          <div><Label>Cost per Unit</Label><Input type="number" value={form.costPrice} onChange={(e) => setForm({ ...form, costPrice: e.target.value })} /></div>
          <div>
            <Label>Preferred Vendor</Label>
            <Select value={form.preferredVendorId} onValueChange={(v) => setForm({ ...form, preferredVendorId: v })}>
              <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">None</SelectItem>
                {suppliers.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button onClick={submit} disabled={loading} className="bg-brand-gradient text-white">{loading ? 'Creating...' : 'Create'}</Button>
      </DialogFooter>
    </DialogContent>
  )
}

function MovementDialog({ item, suppliers, onClose, onDone }: { item: any; suppliers: any[]; onClose: () => void; onDone: () => void }) {
  const api = useApi()
  const [mode, setMode] = useState<'in' | 'out' | 'adjust'>('in')
  const [quantity, setQuantity] = useState('')
  const [newQuantity, setNewQuantity] = useState(String(item.currentStock))
  const [reason, setReason] = useState('')
  const [reference, setReference] = useState('')
  const [vendorId, setVendorId] = useState(item.preferredVendorId || '')
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [invoiceDate, setInvoiceDate] = useState('')
  const [unitCost, setUnitCost] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    setLoading(true)
    try {
      const payload: any = { reason, reference }
      if (mode === 'in') {
        payload.quantity = quantity
        if (vendorId) payload.vendorId = vendorId
        if (invoiceNumber) payload.invoiceNumber = invoiceNumber
        if (invoiceDate) payload.invoiceDate = invoiceDate
        if (unitCost) payload.unitCost = unitCost
        await api.post(`/api/inventory/${item.id}/stock-in`, payload)
      } else if (mode === 'out') {
        payload.quantity = quantity
        await api.post(`/api/inventory/${item.id}/stock-out`, payload)
      } else {
        payload.newQuantity = newQuantity
        await api.post(`/api/inventory/${item.id}/adjust`, payload)
      }
      toast.success(`Stock ${mode === 'in' ? 'added' : mode === 'out' ? 'removed' : 'adjusted'}`)
      onDone()
    } catch (e: any) { toast.error(e.message) } finally { setLoading(false) }
  }

  return (
    <DialogContent>
      <DialogHeader><DialogTitle>Stock Movement — {item.name}</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div className="bg-muted/30 rounded p-2 text-sm flex justify-between">
          <span>Current: <strong>{item.currentStock} {item.unit}</strong></span>
          <span>Min: {item.minStock} {item.unit}</span>
        </div>
        <div className="flex gap-2">
          {(['in', 'out', 'adjust'] as const).map((m) => (
            <Button key={m} variant={mode === m ? 'default' : 'outline'} size="sm" onClick={() => setMode(m)} className="flex-1 capitalize">
              {m === 'in' ? <ArrowDownCircle className="w-4 h-4 mr-1" /> : m === 'out' ? <ArrowUpCircle className="w-4 h-4 mr-1" /> : <SlidersHorizontal className="w-4 h-4 mr-1" />}
              {m === 'in' ? 'Stock In' : m === 'out' ? 'Stock Out' : 'Adjust'}
            </Button>
          ))}
        </div>
        {mode === 'adjust' ? (
          <div><Label>New Quantity (absolute)</Label><Input type="number" value={newQuantity} onChange={(e) => setNewQuantity(e.target.value)} /></div>
        ) : (
          <div><Label>Quantity *</Label><Input type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder={`Amount to ${mode === 'in' ? 'add' : 'remove'}`} /></div>
        )}
        <div><Label>Reason</Label><Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder={mode === 'in' ? 'Purchase, restock' : mode === 'out' ? 'Used for test, expired, damaged' : 'Stock count correction'} /></div>
        <div><Label>Reference (optional)</Label><Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Bill #, order #" /></div>
        {mode === 'in' && (
          <div className="grid grid-cols-2 gap-3 p-3 border rounded bg-emerald-50/30">
            <div>
              <Label>Vendor</Label>
              <Select value={vendorId} onValueChange={setVendorId}>
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {suppliers.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Invoice #</Label><Input value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} /></div>
            <div><Label>Invoice Date</Label><Input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} /></div>
            <div><Label>Unit Cost</Label><Input type="number" value={unitCost} onChange={(e) => setUnitCost(e.target.value)} /></div>
          </div>
        )}
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button onClick={submit} disabled={loading} className="bg-brand-gradient text-white">{loading ? 'Processing...' : 'Record Movement'}</Button>
      </DialogFooter>
    </DialogContent>
  )
}

function HistoryDialog({ item, onClose }: { item: any; onClose: () => void }) {
  const api = useApi()
  const [history, setHistory] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get(`/api/inventory/${item.id}/history`).then((d) => { setHistory(d.history || []); setLoading(false) }).catch((e) => { toast.error(e.message); setLoading(false) })
  }, [item.id])

  return (
    <DialogContent className="max-w-2xl">
      <DialogHeader><DialogTitle>Stock History — {item.name}</DialogTitle></DialogHeader>
      {loading ? <p>Loading...</p> : history.length === 0 ? <p className="text-center py-4 text-muted-foreground">No movements recorded</p> : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Qty</TableHead>
              <TableHead className="text-right">Before</TableHead>
              <TableHead className="text-right">After</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead>Vendor</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {history.map((t) => (
              <TableRow key={t.id}>
                <TableCell className="text-xs">{formatDateTime(t.createdAt)}</TableCell>
                <TableCell><Badge variant="outline" className={t.type === 'in' ? 'bg-emerald-50 text-emerald-700' : t.type === 'out' ? 'bg-rose-50 text-rose-700' : 'bg-blue-50 text-blue-700'}>{t.type}</Badge></TableCell>
                <TableCell className={`text-right font-medium ${t.quantity >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{t.quantity >= 0 ? '+' : ''}{t.quantity}</TableCell>
                <TableCell className="text-right text-muted-foreground">{t.stockBefore}</TableCell>
                <TableCell className="text-right font-medium">{t.stockAfter}</TableCell>
                <TableCell className="text-xs">{t.reason || '—'}</TableCell>
                <TableCell className="text-xs">{t.vendorName || '—'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </DialogContent>
  )
}

function LowStockTab() {
  const api = useApi()
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/api/inventory/low-stock').then((d) => { setItems(d.items || []); setLoading(false) }).catch((e) => { toast.error(e.message); setLoading(false) })
  }, [])

  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-amber-600" /> Low Stock Alerts ({items.length})</CardTitle></CardHeader>
      <CardContent className="p-0">
        {loading ? <p className="text-center py-8 text-muted-foreground">Loading...</p> : items.length === 0 ? (
          <p className="text-center py-8 text-muted-foreground">🎉 All items are above minimum stock levels.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead className="text-right">Current</TableHead>
                <TableHead className="text-right">Min</TableHead>
                <TableHead className="text-right">Shortfall</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((i) => (
                <TableRow key={i.id}>
                  <TableCell className="font-medium">{i.name} <span className="text-xs text-muted-foreground">({i.itemId})</span></TableCell>
                  <TableCell className="text-right font-bold text-rose-600">{i.currentStock} {i.unit}</TableCell>
                  <TableCell className="text-right">{i.minStock} {i.unit}</TableCell>
                  <TableCell className="text-right text-rose-600">{(i.minStock - i.currentStock).toFixed(2)} {i.unit}</TableCell>
                  <TableCell><Badge variant="outline" className={i.currentStock <= 0 ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-amber-50 text-amber-700 border-amber-200'}>{i.currentStock <= 0 ? 'Out of Stock' : 'Low Stock'}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}

function ConsumptionRulesTab() {
  const api = useApi()
  const [rules, setRules] = useState<any[]>([])
  const [tests, setTests] = useState<any[]>([])
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try {
      const [r, t, i] = await Promise.all([
        api.get('/api/inventory/consumption-rules'),
        api.get('/api/tests'),
        api.get('/api/inventory'),
      ])
      setRules(r.rules || [])
      setTests(t.tests || [])
      setItems(i.items || [])
    } catch (e: any) { toast.error(e.message) } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const addRule = async (testId: string, itemId: string, quantity: string) => {
    if (!testId || !itemId) { toast.error('Select test and item'); return }
    try {
      await api.post('/api/inventory/consumption-rules', { testId, itemId, quantity: parseFloat(quantity || '1') })
      toast.success('Rule added')
      load()
    } catch (e: any) { toast.error(e.message) }
  }

  const deleteRule = async (id: string) => {
    try {
      await api.del(`/api/inventory/consumption-rules/${id}`)
      toast.success('Rule deleted')
      load()
    } catch (e: any) { toast.error(e.message) }
  }

  const [newTestId, setNewTestId] = useState('')
  const [newItemId, setNewItemId] = useState('')
  const [newQty, setNewQty] = useState('1')

  return (
    <Card>
      <CardHeader><CardTitle>Consumption Rules</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">Define how much of each inventory item is consumed when a test is performed. (Note: auto-deduction on test performance is a planned feature.)</p>

        {/* Add new rule */}
        <div className="border rounded-lg p-3 bg-muted/30">
          <p className="font-medium text-sm mb-2">Add Rule</p>
          <div className="grid grid-cols-4 gap-2">
            <Select value={newTestId} onValueChange={setNewTestId}>
              <SelectTrigger><SelectValue placeholder="Test" /></SelectTrigger>
              <SelectContent>{tests.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={newItemId} onValueChange={setNewItemId}>
              <SelectTrigger><SelectValue placeholder="Item" /></SelectTrigger>
              <SelectContent>{items.map((i) => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}</SelectContent>
            </Select>
            <Input type="number" value={newQty} onChange={(e) => setNewQty(e.target.value)} placeholder="Qty" step="0.01" />
            <Button onClick={() => addRule(newTestId, newItemId, newQty)} className="bg-brand-gradient text-white"><Plus className="w-4 h-4" /></Button>
          </div>
        </div>

        {/* Existing rules */}
        {loading ? <p className="text-center py-4 text-muted-foreground">Loading...</p> : rules.length === 0 ? (
          <p className="text-center py-4 text-muted-foreground">No consumption rules yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Test</TableHead>
                <TableHead>Item</TableHead>
                <TableHead className="text-right">Qty Consumed</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rules.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.testName} <span className="text-xs text-muted-foreground">({r.testCode})</span></TableCell>
                  <TableCell>{r.itemName}</TableCell>
                  <TableCell className="text-right">{r.quantity} {r.itemUnit}</TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost" onClick={() => deleteRule(r.id)} className="text-rose-600">Delete</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}
