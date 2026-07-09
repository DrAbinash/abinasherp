'use client'

import { useState, useEffect, useRef } from 'react'
import { apiPath } from '@/lib/base-path'
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
import { formatCurrency, formatDateTime, formatDate } from '@/lib/format'
import { Landmark, Plus, RefreshCw, AlertTriangle, Check, X, Upload } from 'lucide-react'

export function BankingPage() {
  const [tab, setTab] = useState('accounts')
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Banking</h1>
        <p className="text-muted-foreground text-sm mt-1">Bank accounts, transactions, statement upload (CSV/PDF), reconciliation, refunds, fraud alerts</p>
      </div>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="accounts">Bank Accounts</TabsTrigger>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
          <TabsTrigger value="statements">Upload Statement</TabsTrigger>
          <TabsTrigger value="reconciliation">Reconciliation</TabsTrigger>
          <TabsTrigger value="refunds">Refunds</TabsTrigger>
          <TabsTrigger value="fraud">Fraud Alerts</TabsTrigger>
        </TabsList>
        <TabsContent value="accounts"><AccountsTab /></TabsContent>
        <TabsContent value="transactions"><TransactionsTab /></TabsContent>
        <TabsContent value="statements"><StatementsTab /></TabsContent>
        <TabsContent value="reconciliation"><ReconciliationTab /></TabsContent>
        <TabsContent value="refunds"><RefundsTab /></TabsContent>
        <TabsContent value="fraud"><FraudTab /></TabsContent>
      </Tabs>
    </div>
  )
}

