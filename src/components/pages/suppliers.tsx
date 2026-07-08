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
import { toast } from 'sonner'
import { Users, Plus, Search, Building2, Phone, Mail, FileText } from 'lucide-react'

export function SuppliersPage() {
  const api = useApi()
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const [selectedSupplier, setSelectedSupplier] = useState<any>(null)

  const load = async () => {
    setLoading(true)
    try {
      const d = await api.get(`/api/suppliers?q=${encodeURIComponent(search)}`)
      setSuppliers(d.suppliers || [])
    } catch (e: any) { toast.error(e.message) } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [search])

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Suppliers</h1>
          <p className="text-muted-foreground text-sm mt-1">Sundry Creditors / Debtors — auto-linked to accounting ledgers</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button className="bg-brand-gradient text-white"><Plus className="w-4 h-4 mr-1" /> New Supplier</Button></DialogTrigger>
          <NewSupplierDialog onClose={() => setOpen(false)} onDone={() => { setOpen(false); load() }} />
        </Dialog>
      </div>

      <Card>
        <CardHeader><div className="relative max-w-md"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name, ID, GSTIN, phone..." className="pl-9" /></div></CardHeader>
        <CardContent className="p-0">
          {loading ? <p className="text-center py-8 text-muted-foreground">Loading...</p> : suppliers.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">No suppliers yet. Create one or upload an expense bill to auto-create.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Supplier ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>GSTIN</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>City</TableHead>
                  <TableHead>Bills</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {suppliers.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-mono text-xs">{s.supplierId}</TableCell>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell><Badge variant="outline" className={s.type === 'creditor' ? 'bg-amber-50 text-amber-700' : 'bg-blue-50 text-blue-700'}>{s.type}</Badge></TableCell>
                    <TableCell className="text-xs font-mono">{s.gstin || '—'}</TableCell>
                    <TableCell className="text-sm">{s.phone || '—'}</TableCell>
                    <TableCell className="text-sm">{s.city || '—'}</TableCell>
                    <TableCell>{s._count?.bills || 0}</TableCell>
                    <TableCell><Badge variant={s.isActive ? 'default' : 'secondary'}>{s.isActive ? 'Active' : 'Inactive'}</Badge></TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="ghost" onClick={() => setSelectedSupplier(s)}><FileText className="w-4 h-4" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedSupplier} onOpenChange={(o) => !o && setSelectedSupplier(null)}>
        {selectedSupplier && <SupplierDetailDialog supplier={selectedSupplier} onClose={() => setSelectedSupplier(null)} />}
      </Dialog>
    </div>
  )
}

