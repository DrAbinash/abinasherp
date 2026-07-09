'use client'

import { useState, useEffect } from 'react'
import { useApi } from '@/lib/auth-context'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Textarea as TextareaInput } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { formatCurrency, formatDateTime } from '@/lib/format'
import { CheckCircle2, XCircle } from 'lucide-react'

export function DiscountApprovalsPage() {
  const api = useApi()
  const [approvals, setApprovals] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('pending')
  const [review, setReview] = useState<{ approval: any; decision: 'approved' | 'rejected' } | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const d = await api.get(`/api/discount-approvals?status=${statusFilter}`)
      setApprovals(d.approvals || [])
    } catch (e: any) { toast.error(e.message) } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [statusFilter])

  const counts = {
    pending: approvals.filter((a) => a.status === 'pending').length,
    approved: approvals.filter((a) => a.status === 'approved').length,
    rejected: approvals.filter((a) => a.status === 'rejected').length,
  }
  const pendingValue = approvals.filter((a) => a.status === 'pending').reduce((s, a) => s + (a.requestedDiscount || 0), 0)

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Discount Approvals</h1>
        <p className="text-muted-foreground text-sm mt-1">Workflow for discounts exceeding cashier limits — review & approve</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-amber-200 bg-amber-50"><CardContent className="p-3"><p className="text-xs text-amber-700">Pending</p><p className="text-xl font-bold text-amber-700">{counts.pending}</p></CardContent></Card>
        <Card className="border-emerald-200 bg-emerald-50"><CardContent className="p-3"><p className="text-xs text-emerald-700">Approved (visible)</p><p className="text-xl font-bold text-emerald-700">{counts.approved}</p></CardContent></Card>
        <Card className="border-rose-200 bg-rose-50"><CardContent className="p-3"><p className="text-xs text-rose-700">Rejected (visible)</p><p className="text-xl font-bold text-rose-700">{counts.rejected}</p></CardContent></Card>
        <Card className="border-border/60"><CardContent className="p-3"><p className="text-xs text-muted-foreground">Pending Value</p><p className="text-xl font-bold">{formatCurrency(pendingValue)}</p></CardContent></Card>
      </div>

      <div className="flex gap-2 flex-wrap">
        {['pending', 'approved', 'rejected', ''].map((s) => (
          <Button key={s || 'all'} variant={statusFilter === s ? 'default' : 'outline'} size="sm" onClick={() => setStatusFilter(s)} className="capitalize">
            {s || 'All'}
          </Button>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? <p className="text-center py-8 text-muted-foreground">Loading...</p> : approvals.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">No {statusFilter || ''} approval requests.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Bill #</TableHead>
                    <TableHead>Patient</TableHead>
                    <TableHead className="text-right">Discount ₹</TableHead>
                    <TableHead className="text-right">%</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Requested By</TableHead>
                    <TableHead>Requested At</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {approvals.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="font-mono text-xs">{a.billNumber || '—'}</TableCell>
                      <TableCell className="font-medium">{a.patientName || '—'}</TableCell>
                      <TableCell className="text-right font-semibold text-amber-700">{formatCurrency(a.requestedDiscount)}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">{a.requestedDiscountPercent?.toFixed(1)}%</Badge>
                      </TableCell>
                      <TableCell className="text-sm max-w-xs truncate" title={a.reason}>{a.reason || '—'}</TableCell>
                      <TableCell className="text-sm">{a.requestedByName || '—'}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{formatDateTime(a.requestedAt || a.createdAt)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={
                          a.status === 'pending' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                          a.status === 'approved' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                          a.status === 'rejected' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                          'bg-slate-50 text-slate-700 border-slate-200'
                        }>{a.status.replace('_', ' ')}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {a.status === 'pending' ? (
                          <div className="flex gap-1 justify-end">
                            <Button size="sm" variant="outline" className="border-emerald-300 text-emerald-700 hover:bg-emerald-50" onClick={() => setReview({ approval: a, decision: 'approved' })}>
                              <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Approve
                            </Button>
                            <Button size="sm" variant="outline" className="border-rose-300 text-rose-700 hover:bg-rose-50" onClick={() => setReview({ approval: a, decision: 'rejected' })}>
                              <XCircle className="w-3.5 h-3.5 mr-1" /> Reject
                            </Button>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            {a.reviewedByName ? `by ${a.reviewedByName}` : ''}
                            {a.reviewedAt ? ` · ${formatDateTime(a.reviewedAt)}` : ''}
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!review} onOpenChange={(o) => !o && setReview(null)}>
        {review && <ReviewDialog review={review} onClose={() => setReview(null)} onDone={() => { setReview(null); load() }} />}
      </Dialog>
    </div>
  )
}

function ReviewDialog({ review, onClose, onDone }: { review: { approval: any; decision: 'approved' | 'rejected' }; onClose: () => void; onDone: () => void }) {
  const api = useApi()
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const { approval, decision } = review

  const submit = async () => {
    setLoading(true)
    try {
      await api.post(`/api/discount-approvals/${approval.id}/review`, { status: decision, reviewNotes: notes })
      toast.success(`Discount ${decision}`)
      onDone()
    } catch (e: any) { toast.error(e.message) } finally { setLoading(false) }
  }

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          {decision === 'approved' ? <CheckCircle2 className="w-5 h-5 text-emerald-600" /> : <XCircle className="w-5 h-5 text-rose-600" />}
          {decision === 'approved' ? 'Approve' : 'Reject'} Discount
        </DialogTitle>
      </DialogHeader>
      <div className="space-y-3">
        <div className="bg-muted/30 rounded-lg p-3 space-y-1.5 text-sm">
          <div className="flex justify-between"><span className="text-muted-foreground">Bill #</span><span className="font-mono">{approval.billNumber || '—'}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Patient</span><span className="font-medium">{approval.patientName || '—'}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Requested Discount</span><span className="font-semibold text-amber-700">{formatCurrency(approval.requestedDiscount)}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Discount %</span><span className="font-semibold">{approval.requestedDiscountPercent?.toFixed(1)}%</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Requested By</span><span>{approval.requestedByName || '—'}</span></div>
          <div className="pt-2 border-t">
            <span className="text-muted-foreground text-xs">Reason:</span>
            <p className="mt-0.5">{approval.reason || '—'}</p>
          </div>
        </div>
        <div>
          <Label>Review Notes (optional)</Label>
          <TextareaInput value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={decision === 'approved' ? 'Approval comments...' : 'Reason for rejection...'} rows={3} />
        </div>
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button
          onClick={submit}
          disabled={loading}
          className={decision === 'approved' ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'bg-rose-600 text-white hover:bg-rose-700'}
        >
          {loading ? 'Processing...' : decision === 'approved' ? 'Confirm Approval' : 'Confirm Rejection'}
        </Button>
      </DialogFooter>
    </DialogContent>
  )
}
