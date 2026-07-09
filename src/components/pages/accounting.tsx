'use client'

import { useState, useEffect } from 'react'
import { apiPath } from '@/lib/base-path'
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
import { formatCurrency, formatDate, todayIST } from '@/lib/format'
import { BookOpen, Plus, Wallet, Landmark, TrendingUp, FileSpreadsheet, Download } from 'lucide-react'

const ACCOUNT_TYPES = ['cash', 'bank', 'income', 'expense', 'liability', 'asset']
const TALLY_GROUPS = [
  'Cash-in-Hand', 'Bank Accounts', 'Bank OD Accounts', 'Sundry Debtors', 'Sundry Creditors',
  'Duties & Taxes', 'Capital Account', 'Reserves & Surplus',
  'Direct Income', 'Indirect Income', 'Direct Expenses', 'Indirect Expenses',
  'Current Assets', 'Fixed Assets', 'Investments', 'Loans & Advances (Asset)',
  'Current Liabilities', 'Loans (Liability)', 'Unsecured Loans', 'Misc. Expenses (Asset)',
]
const VOUCHER_TYPES = [
  { value: 'receipt', label: 'Receipt (RV)' },
  { value: 'payment', label: 'Payment (PV)' },
  { value: 'contra', label: 'Contra / Bank Transfer (BT)' },
  { value: 'journal', label: 'Journal (JV)' },
  { value: 'sales', label: 'Sales (SV)' },
  { value: 'purchase', label: 'Purchase (PUR)' },
]

export function AccountingPage() {
  const [tab, setTab] = useState('vouchers')
  const { token } = useAuth()
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Accounting</h1>
          <p className="text-muted-foreground text-sm mt-1">Tally-compatible chart of accounts, vouchers, ledgers, P&amp;L and Balance Sheet</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open(apiPath(`/api/accounting/export/tally-erp9`), '_blank')}
            className="border-blue-300 text-blue-700 hover:bg-blue-50"
          >
            <Download className="w-4 h-4 mr-1" /> Tally ERP 9
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              // Fetch with auth header (browsers block custom headers on window.open)
              fetch(apiPath('/api/accounting/export/tally-prime'), { headers: { Authorization: `Bearer ${token}` } })
                .then((r) => r.blob())
                .then((b) => {
                  const url = URL.createObjectURL(b)
                  const a = document.createElement('a')
                  a.href = url
                  a.download = `care-erp-tally-prime.xml`
                  a.click()
                  URL.revokeObjectURL(url)
                })
            }}
            className="border-violet-300 text-violet-700 hover:bg-violet-50"
          >
            <Download className="w-4 h-4 mr-1" /> Tally Prime
          </Button>
        </div>
      </div>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex-wrap">
          <TabsTrigger value="vouchers">Vouchers</TabsTrigger>
          <TabsTrigger value="accounts">Accounts</TabsTrigger>
          <TabsTrigger value="ledger">Ledger</TabsTrigger>
          <TabsTrigger value="trial-balance">Trial Balance</TabsTrigger>
          <TabsTrigger value="profit-loss">P & L</TabsTrigger>
          <TabsTrigger value="balance-sheet">Balance Sheet</TabsTrigger>
        </TabsList>
        <TabsContent value="vouchers"><VouchersTab /></TabsContent>
        <TabsContent value="accounts"><AccountsTab /></TabsContent>
        <TabsContent value="ledger"><LedgerTab /></TabsContent>
        <TabsContent value="trial-balance"><TrialBalanceTab /></TabsContent>
        <TabsContent value="profit-loss"><ProfitLossTab /></TabsContent>
        <TabsContent value="balance-sheet"><BalanceSheetTab /></TabsContent>
      </Tabs>
    </div>
  )
}