function NewSupplierDialog({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const api = useApi()
  const [form, setForm] = useState({
    name: '', type: 'creditor', phone: '', email: '', contactPerson: '',
    gstin: '', pan: '', address: '', city: '', state: '', pincode: '',
    bankAccount: '', ifsc: '', branch: '', openingBalance: '0', openingBalanceType: 'Cr',
  })
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    if (!form.name) { toast.error('Name required'); return }
    setLoading(true)
    try {
      await api.post('/api/suppliers', form)
      toast.success('Supplier created — ledger auto-linked')
      onDone()
    } catch (e: any) { toast.error(e.message) } finally { setLoading(false) }
  }

  return (
    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
      <DialogHeader><DialogTitle>New Supplier</DialogTitle></DialogHeader>
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
        <div>
          <Label>Type</Label>
          <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="creditor">Creditor (we owe them)</SelectItem>
              <SelectItem value="debtor">Debtor (they owe us)</SelectItem>
              <SelectItem value="both">Both</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
        <div><Label>Email</Label><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
        <div><Label>GSTIN</Label><Input value={form.gstin} onChange={(e) => setForm({ ...form, gstin: e.target.value.toUpperCase() })} placeholder="22AAAAA0000A1Z5" /></div>
        <div><Label>PAN</Label><Input value={form.pan} onChange={(e) => setForm({ ...form, pan: e.target.value.toUpperCase() })} /></div>
        <div><Label>Contact Person</Label><Input value={form.contactPerson} onChange={(e) => setForm({ ...form, contactPerson: e.target.value })} /></div>
        <div><Label>City</Label><Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div>
        <div><Label>State</Label><Input value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} /></div>
        <div><Label>Pincode</Label><Input value={form.pincode} onChange={(e) => setForm({ ...form, pincode: e.target.value })} /></div>
        <div><Label>Bank Account</Label><Input value={form.bankAccount} onChange={(e) => setForm({ ...form, bankAccount: e.target.value })} /></div>
        <div><Label>IFSC</Label><Input value={form.ifsc} onChange={(e) => setForm({ ...form, ifsc: e.target.value.toUpperCase() })} /></div>
        <div><Label>Opening Balance</Label><Input type="number" value={form.openingBalance} onChange={(e) => setForm({ ...form, openingBalance: e.target.value })} /></div>
        <div>
          <Label>Dr / Cr</Label>
          <Select value={form.openingBalanceType} onValueChange={(v) => setForm({ ...form, openingBalanceType: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="Cr">Credit (Cr)</SelectItem><SelectItem value="Dr">Debit (Dr)</SelectItem></SelectContent>
          </Select>
        </div>
        <div className="col-span-2"><Label>Address</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button onClick={submit} disabled={loading} className="bg-brand-gradient text-white">{loading ? 'Creating...' : 'Create Supplier'}</Button>
      </DialogFooter>
    </DialogContent>
  )
}

function SupplierDetailDialog({ supplier, onClose }: { supplier: any; onClose: () => void }) {
  const api = useApi()
  const [detail, setDetail] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get(`/api/suppliers/${supplier.id}`).then((d) => { setDetail(d.supplier); setLoading(false) }).catch((e) => { toast.error(e.message); setLoading(false) })
  }, [supplier.id])

  return (
    <DialogContent className="max-w-2xl">
      <DialogHeader><DialogTitle>{supplier.name}</DialogTitle></DialogHeader>
      {loading ? <p>Loading...</p> : detail && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><span className="text-muted-foreground">Supplier ID:</span> <span className="font-mono">{detail.supplierId}</span></div>
            <div><span className="text-muted-foreground">Type:</span> <Badge variant="outline">{detail.type}</Badge></div>
            <div><span className="text-muted-foreground">GSTIN:</span> <span className="font-mono">{detail.gstin || '—'}</span></div>
            <div><span className="text-muted-foreground">PAN:</span> <span className="font-mono">{detail.pan || '—'}</span></div>
            <div><Phone className="w-3 h-3 inline mr-1" />{detail.phone || '—'}</div>
            <div><Mail className="w-3 h-3 inline mr-1" />{detail.email || '—'}</div>
            <div className="col-span-2"><Building2 className="w-3 h-3 inline mr-1" />{detail.address || '—'}{detail.city ? `, ${detail.city}` : ''}{detail.state ? `, ${detail.state}` : ''} {detail.pincode}</div>
            <div className="col-span-2"><span className="text-muted-foreground">Ledger Account:</span> <span className="font-mono text-xs">{detail.ledgerAccountId?.slice(-8) || '—'}</span></div>
          </div>
          {detail.bills && detail.bills.length > 0 && (
            <div>
              <p className="font-semibold text-sm mb-2">Recent Bills ({detail.bills.length})</p>
              <div className="max-h-60 overflow-y-auto border rounded">
                <Table>
                  <TableHeader><TableRow><TableHead>Bill ID</TableHead><TableHead>Date</TableHead><TableHead className="text-right">Amount</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {detail.bills.map((b: any) => (
                      <TableRow key={b.id}>
                        <TableCell className="font-mono text-xs">{b.billId}</TableCell>
                        <TableCell className="text-xs">{b.billDate}</TableCell>
                        <TableCell className="text-right">{new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(b.totalAmount)}</TableCell>
                        <TableCell><Badge variant="outline">{b.status}</Badge></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </div>
      )}
    </DialogContent>
  )
}