function AccountsTab() {
  const api = useApi()
  const [accounts, setAccounts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const d = await api.get('/api/banking/accounts')
      setAccounts(d.accounts || [])
    } catch (e: any) { toast.error(e.message) } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Bank Accounts</CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button className="bg-brand-gradient text-white"><Plus className="w-4 h-4 mr-1" /> New Account</Button></DialogTrigger>
          <NewAccountDialog onClose={() => setOpen(false)} onDone={() => { setOpen(false); load() }} />
        </Dialog>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? <p className="text-center py-8 text-muted-foreground">Loading...</p> : accounts.length === 0 ? (
          <p className="text-center py-8 text-muted-foreground">No bank accounts yet</p>
        ) : (
          <div className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3">
            {accounts.map((a) => (
              <Card key={a.id} className="overflow-hidden border-0 shadow-md">
                <div className="bg-brand-gradient-blue p-4 text-white">
                  <div className="flex items-start justify-between">
                    <Landmark className="w-7 h-7" />
                    <Badge variant="outline" className="bg-white/20 text-white border-white/30 capitalize">{a.provider}</Badge>
                  </div>
                  <p className="text-lg font-bold mt-3">{a.bankName}</p>
                  <p className="text-white/80 text-sm font-mono">{a.maskedAccountNumber || '—'}</p>
                </div>
                <CardContent className="p-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Current Balance</span>
                    <span className="font-bold text-lg">{formatCurrency(a.currentBalance)}</span>
                  </div>
                  <div className="flex justify-between text-xs mt-1">
                    <span className="text-muted-foreground">IFSC: {a.ifsc || '—'}</span>
                    <Badge variant={a.status === 'active' ? 'default' : 'secondary'} className="capitalize">{a.status}</Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function NewAccountDialog({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const api = useApi()
  const [provider, setProvider] = useState('generic')
  const [bankName, setBankName] = useState('')
  const [maskedAccountNumber, setMaskedAccountNumber] = useState('')
  const [ifsc, setIfsc] = useState('')
  const [branch, setBranch] = useState('')
  const [currentBalance, setCurrentBalance] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    if (!bankName) { toast.error('Bank name required'); return }
    setLoading(true)
    try {
      await api.post('/api/banking/accounts', { provider, bankName, maskedAccountNumber, ifsc, branch, currentBalance })
      toast.success('Bank account created')
      onDone()
    } catch (e: any) { toast.error(e.message) } finally { setLoading(false) }
  }

  return (
    <DialogContent>
      <DialogHeader><DialogTitle>New Bank Account</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Provider</Label>
            <Select value={provider} onValueChange={setProvider}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {['generic', 'mock', 'icici', 'hdfc', 'axis', 'sbi', 'kotak', 'bharatpe', 'phonepe', 'cashfree'].map((p) => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div><Label>Bank Name</Label><Input value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="e.g. HDFC Current" /></div>
        </div>
        <div><Label>Account Number (masked)</Label><Input value={maskedAccountNumber} onChange={(e) => setMaskedAccountNumber(e.target.value)} placeholder="XXXXXX1234" /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>IFSC</Label><Input value={ifsc} onChange={(e) => setIfsc(e.target.value)} /></div>
          <div><Label>Branch</Label><Input value={branch} onChange={(e) => setBranch(e.target.value)} /></div>
        </div>
        <div><Label>Opening Balance</Label><Input type="number" value={currentBalance} onChange={(e) => setCurrentBalance(e.target.value)} /></div>
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button onClick={submit} disabled={loading} className="bg-brand-gradient text-white">{loading ? 'Creating...' : 'Create'}</Button>
      </DialogFooter>
    </DialogContent>
  )
}

function TransactionsTab() {
  const api = useApi()
  const [txns, setTxns] = useState<any[]>([])
  const [accounts, setAccounts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [accountId, setAccountId] = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      const acct = accountId === 'all' ? '' : accountId
      if (acct) params.set('accountId', acct)
      const d = await api.get(`/api/banking/transactions?${params}`)
      setTxns(d.transactions || [])
      setAccounts(d.accounts || [])
    } catch (e: any) { toast.error(e.message) } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [accountId])

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between flex-wrap gap-2">
        <CardTitle>Transactions</CardTitle>
        <div className="flex gap-2">
          <Select value={accountId} onValueChange={setAccountId}>
            <SelectTrigger className="w-[200px]"><SelectValue placeholder="All accounts" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All accounts</SelectItem>
              {accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.bankName}</SelectItem>)}
            </SelectContent>
          </Select>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button className="bg-brand-gradient text-white"><Plus className="w-4 h-4 mr-1" /> New Transaction</Button></DialogTrigger>
            <NewTxDialog accounts={accounts} onClose={() => setOpen(false)} onDone={() => { setOpen(false); load() }} />
          </Dialog>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? <p className="text-center py-8 text-muted-foreground">Loading...</p> : txns.length === 0 ? (
          <p className="text-center py-8 text-muted-foreground">No transactions</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Bank</TableHead>
                <TableHead>UTR</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Reconciliation</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {txns.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="text-xs">{formatDateTime(t.transactionDate)}</TableCell>
                  <TableCell className="text-sm">{t.description || '—'}</TableCell>
                  <TableCell className="text-xs">{t.bankAccount?.bankName}</TableCell>
                  <TableCell className="text-xs font-mono">{t.utr || '—'}</TableCell>
                  <TableCell className={`text-right font-medium ${t.type === 'credit' ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {t.type === 'credit' ? '+' : '−'}{formatCurrency(t.amount)}
                  </TableCell>
                  <TableCell><Badge variant="outline" className={t.type === 'credit' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}>{t.type}</Badge></TableCell>
                  <TableCell>
                    <Badge variant="outline" className={
                      t.reconciliationStatus === 'matched' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                      t.reconciliationStatus === 'unreconciled' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-slate-50'
                    }>{t.reconciliationStatus}</Badge>
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

function NewTxDialog({ accounts, onClose, onDone }: { accounts: any[]; onClose: () => void; onDone: () => void }) {
  const api = useApi()
  const [bankAccountId, setBankAccountId] = useState('')
  const [transactionDate, setTransactionDate] = useState('')
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [type, setType] = useState('credit')
  const [utr, setUtr] = useState('')
  const [referenceNumber, setReferenceNumber] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    if (!bankAccountId || !amount) { toast.error('Bank account and amount required'); return }
    setLoading(true)
    try {
      await api.post('/api/banking/transactions', { bankAccountId, transactionDate, description, amount, type, utr, referenceNumber })
      toast.success('Transaction recorded')
      onDone()
    } catch (e: any) { toast.error(e.message) } finally { setLoading(false) }
  }

  return (
    <DialogContent>
      <DialogHeader><DialogTitle>New Bank Transaction</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div>
          <Label>Bank Account</Label>
          <Select value={bankAccountId} onValueChange={setBankAccountId}>
            <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
            <SelectContent>{accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.bankName}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Date</Label><Input type="datetime-local" value={transactionDate} onChange={(e) => setTransactionDate(e.target.value)} /></div>
          <div>
            <Label>Type</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="credit">Credit (In)</SelectItem><SelectItem value="debit">Debit (Out)</SelectItem></SelectContent>
            </Select>
          </div>
        </div>
        <div><Label>Amount</Label><Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
        <div><Label>Description</Label><Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. UPI transfer from patient" /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>UTR (optional)</Label><Input value={utr} onChange={(e) => setUtr(e.target.value)} /></div>
          <div><Label>Reference #</Label><Input value={referenceNumber} onChange={(e) => setReferenceNumber(e.target.value)} /></div>
        </div>
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button onClick={submit} disabled={loading} className="bg-brand-gradient text-white">{loading ? 'Recording...' : 'Record'}</Button>
      </DialogFooter>
    </DialogContent>
  )
}

function ReconciliationTab() {
  const api = useApi()
  const [data, setData] = useState<{ unreconciled: any[]; matched: any[] } | null>(null)
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try {
      const d = await api.get('/api/banking/reconciliation')
      setData(d)
    } catch (e: any) { toast.error(e.message) } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const autoReconcile = async () => {
    try {
      const d = await api.put('/api/banking/reconciliation', {})
      const matched = d.results.filter((r: any) => r.matched).length
      toast.success(`Auto-reconciled ${matched} transactions`)
      load()
    } catch (e: any) { toast.error(e.message) }
  }

  if (loading) return <Card><CardContent className="p-8 text-center text-muted-foreground">Loading...</CardContent></Card>

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Unreconciled Transactions ({data?.unreconciled.length || 0})</CardTitle>
          <Button onClick={autoReconcile} className="bg-brand-gradient text-white">
            <RefreshCw className="w-4 h-4 mr-1" /> Auto-Reconcile
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {data?.unreconciled.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">All transactions reconciled 🎉</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Bank</TableHead>
                  <TableHead>UTR</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.unreconciled.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="text-xs">{formatDateTime(t.transactionDate)}</TableCell>
                    <TableCell>{t.description || '—'}</TableCell>
                    <TableCell className="text-xs">{t.bankAccount?.bankName}</TableCell>
                    <TableCell className="text-xs font-mono">{t.utr || '—'}</TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(t.amount)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Recently Reconciled</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Bank Txn</TableHead>
                <TableHead>Strategy</TableHead>
                <TableHead>Resolved By</TableHead>
                <TableHead>Confidence</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.matched.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="text-xs">{formatDateTime(r.createdAt)}</TableCell>
                  <TableCell className="text-xs">{r.bankTransaction?.description}</TableCell>
                  <TableCell><Badge variant="outline">{r.matchStrategy}</Badge></TableCell>
                  <TableCell className="text-xs">{r.resolvedByName}</TableCell>
                  <TableCell><Badge variant={r.confidenceScore >= 80 ? 'default' : 'secondary'}>{r.confidenceScore}%</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

function RefundsTab() {
  const api = useApi()
  const [refunds, setRefunds] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const d = await api.get('/api/banking/refunds')
      setRefunds(d.refunds || [])
    } catch (e: any) { toast.error(e.message) } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Refund Requests</CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button className="bg-brand-gradient text-white"><Plus className="w-4 h-4 mr-1" /> New Refund</Button></DialogTrigger>
          <NewRefundDialog onClose={() => setOpen(false)} onDone={() => { setOpen(false); load() }} />
        </Dialog>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? <p className="text-center py-8 text-muted-foreground">Loading...</p> : refunds.length === 0 ? (
          <p className="text-center py-8 text-muted-foreground">No refund requests</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Bill</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Requested By</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {refunds.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="text-xs">{formatDate(r.createdAt)}</TableCell>
                  <TableCell className="text-xs">{r.billId ? r.billId.slice(-8) : '—'}</TableCell>
                  <TableCell className="text-right font-medium">{formatCurrency(r.amount)}</TableCell>
                  <TableCell className="text-sm">{r.reason || '—'}</TableCell>
                  <TableCell className="text-sm">{r.requestedByName}</TableCell>
                  <TableCell><Badge variant="outline" className={
                    r.status === 'completed' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                    r.status === 'approved' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                    r.status === 'rejected' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                    'bg-amber-50 text-amber-700 border-amber-200'
                  }>{r.status}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}

function NewRefundDialog({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const api = useApi()
  const [billId, setBillId] = useState('')
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    if (!amount) { toast.error('Amount required'); return }
    setLoading(true)
    try {
      await api.post('/api/banking/refunds', { billId, amount, reason })
      toast.success('Refund requested')
      onDone()
    } catch (e: any) { toast.error(e.message) } finally { setLoading(false) }
  }

  return (
    <DialogContent>
      <DialogHeader><DialogTitle>New Refund Request</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div><Label>Bill ID (optional)</Label><Input value={billId} onChange={(e) => setBillId(e.target.value)} /></div>
        <div><Label>Amount</Label><Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
        <div><Label>Reason</Label><Input value={reason} onChange={(e) => setReason(e.target.value)} /></div>
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button onClick={submit} disabled={loading} className="bg-brand-gradient text-white">{loading ? 'Submitting...' : 'Submit'}</Button>
      </DialogFooter>
    </DialogContent>
  )
}

function FraudTab() {
  const api = useApi()
  const [alerts, setAlerts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/api/banking/fraud').then((d) => { setAlerts(d.alerts || []); setLoading(false) }).catch(() => setLoading(false))
  }, [])

  return (
    <Card>
      <CardHeader><CardTitle>Fraud Alerts</CardTitle></CardHeader>
      <CardContent className="p-0">
        {loading ? <p className="text-center py-8 text-muted-foreground">Loading...</p> : alerts.length === 0 ? (
          <p className="text-center py-8 text-muted-foreground">No fraud alerts 🎉</p>
        ) : (
          <div className="space-y-2 p-4">
            {alerts.map((a) => (
              <div key={a.id} className={`p-4 rounded-lg border-l-4 ${
                a.severity === 'critical' ? 'bg-rose-50 border-rose-500' :
                a.severity === 'high' ? 'bg-amber-50 border-amber-500' :
                a.severity === 'medium' ? 'bg-yellow-50 border-yellow-500' :
                'bg-blue-50 border-blue-500'
              }`}>
                <div className="flex items-start gap-3">
                  <AlertTriangle className={`w-5 h-5 flex-shrink-0 ${
                    a.severity === 'critical' ? 'text-rose-600' :
                    a.severity === 'high' ? 'text-amber-600' : 'text-yellow-600'
                  }`} />
                  <div className="flex-1">
                    <p className="font-semibold">{a.title}</p>
                    {a.description && <p className="text-sm text-muted-foreground mt-1">{a.description}</p>}
                    <div className="flex gap-2 mt-2">
                      <Badge variant="outline" className="capitalize">{a.alertType}</Badge>
                      <Badge variant="outline" className="capitalize">{a.severity}</Badge>
                      <Badge variant="outline" className="capitalize">{a.status}</Badge>
                      {a.affectedAmount > 0 && <Badge variant="outline">{formatCurrency(a.affectedAmount)}</Badge>}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function StatementsTab() {
  const api = useApi()
  const [accounts, setAccounts] = useState<any[]>([])
  const [bankAccountId, setBankAccountId] = useState('')
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview] = useState<any>(null)
  const [importing, setImporting] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const [runReconciliation, setRunReconciliation] = useState(true)

  useEffect(() => {
    api.get('/api/banking/accounts').then((d) => {
      setAccounts(d.accounts || [])
      if (d.accounts?.[0]) setBankAccountId(d.accounts[0].id)
    }).catch(() => {})
  }, [])

  const handleFile = async (file: File) => {
    if (!bankAccountId) { toast.error('Select a bank account first'); return }
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('bankAccountId', bankAccountId)
      const token = localStorage.getItem('care_erp_token') || ''
      const res = await fetch(apiPath('/api/banking/statements/upload'), {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Upload failed')
      setPreview(data)
      toast.success(`Extracted ${data.transactionCount} transactions`)
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setUploading(false)
    }
  }

  const confirmImport = async () => {
    setImporting(true)
    try {
      const token = localStorage.getItem('care_erp_token') || ''
      const res = await fetch(apiPath('/api/banking/statements/upload'), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          bankAccountId,
          transactions: preview.transactions,
          runReconciliation,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Import failed')
      toast.success(`Imported ${data.inserted} transactions (${data.skipped} duplicates skipped)`)
      if (data.reconciliation) {
        toast.info(`Auto-reconciled ${data.reconciliation.matched} of ${data.reconciliation.matched + data.reconciliation.unmatched} transactions`)
      }
      setPreview(null)
      if (fileRef.current) fileRef.current.value = ''
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Upload Bank Statement</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <Label>Bank Account</Label>
              <Select value={bankAccountId} onValueChange={setBankAccountId}>
                <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
                <SelectContent>
                  {accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.bankName} ({a.maskedAccountNumber})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={() => fileRef.current?.click()} className="bg-brand-gradient text-white">
              <Upload className="w-4 h-4 mr-1" /> {uploading ? 'Parsing...' : 'Select File'}
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv,application/pdf"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
            />
          </div>
          <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-sm text-blue-800">
            <p className="font-semibold mb-1">Supported formats:</p>
            <ul className="list-disc list-inside text-xs space-y-1">
              <li><strong>CSV</strong> — Most bank statement downloads (HDFC, ICICI, SBI, Axis, etc.)</li>
              <li><strong>PDF</strong> — Text-based PDFs (extracted via LLM); scanned PDFs not supported</li>
            </ul>
            <p className="text-xs mt-2">Auto-detects column headers (Date, Narration, Debit, Credit, Balance, UTR/Ref)</p>
          </div>
        </CardContent>
      </Card>

      {preview && (
        <Card>
          <CardHeader className="flex-row items-center justify-between flex-wrap gap-2">
            <div>
              <CardTitle>Preview — {preview.transactionCount} transactions</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Credits: {formatCurrency(preview.summary.totalCredits)} · Debits: {formatCurrency(preview.summary.totalDebits)} · Net: {formatCurrency(preview.summary.netFlow)}
              </p>
            </div>
            <div className="flex gap-2 items-end">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={runReconciliation} onChange={(e) => setRunReconciliation(e.target.checked)} />
                Run auto-reconciliation
              </label>
              <Button variant="ghost" size="sm" onClick={() => { setPreview(null); if (fileRef.current) fileRef.current.value = '' }}>Cancel</Button>
              <Button onClick={confirmImport} disabled={importing} className="bg-brand-gradient text-white">
                {importing ? 'Importing...' : `Import ${preview.transactionCount} transactions`}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-[500px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>UTR/Ref</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Type</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.transactions.map((t: any, i: number) => (
                    <TableRow key={i}>
                      <TableCell className="text-xs">{t.transactionDate}</TableCell>
                      <TableCell className="text-sm">{t.description}</TableCell>
                      <TableCell className="text-xs font-mono">{t.utr || t.referenceNumber || '—'}</TableCell>
                      <TableCell className={`text-right font-medium ${t.type === 'credit' ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {t.type === 'credit' ? '+' : '−'}{formatCurrency(t.amount)}
                      </TableCell>
                      <TableCell><Badge variant="outline" className={t.type === 'credit' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}>{t.type}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