function VouchersTab() {
  const api = useApi()
  const [vouchers, setVouchers] = useState<any[]>([])
  const [accounts, setAccounts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [typeFilter, setTypeFilter] = useState('')
  const [open, setOpen] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      const type = typeFilter === 'all' ? '' : typeFilter
      if (type) params.set('type', type)
      const [vData, aData] = await Promise.all([
        api.get(`/api/accounting/vouchers?${params}`),
        api.get('/api/accounting/accounts'),
      ])
      setVouchers(vData.vouchers || [])
      setAccounts(aData.accounts || [])
    } catch (e: any) { toast.error(e.message) } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [typeFilter])

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Vouchers</CardTitle>
        <div className="flex gap-2">
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[150px]"><SelectValue placeholder="All types" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {VOUCHER_TYPES.map((v) => <SelectItem key={v.value} value={v.value}>{v.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="bg-brand-gradient text-white"><Plus className="w-4 h-4 mr-1" /> New Voucher</Button>
            </DialogTrigger>
            <NewVoucherDialog accounts={accounts} onClose={() => setOpen(false)} onDone={() => { setOpen(false); load() }} />
          </Dialog>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? <p className="text-center py-8 text-muted-foreground">Loading...</p> : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Voucher #</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Particular</TableHead>
                <TableHead>Debit (Dr)</TableHead>
                <TableHead>Credit (Cr)</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vouchers.map((v) => (
                <TableRow key={v.id}>
                  <TableCell className="font-medium">{v.voucherNumber}</TableCell>
                  <TableCell><Badge variant="outline" className="capitalize">{v.type}</Badge></TableCell>
                  <TableCell>{formatDate(v.date)}</TableCell>
                  <TableCell className="max-w-xs truncate">{v.particular || '—'}</TableCell>
                  <TableCell className="text-sm">{v.debitAccount?.name}</TableCell>
                  <TableCell className="text-sm">{v.creditAccount?.name}</TableCell>
                  <TableCell className="text-right font-semibold">{formatCurrency(v.amount)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}

function NewVoucherDialog({ accounts, onClose, onDone }: { accounts: any[]; onClose: () => void; onDone: () => void }) {
  const api = useApi()
  const [type, setType] = useState('receipt')
  const [date, setDate] = useState(todayIST())
  const [debitAccountId, setDebitAccountId] = useState('')
  const [creditAccountId, setCreditAccountId] = useState('')
  const [amount, setAmount] = useState('')
  const [particular, setParticular] = useState('')
  const [reference, setReference] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    if (!debitAccountId || !creditAccountId || !amount) { toast.error('Fill all required fields'); return }
    if (debitAccountId === creditAccountId) { toast.error('Dr and Cr accounts must differ'); return }
    setLoading(true)
    try {
      await api.post('/api/accounting/vouchers', { type, date, debitAccountId, creditAccountId, amount, particular, reference })
      toast.success('Voucher created')
      onDone()
    } catch (e: any) { toast.error(e.message) } finally { setLoading(false) }
  }

  return (
    <DialogContent>
      <DialogHeader><DialogTitle>New Voucher</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Type</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{VOUCHER_TYPES.map((v) => <SelectItem key={v.value} value={v.value}>{v.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Date</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        </div>
        <div>
          <Label>Debit Account (Dr)</Label>
          <Select value={debitAccountId} onValueChange={setDebitAccountId}>
            <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
            <SelectContent>{accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.name} ({a.type})</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <Label>Credit Account (Cr)</Label>
          <Select value={creditAccountId} onValueChange={setCreditAccountId}>
            <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
            <SelectContent>{accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.name} ({a.type})</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <Label>Amount</Label>
          <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <div>
          <Label>Particular / Narration</Label>
          <Input value={particular} onChange={(e) => setParticular(e.target.value)} placeholder="Description" />
        </div>
        <div>
          <Label>Reference (optional)</Label>
          <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Bill # / cheque #" />
        </div>
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button onClick={submit} disabled={loading} className="bg-brand-gradient text-white">{loading ? 'Creating...' : 'Create'}</Button>
      </DialogFooter>
    </DialogContent>
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
      const d = await api.get('/api/accounting/accounts')
      setAccounts(d.accounts || [])
    } catch (e: any) { toast.error(e.message) } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const setupDefaults = async () => {
    try {
      await api.post('/api/accounting/setup-defaults')
      toast.success('Default accounts created')
      load()
    } catch (e: any) { toast.error(e.message) }
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Chart of Accounts</CardTitle>
        <div className="flex gap-2">
          {accounts.length === 0 && (
            <Button variant="outline" onClick={setupDefaults}><FileSpreadsheet className="w-4 h-4 mr-1" /> Setup Defaults</Button>
          )}
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button className="bg-brand-gradient text-white"><Plus className="w-4 h-4 mr-1" /> New Account</Button></DialogTrigger>
            <NewAccountDialog onClose={() => setOpen(false)} onDone={() => { setOpen(false); load() }} />
          </Dialog>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? <p className="text-center py-8 text-muted-foreground">Loading...</p> : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Tally Group</TableHead>
                <TableHead>Bank</TableHead>
                <TableHead className="text-right">Opening</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {accounts.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-medium">{a.name}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{a.code || '—'}</TableCell>
                  <TableCell><Badge variant="outline" className="capitalize">{a.type}</Badge></TableCell>
                  <TableCell className="text-xs">{a.tallyGroup || '—'}</TableCell>
                  <TableCell className="text-xs">{a.bankName || '—'} {a.accountNumber ? `(${a.accountNumber})` : ''}</TableCell>
                  <TableCell className="text-right">{formatCurrency(a.openingBalance)} {a.openingBalanceType}</TableCell>
                  <TableCell><Badge variant={a.isActive ? 'default' : 'secondary'}>{a.isActive ? 'Active' : 'Inactive'}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}

function NewAccountDialog({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const api = useApi()
  const [name, setName] = useState('')
  const [type, setType] = useState('bank')
  const [tallyGroup, setTallyGroup] = useState('Bank Accounts')
  const [code, setCode] = useState('')
  const [bankName, setBankName] = useState('')
  const [accountNumber, setAccountNumber] = useState('')
  const [ifscCode, setIfscCode] = useState('')
  const [branch, setBranch] = useState('')
  const [openingBalance, setOpeningBalance] = useState('')
  const [openingBalanceType, setOpeningBalanceType] = useState('Dr')
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    if (!name || !type) { toast.error('Name and type required'); return }
    setLoading(true)
    try {
      await api.post('/api/accounting/accounts', {
        name, type, tallyGroup, code, bankName, accountNumber, ifscCode, branch,
        openingBalance, openingBalanceType,
      })
      toast.success('Account created')
      onDone()
    } catch (e: any) { toast.error(e.message) } finally { setLoading(false) }
  }

  return (
    <DialogContent className="max-w-xl">
      <DialogHeader><DialogTitle>New Account</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Cash in Hand" /></div>
          <div><Label>Code (optional)</Label><Input value={code} onChange={(e) => setCode(e.target.value)} /></div>
          <div>
            <Label>Type</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{ACCOUNT_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Tally Group</Label>
            <Select value={tallyGroup} onValueChange={setTallyGroup}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{TALLY_GROUPS.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        {(type === 'bank') && (
          <div className="grid grid-cols-2 gap-3 p-3 rounded-lg bg-muted/30">
            <div><Label>Bank Name</Label><Input value={bankName} onChange={(e) => setBankName(e.target.value)} /></div>
            <div><Label>Account Number</Label><Input value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} /></div>
            <div><Label>IFSC</Label><Input value={ifscCode} onChange={(e) => setIfscCode(e.target.value)} /></div>
            <div><Label>Branch</Label><Input value={branch} onChange={(e) => setBranch(e.target.value)} /></div>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Opening Balance</Label><Input type="number" value={openingBalance} onChange={(e) => setOpeningBalance(e.target.value)} /></div>
          <div>
            <Label>Dr / Cr</Label>
            <Select value={openingBalanceType} onValueChange={setOpeningBalanceType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="Dr">Debit (Dr)</SelectItem><SelectItem value="Cr">Credit (Cr)</SelectItem></SelectContent>
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

function LedgerTab() {
  const api = useApi()
  const [accounts, setAccounts] = useState<any[]>([])
  const [accountId, setAccountId] = useState('')
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => { api.get('/api/accounting/accounts').then((d) => setAccounts(d.accounts || [])) }, [])

  const view = async () => {
    if (!accountId) return
    setLoading(true)
    try {
      const d = await api.get(`/api/accounting/ledger?accountId=${accountId}`)
      setData(d)
    } catch (e: any) { toast.error(e.message) } finally { setLoading(false) }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ledger Statement</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Select value={accountId} onValueChange={setAccountId}>
            <SelectTrigger className="w-[300px]"><SelectValue placeholder="Select account" /></SelectTrigger>
            <SelectContent>{accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
          </Select>
          <Button onClick={view} className="bg-brand-gradient text-white">View</Button>
        </div>
        {loading && <p className="text-center py-8 text-muted-foreground">Loading...</p>}
        {data && (
          <>
            <div className="grid grid-cols-3 gap-4">
              <div className="p-3 rounded-lg bg-emerald-50">
                <p className="text-xs text-muted-foreground">Total Debit</p>
                <p className="text-lg font-bold text-emerald-700">{formatCurrency(data.summary.totalDebit)}</p>
              </div>
              <div className="p-3 rounded-lg bg-amber-50">
                <p className="text-xs text-muted-foreground">Total Credit</p>
                <p className="text-lg font-bold text-amber-700">{formatCurrency(data.summary.totalCredit)}</p>
              </div>
              <div className="p-3 rounded-lg bg-blue-50">
                <p className="text-xs text-muted-foreground">Closing Balance</p>
                <p className="text-lg font-bold text-blue-700">{formatCurrency(data.summary.closingBalance)}</p>
              </div>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Voucher #</TableHead>
                  <TableHead>Particular</TableHead>
                  <TableHead>Against</TableHead>
                  <TableHead className="text-right">Debit</TableHead>
                  <TableHead className="text-right">Credit</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.entries.map((e: any) => (
                  <TableRow key={e.id}>
                    <TableCell className="text-xs">{formatDate(e.date)}</TableCell>
                    <TableCell className="text-xs font-mono">{e.voucherNumber}</TableCell>
                    <TableCell className="text-sm">{e.particular || '—'}</TableCell>
                    <TableCell className="text-xs">{e.oppositeAccount?.name}</TableCell>
                    <TableCell className="text-right text-emerald-600">{e.debit ? formatCurrency(e.debit) : '—'}</TableCell>
                    <TableCell className="text-right text-amber-600">{e.credit ? formatCurrency(e.credit) : '—'}</TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(e.balance)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </>
        )}
      </CardContent>
    </Card>
  )
}

function TrialBalanceTab() {
  const api = useApi()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/api/accounting/trial-balance').then((d) => { setData(d); setLoading(false) }).catch(() => setLoading(false))
  }, [])

  if (loading) return <Card><CardContent className="p-8 text-center text-muted-foreground">Loading...</CardContent></Card>
  if (!data) return null

  return (
    <Card>
      <CardHeader><CardTitle>Trial Balance</CardTitle></CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Account</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Opening Dr</TableHead>
              <TableHead className="text-right">Opening Cr</TableHead>
              <TableHead className="text-right">Period Dr</TableHead>
              <TableHead className="text-right">Period Cr</TableHead>
              <TableHead className="text-right">Closing Dr</TableHead>
              <TableHead className="text-right">Closing Cr</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.rows.filter((r: any) => r.closingDebit > 0 || r.closingCredit > 0).map((r: any) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.name}</TableCell>
                <TableCell><Badge variant="outline" className="capitalize">{r.type}</Badge></TableCell>
                <TableCell className="text-right">{r.openingDebit ? formatCurrency(r.openingDebit) : '—'}</TableCell>
                <TableCell className="text-right">{r.openingCredit ? formatCurrency(r.openingCredit) : '—'}</TableCell>
                <TableCell className="text-right">{r.debit ? formatCurrency(r.debit) : '—'}</TableCell>
                <TableCell className="text-right">{r.credit ? formatCurrency(r.credit) : '—'}</TableCell>
                <TableCell className="text-right font-medium">{r.closingDebit ? formatCurrency(r.closingDebit) : '—'}</TableCell>
                <TableCell className="text-right font-medium">{r.closingCredit ? formatCurrency(r.closingCredit) : '—'}</TableCell>
              </TableRow>
            ))}
            <TableRow className="font-bold bg-muted/40">
              <TableCell colSpan={6}>Totals</TableCell>
              <TableCell className="text-right text-emerald-700">{formatCurrency(data.totals.debit)}</TableCell>
              <TableCell className="text-right text-amber-700">{formatCurrency(data.totals.credit)}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
        {data.totals.diff !== 0 && (
          <div className="p-3 bg-rose-50 text-rose-700 text-sm text-center">
            ⚠ Trial balance difference: {formatCurrency(Math.abs(data.totals.diff))} ({data.totals.diff > 0 ? 'Dr' : 'Cr'})
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function ProfitLossTab() {
  const api = useApi()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => { api.get('/api/accounting/profit-loss').then((d) => { setData(d); setLoading(false) }).catch(() => setLoading(false)) }, [])
  if (loading) return <Card><CardContent className="p-8 text-center text-muted-foreground">Loading...</CardContent></Card>
  if (!data) return null

  return (
    <Card>
      <CardHeader><CardTitle>Profit & Loss Statement</CardTitle></CardHeader>
      <CardContent>
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <h3 className="font-semibold mb-2 text-emerald-700">Income (Credit)</h3>
            <Table>
              <TableBody>
                {data.income.map((r: any) => (
                  <TableRow key={r.name}><TableCell>{r.name}</TableCell><TableCell className="text-right">{formatCurrency(r.amount)}</TableCell></TableRow>
                ))}
                <TableRow className="font-bold bg-emerald-50">
                  <TableCell>Total Income</TableCell>
                  <TableCell className="text-right">{formatCurrency(data.totalIncome)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
          <div>
            <h3 className="font-semibold mb-2 text-rose-700">Expenses (Debit)</h3>
            <Table>
              <TableBody>
                {data.expenses.map((r: any) => (
                  <TableRow key={r.name}><TableCell>{r.name}</TableCell><TableCell className="text-right">{formatCurrency(r.amount)}</TableCell></TableRow>
                ))}
                <TableRow className="font-bold bg-rose-50">
                  <TableCell>Total Expenses</TableCell>
                  <TableCell className="text-right">{formatCurrency(data.totalExpenses)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </div>
        <div className={`mt-6 p-4 rounded-lg text-center ${data.netProfit >= 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
          <p className="text-sm">Net {data.netProfit >= 0 ? 'Profit' : 'Loss'}</p>
          <p className="text-3xl font-bold">{formatCurrency(Math.abs(data.netProfit))}</p>
        </div>
      </CardContent>
    </Card>
  )
}

function BalanceSheetTab() {
  const api = useApi()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => { api.get('/api/accounting/balance-sheet').then((d) => { setData(d); setLoading(false) }).catch(() => setLoading(false)) }, [])
  if (loading) return <Card><CardContent className="p-8 text-center text-muted-foreground">Loading...</CardContent></Card>
  if (!data) return null

  return (
    <Card>
      <CardHeader><CardTitle>Balance Sheet</CardTitle></CardHeader>
      <CardContent>
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <h3 className="font-semibold mb-2 text-blue-700">Assets</h3>
            <Table>
              <TableBody>
                {data.assets.map((r: any, i: number) => (
                  <TableRow key={i}><TableCell>{r.name}</TableCell><TableCell className="text-right">{formatCurrency(r.amount)}</TableCell></TableRow>
                ))}
                <TableRow className="font-bold bg-blue-50">
                  <TableCell>Total Assets</TableCell>
                  <TableCell className="text-right">{formatCurrency(data.totalAssets)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
          <div>
            <h3 className="font-semibold mb-2 text-violet-700">Liabilities & Capital</h3>
            <Table>
              <TableBody>
                {data.liabilities.map((r: any, i: number) => (
                  <TableRow key={i}><TableCell>{r.name}</TableCell><TableCell className="text-right">{formatCurrency(r.amount)}</TableCell></TableRow>
                ))}
                <TableRow className="font-bold bg-violet-50">
                  <TableCell>Total Liabilities</TableCell>
                  <TableCell className="text-right">{formatCurrency(data.totalLiabilities)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </div>
        {Math.abs(data.diff) > 0.01 && (
          <div className="mt-4 p-3 bg-amber-50 text-amber-700 text-sm text-center">
            ⚠ Balance sheet difference: {formatCurrency(Math.abs(data.diff))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function ExpensesPage() {
  const api = useApi()
  const [expenses, setExpenses] = useState<any[]>([])
  const [summary, setSummary] = useState<Record<string, number>>({})
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const d = await api.get('/api/expenses')
      setExpenses(d.expenses || [])
      setSummary(d.summary || {})
      setTotal(d.total || 0)
    } catch (e: any) { toast.error(e.message) } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Expenses</h1>
          <p className="text-muted-foreground text-sm mt-1">Record and track business expenses by category</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button className="bg-brand-gradient text-white"><Plus className="w-4 h-4 mr-1" /> New Expense</Button></DialogTrigger>
          <NewExpenseDialog onClose={() => setOpen(false)} onDone={() => { setOpen(false); load() }} />
        </Dialog>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {Object.entries(summary).map(([cat, amt]) => (
          <Card key={cat} className="border-border/60">
            <CardContent className="p-3">
              <p className="text-xs text-muted-foreground capitalize">{cat}</p>
              <p className="text-base font-bold">{formatCurrency(amt as number)}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle>All Expenses — Total: {formatCurrency(total)}</CardTitle></CardHeader>
        <CardContent className="p-0">
          {loading ? <p className="text-center py-8 text-muted-foreground">Loading...</p> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Expense ID</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Mode</TableHead>
                  <TableHead>Paid To</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {expenses.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="font-mono text-xs">{e.expenseId}</TableCell>
                    <TableCell><Badge variant="outline" className="capitalize">{e.category}</Badge></TableCell>
                    <TableCell>{e.description}</TableCell>
                    <TableCell>{formatDate(e.expenseDate)}</TableCell>
                    <TableCell className="capitalize text-sm">{e.paymentMode}</TableCell>
                    <TableCell className="text-sm">{e.paidTo || '—'}</TableCell>
                    <TableCell className="text-right font-semibold">{formatCurrency(e.amount)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function NewExpenseDialog({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const api = useApi()
  const [category, setCategory] = useState('rent')
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [expenseDate, setExpenseDate] = useState(todayIST())
  const [paymentMode, setPaymentMode] = useState('cash')
  const [paidTo, setPaidTo] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    if (!description || !amount) { toast.error('Description and amount required'); return }
    setLoading(true)
    try {
      await api.post('/api/expenses', { category, description, amount, expenseDate, paymentMode, paidTo, notes })
      toast.success('Expense recorded')
      onDone()
    } catch (e: any) { toast.error(e.message) } finally { setLoading(false) }
  }

  const CATEGORIES = ['rent', 'salaries', 'utilities', 'supplies', 'maintenance', 'equipment', 'marketing', 'travel', 'miscellaneous']
  const MODES = ['cash', 'bank-transfer', 'cheque', 'upi', 'card']

  return (
    <DialogContent>
      <DialogHeader><DialogTitle>New Expense</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Amount</Label><Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
        </div>
        <div><Label>Description</Label><Input value={description} onChange={(e) => setDescription(e.target.value)} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Date</Label><Input type="date" value={expenseDate} onChange={(e) => setExpenseDate(e.target.value)} /></div>
          <div>
            <Label>Payment Mode</Label>
            <Select value={paymentMode} onValueChange={setPaymentMode}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{MODES.map((m) => <SelectItem key={m} value={m} className="capitalize">{m}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <div><Label>Paid To (optional)</Label><Input value={paidTo} onChange={(e) => setPaidTo(e.target.value)} /></div>
        <div><Label>Notes (optional)</Label><Input value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button onClick={submit} disabled={loading} className="bg-brand-gradient text-white">{loading ? 'Recording...' : 'Record Expense'}</Button>
      </DialogFooter>
    </DialogContent>
  )
}
