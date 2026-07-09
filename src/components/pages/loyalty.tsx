'use client'

import { useState, useEffect } from 'react'
import { useApi } from '@/lib/auth-context'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { formatCurrency, formatDateTime } from '@/lib/format'
import { Award, Search, TrendingUp, History } from 'lucide-react'

const TIER_STYLE: Record<string, string> = {
  bronze: 'bg-amber-100 text-amber-800 border-amber-300',
  silver: 'bg-slate-100 text-slate-700 border-slate-300',
  gold: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  platinum: 'bg-violet-100 text-violet-800 border-violet-300',
}

export function LoyaltyPage() {
  const [tab, setTab] = useState('members')
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Loyalty Program</h1>
        <p className="text-muted-foreground text-sm mt-1">Patient rewards — points, tiers, redemptions</p>
      </div>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="members">Members</TabsTrigger>
          <TabsTrigger value="transactions">All Transactions</TabsTrigger>
        </TabsList>
        <TabsContent value="members"><MembersTab /></TabsContent>
        <TabsContent value="transactions"><TransactionsTab /></TabsContent>
      </Tabs>
    </div>
  )
}

function MembersTab() {
  const api = useApi()
  const [records, setRecords] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [tierFilter, setTierFilter] = useState('')
  const [detail, setDetail] = useState<any | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const d = await api.get(`/api/loyalty?q=${encodeURIComponent(search)}&tier=${tierFilter}&pageSize=100`)
      setRecords(d.records || [])
      setTotal(d.total || 0)
    } catch (e: any) { toast.error(e.message) } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [search, tierFilter])

  const totals = {
    members: total,
    pointsIssued: records.reduce((s, r) => s + (r.totalEarned || 0), 0),
    pointsRedeemed: records.reduce((s, r) => s + (r.totalRedeemed || 0), 0),
    outstanding: records.reduce((s, r) => s + (r.points || 0), 0),
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-border/60"><CardContent className="p-3"><p className="text-xs text-muted-foreground">Total Members</p><p className="text-xl font-bold">{totals.members}</p></CardContent></Card>
        <Card className="border-emerald-200 bg-emerald-50"><CardContent className="p-3"><p className="text-xs text-emerald-700">Points Issued</p><p className="text-xl font-bold text-emerald-700">{totals.pointsIssued.toLocaleString()}</p></CardContent></Card>
        <Card className="border-amber-200 bg-amber-50"><CardContent className="p-3"><p className="text-xs text-amber-700">Points Redeemed</p><p className="text-xl font-bold text-amber-700">{totals.pointsRedeemed.toLocaleString()}</p></CardContent></Card>
        <Card className="border-violet-200 bg-violet-50"><CardContent className="p-3"><p className="text-xs text-violet-700">Outstanding</p><p className="text-xl font-bold text-violet-700">{totals.outstanding.toLocaleString()}</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-3 flex-wrap">
          <div className="flex gap-2 items-center flex-1 min-w-0">
            <div className="relative max-w-md flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or phone..." className="pl-9" />
            </div>
            <Select value={tierFilter} onValueChange={setTierFilter}>
              <SelectTrigger className="w-36"><SelectValue placeholder="All Tiers" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Tiers</SelectItem>
                <SelectItem value="bronze">Bronze</SelectItem>
                <SelectItem value="silver">Silver</SelectItem>
                <SelectItem value="gold">Gold</SelectItem>
                <SelectItem value="platinum">Platinum</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? <p className="text-center py-8 text-muted-foreground">Loading...</p> : records.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">No loyalty members found. Members appear once they earn points on a bill.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Patient</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Tier</TableHead>
                    <TableHead className="text-right">Current Points</TableHead>
                    <TableHead className="text-right">Total Earned</TableHead>
                    <TableHead className="text-right">Total Redeemed</TableHead>
                    <TableHead>Last Updated</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {records.map((r) => (
                    <TableRow key={r.id} className="cursor-pointer hover:bg-muted/40" onClick={() => setDetail(r)}>
                      <TableCell className="font-medium">{r.patientName}</TableCell>
                      <TableCell className="text-sm">{r.patientPhone || '—'}</TableCell>
                      <TableCell><Badge variant="outline" className={`capitalize ${TIER_STYLE[r.tier] || ''}`}>{r.tier}</Badge></TableCell>
                      <TableCell className="text-right font-bold">{(r.points || 0).toLocaleString()}</TableCell>
                      <TableCell className="text-right text-emerald-700">{(r.totalEarned || 0).toLocaleString()}</TableCell>
                      <TableCell className="text-right text-amber-700">{(r.totalRedeemed || 0).toLocaleString()}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{formatDateTime(r.updatedAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        {detail && <MemberDetailDialog member={detail} onClose={() => setDetail(null)} />}
      </Dialog>
    </div>
  )
}

function MemberDetailDialog({ member, onClose }: { member: any; onClose: () => void }) {
  const api = useApi()
  const [data, setData] = useState<{ loyalty: any; transactions: any[] } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get(`/api/loyalty/${member.patientId}`).then((d) => { setData(d); setLoading(false) }).catch((e) => { toast.error(e.message); setLoading(false) })
  }, [member.patientId])

  return (
    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2"><Award className="w-5 h-5 text-emerald-600" /> {member.patientName}</DialogTitle>
      </DialogHeader>
      {loading ? <p className="text-center py-6 text-muted-foreground">Loading...</p> : !data ? null : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <Card className="border-border/60"><CardContent className="p-2"><p className="text-xs text-muted-foreground">Tier</p><Badge variant="outline" className={`capitalize mt-1 ${TIER_STYLE[data.loyalty.tier] || ''}`}>{data.loyalty.tier}</Badge></CardContent></Card>
            <Card className="border-border/60"><CardContent className="p-2"><p className="text-xs text-muted-foreground">Current Points</p><p className="text-lg font-bold">{(data.loyalty.points || 0).toLocaleString()}</p></CardContent></Card>
            <Card className="border-emerald-200 bg-emerald-50"><CardContent className="p-2"><p className="text-xs text-emerald-700">Total Earned</p><p className="text-lg font-bold text-emerald-700">{(data.loyalty.totalEarned || 0).toLocaleString()}</p></CardContent></Card>
            <Card className="border-amber-200 bg-amber-50"><CardContent className="p-2"><p className="text-xs text-amber-700">Total Redeemed</p><p className="text-lg font-bold text-amber-700">{(data.loyalty.totalRedeemed || 0).toLocaleString()}</p></CardContent></Card>
          </div>

          <div>
            <p className="text-sm font-semibold mb-2 flex items-center gap-1.5"><History className="w-4 h-4" /> Transaction History</p>
            {data.transactions.length === 0 ? (
              <p className="text-center py-4 text-muted-foreground text-sm">No transactions yet.</p>
            ) : (
              <div className="border rounded-lg max-h-80 overflow-y-auto divide-y">
                {data.transactions.map((t) => (
                  <div key={t.id} className="p-2.5 flex items-center justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={t.type === 'earn' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : t.type === 'redeem' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-slate-50 text-slate-700 border-slate-200'}>{t.type}</Badge>
                        {t.billNumber && <span className="text-xs font-mono text-muted-foreground">{t.billNumber}</span>}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{t.reason || '—'} · {formatDateTime(t.createdAt)}</p>
                    </div>
                    <div className="text-right">
                      <p className={`font-bold ${t.points >= 0 ? 'text-emerald-700' : 'text-amber-700'}`}>{t.points >= 0 ? '+' : ''}{t.points}</p>
                      {t.redemptionValue > 0 && <p className="text-xs text-muted-foreground">{formatCurrency(t.redemptionValue)}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </DialogContent>
  )
}

function TransactionsTab() {
  const api = useApi()
  const [transactions, setTransactions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      setLoading(true)
      try {
        const d = await api.get('/api/loyalty?pageSize=50')
        const members = d.records || []
        const txns = await Promise.all(
          members.slice(0, 30).map((m: any) =>
            api.get(`/api/loyalty/${m.patientId}`).then((r) => (r.transactions || []).map((t: any) => ({ ...t, patientName: m.patientName, patientPhone: m.patientPhone }))).catch(() => [])
          )
        )
        const flat = txns.flat().sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        setTransactions(flat.slice(0, 200))
      } catch (e: any) { toast.error(e.message) } finally { setLoading(false) }
    })()
  }, [])

  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><TrendingUp className="w-5 h-5 text-emerald-600" /> Recent Loyalty Transactions</CardTitle></CardHeader>
      <CardContent className="p-0">
        {loading ? <p className="text-center py-8 text-muted-foreground">Loading transactions...</p> : transactions.length === 0 ? (
          <p className="text-center py-8 text-muted-foreground">No loyalty transactions yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Patient</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Bill #</TableHead>
                  <TableHead className="text-right">Points</TableHead>
                  <TableHead className="text-right">Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="text-xs text-muted-foreground">{formatDateTime(t.createdAt)}</TableCell>
                    <TableCell className="font-medium text-sm">{t.patientName}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={
                        t.type === 'earn' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                        t.type === 'redeem' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                        t.type === 'expire' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                        'bg-slate-50 text-slate-700 border-slate-200'
                      }>{t.type}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">{t.reason || '—'}</TableCell>
                    <TableCell className="font-mono text-xs">{t.billNumber || '—'}</TableCell>
                    <TableCell className={`text-right font-bold ${t.points >= 0 ? 'text-emerald-700' : 'text-amber-700'}`}>{t.points >= 0 ? '+' : ''}{t.points}</TableCell>
                    <TableCell className="text-right text-sm">{t.redemptionValue > 0 ? formatCurrency(t.redemptionValue) : '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
