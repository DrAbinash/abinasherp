'use client'

import { useState, useEffect, useRef } from 'react'
import { useApi } from '@/lib/auth-context'
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
import { formatCurrency, formatDate, todayIST } from '@/lib/format'
import { ScanLine, Upload, FileText, Check, X, FileImage, FileSpreadsheet, Loader2, Sparkles } from 'lucide-react'

const CATEGORIES = ['rent', 'salaries', 'utilities', 'supplies', 'maintenance', 'equipment', 'marketing', 'travel', 'miscellaneous']
const PAYMENT_MODES = ['credit', 'cash', 'bank-transfer', 'cheque', 'upi', 'card']

export function ExpenseBillsPage() {
  const api = useApi()
  const [bills, setBills] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [reviewing, setReviewing] = useState<any>(null)
  const [statusFilter, setStatusFilter] = useState('pending')

  const load = async () => {
    setLoading(true)
    try {
      const d = await api.get(`/api/expense-bills?status=${statusFilter === 'all' ? '' : statusFilter}`)
      setBills(d.bills || [])
    } catch (e: any) { toast.error(e.message) } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [statusFilter])

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Expense Bill Scanning</h1>
          <p className="text-muted-foreground text-sm mt-1">Upload bills — VLM auto-extracts supplier, GSTIN, line items, then posts to ledger</p>
        </div>
        <Button onClick={() => setUploadOpen(true)} className="bg-brand-gradient text-white">
          <ScanLine className="w-4 h-4 mr-2" /> Scan / Upload Bill
        </Button>
      </div>

      <div className="flex gap-2">
        {['pending', 'confirmed', 'posted', 'rejected', 'all'].map((s) => (
          <Button key={s} variant={statusFilter === s ? 'default' : 'outline'} size="sm" onClick={() => setStatusFilter(s)} className="capitalize">
            {s}
          </Button>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? <p className="text-center py-8 text-muted-foreground">Loading...</p> : bills.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">No {statusFilter !== 'all' ? statusFilter : ''} bills. Click &quot;Scan / Upload Bill&quot; to get started.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Bill ID</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>GSTIN</TableHead>
                  <TableHead>Bill #</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Confidence</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bills.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell className="font-mono text-xs">{b.billId}</TableCell>
                    <TableCell className="font-medium">{b.supplierName}{b.supplier && <span className="text-xs text-emerald-600 ml-1">✓ linked</span>}</TableCell>
                    <TableCell className="text-xs font-mono">{b.supplierGSTIN || '—'}</TableCell>
                    <TableCell className="text-xs">{b.billNumber || '—'}</TableCell>
                    <TableCell className="text-xs">{b.billDate}</TableCell>
                    <TableCell><Badge variant="outline" className="capitalize">{b.category}</Badge></TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(b.totalAmount)}</TableCell>
                    <TableCell><Badge variant={b.ocrConfidence >= 0.8 ? 'default' : 'secondary'}>{Math.round(b.ocrConfidence * 100)}%</Badge></TableCell>
                    <TableCell><Badge variant="outline" className={
                      b.status === 'posted' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                      b.status === 'pending' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                      b.status === 'rejected' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                      'bg-blue-50 text-blue-700 border-blue-200'
                    }>{b.status}</Badge></TableCell>
                    <TableCell className="text-right">
                      {b.status === 'pending' || b.status === 'confirmed' ? (
                        <Button size="sm" variant="outline" onClick={() => setReviewing(b)}>
                          <Check className="w-3 h-3 mr-1" /> Review & Post
                        </Button>
                      ) : (
                        <Button size="sm" variant="ghost" onClick={() => setReviewing(b)}><FileText className="w-4 h-4" /></Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <UploadBillDialog onClose={() => setUploadOpen(false)} onDone={(bill) => { setUploadOpen(false); setReviewing(bill) }} />
      </Dialog>

      <Dialog open={!!reviewing} onOpenChange={(o) => !o && setReviewing(null)}>
        {reviewing && <ReviewBillDialog bill={reviewing} onClose={() => setReviewing(null)} onDone={() => { setReviewing(null); load() }} />}
      </Dialog>
    </div>
  )
}

function UploadBillDialog({ onClose, onDone }: { onClose: () => void; onDone: (bill: any) => void }) {
  const api = useApi()
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [extracted, setExtracted] = useState<any>(null)
  const [dragOver, setDragOver] = useState(false)

  const handleFile = async (file: File) => {
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/expenses/scan-bill', {
        method: 'POST',
        headers: { Authorization: `Bearer ${api.get ? '' : ''}` }, // unused, will use below
        body: fd,
      })
      // The useApi hook doesn't support FormData; use direct fetch with token from localStorage
      const token = typeof window !== 'undefined' ? localStorage.getItem('care_erp_token') : ''
      const res2 = await fetch('/api/expenses/scan-bill', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token || ''}` },
        body: fd,
      })
      const data = await res2.json()
      if (!res2.ok) throw new Error(data.error || 'Upload failed')
      setExtracted({ ...data.extracted, ocrConfidence: data.ocrConfidence, filePath: data.filePath, fileType: data.fileType, fileName: data.fileName })
      toast.success('Bill scanned — review extracted data')
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setUploading(false)
    }
  }

  const saveAndReview = async () => {
    setUploading(true)
    try {
      const saved = await api.post('/api/expense-bills', {
        supplierName: extracted.supplierName,
        supplierGSTIN: extracted.supplierGSTIN,
        supplierPAN: extracted.supplierPAN,
        billNumber: extracted.billNumber,
        billDate: extracted.billDate,
        dueDate: extracted.dueDate,
        category: extracted.category,
        description: extracted.description,
        lineItems: extracted.lineItems,
        subtotal: extracted.subtotal,
        taxAmount: extracted.taxAmount,
        totalAmount: extracted.totalAmount,
        paymentMode: extracted.paymentMode,
        ocrConfidence: extracted.ocrConfidence,
        filePath: extracted.filePath,
        fileType: extracted.fileType,
        fileName: extracted.fileName,
      })
      toast.success('Bill saved — review and post to ledger')
      onDone(saved.bill)
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setUploading(false)
    }
  }

  return (
    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
      <DialogHeader><DialogTitle>Scan Expense Bill</DialogTitle></DialogHeader>
      {!extracted ? (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault(); setDragOver(false)
            const f = e.dataTransfer.files[0]
            if (f) handleFile(f)
          }}
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${dragOver ? 'border-emerald-500 bg-emerald-50' : 'border-border'}`}
        >
          {uploading ? (
            <div>
              <Loader2 className="w-12 h-12 mx-auto animate-spin text-emerald-600 mb-3" />
              <p className="text-sm text-muted-foreground">Scanning bill with VLM...</p>
              <p className="text-xs text-muted-foreground mt-1">Extracting supplier, GSTIN, line items, totals</p>
            </div>
          ) : (
            <>
              <Upload className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
              <p className="font-medium">Drop bill here or click to upload</p>
              <p className="text-xs text-muted-foreground mt-1">JPEG, PNG, WebP, or PDF · max 8MB</p>
              <Button onClick={() => fileRef.current?.click()} className="mt-4 bg-brand-gradient text-white">
                <ScanLine className="w-4 h-4 mr-1" /> Select File
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
              />
            </>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-50 border border-emerald-200">
            <Sparkles className="w-5 h-5 text-emerald-600" />
            <p className="text-sm text-emerald-800">VLM extracted the following data — please verify before posting</p>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <Field label="Supplier Name" value={extracted.supplierName} />
            <Field label="Supplier GSTIN" value={extracted.supplierGSTIN || '—'} mono />
            <Field label="Bill Number" value={extracted.billNumber || '—'} />
            <Field label="Bill Date" value={extracted.billDate || '—'} />
            <Field label="Category" value={extracted.category || '—'} />
            <Field label="Payment Mode" value={extracted.paymentMode || '—'} />
            <Field label="Subtotal" value={formatCurrency(extracted.subtotal || 0)} />
            <Field label="Tax (GST)" value={formatCurrency(extracted.taxAmount || 0)} />
            <Field label="Total" value={formatCurrency(extracted.totalAmount || 0)} bold />
            <Field label="OCR Confidence" value={`${Math.round((extracted.ocrConfidence || 0) * 100)}%`} />
          </div>
          {extracted.description && <Field label="Description" value={extracted.description} />}
          {extracted.lineItems && extracted.lineItems.length > 0 && (
            <div>
              <p className="text-sm font-semibold mb-2">Line Items ({extracted.lineItems.length})</p>
              <div className="max-h-40 overflow-y-auto border rounded">
                <Table>
                  <TableHeader><TableRow><TableHead>Name</TableHead><TableHead className="text-right">Qty</TableHead><TableHead className="text-right">Rate</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {extracted.lineItems.map((li: any, i: number) => (
                      <TableRow key={i}>
                        <TableCell>{li.name}</TableCell>
                        <TableCell className="text-right">{li.qty}</TableCell>
                        <TableCell className="text-right">{formatCurrency(li.rate)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(li.amount)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </div>
      )}
      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        {extracted && (
          <Button onClick={saveAndReview} disabled={uploading} className="bg-brand-gradient text-white">
            {uploading ? 'Saving...' : 'Save & Review for Posting'}
          </Button>
        )}
      </DialogFooter>
    </DialogContent>
  )
}

function Field({ label, value, mono, bold }: { label: string; value: string; mono?: boolean; bold?: boolean }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-sm ${bold ? 'font-bold' : 'font-medium'} ${mono ? 'font-mono' : ''}`}>{value}</p>
    </div>
  )
}

function ReviewBillDialog({ bill, onClose, onDone }: { bill: any; onClose: () => void; onDone: () => void }) {
  const api = useApi()
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [form, setForm] = useState({
    supplierName: bill.supplierName,
    supplierGSTIN: bill.supplierGSTIN || '',
    billNumber: bill.billNumber || '',
    billDate: bill.billDate || todayIST(),
    category: bill.category || 'miscellaneous',
    description: bill.description || '',
    subtotal: String(bill.subtotal || 0),
    taxAmount: String(bill.taxAmount || 0),
    totalAmount: String(bill.totalAmount || 0),
    supplierId: bill.supplierId || '',
    paymentMode: 'credit',
    notes: '',
  })
  const [posting, setPosting] = useState(false)

  useEffect(() => {
    api.get('/api/suppliers?q=').then((d) => setSuppliers(d.suppliers || [])).catch(() => {})
  }, [])

  const save = async () => {
    setPosting(true)
    try {
      await api.patch(`/api/expense-bills/${bill.id}/post`, form)
      // Actually PATCH to update first
    } catch (e: any) {
      // ignore - we'll call post next
    }
    try {
      // Update fields first
      await api.patch(`/api/expense-bills/${bill.id}/post`, form).catch(() => {})
      // Actually call POST to post to ledger
      const res = await fetch(`/api/expense-bills/${bill.id}/post`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('care_erp_token') || ''}` },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to post')
      toast.success('Posted to ledger — voucher created')
      onDone()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setPosting(false)
    }
  }

  return (
    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
      <DialogHeader><DialogTitle>Review & Post Bill — {bill.billId}</DialogTitle></DialogHeader>
      <div className="space-y-3">
        {bill.status === 'posted' && (
          <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-sm text-emerald-800">
            ✓ This bill is already posted to ledger. Voucher: {bill.voucherId?.slice(-8) || '—'}
          </div>
        )}
        <div>
          <Label>Link to existing supplier (optional)</Label>
          <Select value={form.supplierId} onValueChange={(v) => {
            const s = suppliers.find((x) => x.id === v)
            setForm({ ...form, supplierId: v, supplierName: s?.name || form.supplierName, supplierGSTIN: s?.gstin || form.supplierGSTIN })
          }}>
            <SelectTrigger><SelectValue placeholder="Auto-create from supplier name + GSTIN" /></SelectTrigger>
            <SelectContent>
              {suppliers.map((s) => <SelectItem key={s.id} value={s.id}>{s.name} {s.gstin ? `(${s.gstin})` : ''}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Supplier Name *</Label><Input value={form.supplierName} onChange={(e) => setForm({ ...form, supplierName: e.target.value })} /></div>
          <div><Label>Supplier GSTIN</Label><Input value={form.supplierGSTIN} onChange={(e) => setForm({ ...form, supplierGSTIN: e.target.value.toUpperCase() })} /></div>
          <div><Label>Bill Number</Label><Input value={form.billNumber} onChange={(e) => setForm({ ...form, billNumber: e.target.value })} /></div>
          <div><Label>Bill Date</Label><Input type="date" value={form.billDate} onChange={(e) => setForm({ ...form, billDate: e.target.value })} /></div>
          <div>
            <Label>Category</Label>
            <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Payment Mode</Label>
            <Select value={form.paymentMode} onValueChange={(v) => setForm({ ...form, paymentMode: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="credit">Credit (to Sundry Creditor)</SelectItem>
                <SelectItem value="cash">Cash (paid immediately)</SelectItem>
                <SelectItem value="bank-transfer">Bank Transfer</SelectItem>
                <SelectItem value="cheque">Cheque</SelectItem>
                <SelectItem value="upi">UPI</SelectItem>
                <SelectItem value="card">Card</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label>Subtotal</Label><Input type="number" value={form.subtotal} onChange={(e) => setForm({ ...form, subtotal: e.target.value })} /></div>
          <div><Label>Tax (GST)</Label><Input type="number" value={form.taxAmount} onChange={(e) => setForm({ ...form, taxAmount: e.target.value })} /></div>
          <div><Label>Total Amount</Label><Input type="number" value={form.totalAmount} onChange={(e) => setForm({ ...form, totalAmount: e.target.value })} /></div>
        </div>
        <div><Label>Description</Label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
        <div><Label>Notes</Label><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Optional notes for this posting" /></div>
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>Close</Button>
        {bill.status !== 'posted' && (
          <Button onClick={save} disabled={posting} className="bg-brand-gradient text-white">
            {posting ? 'Posting...' : 'Post to Ledger'}
          </Button>
        )}
      </DialogFooter>
    </DialogContent>
  )
}
