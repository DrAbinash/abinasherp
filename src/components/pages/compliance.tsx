'use client'

import { useState, useEffect } from 'react'
import { useApi } from '@/lib/auth-context'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import { formatDate } from '@/lib/format'
import { NablPage } from '@/components/pages/nabl'
import {
  ShieldCheck, FileText, Calendar, Stethoscope, Loader2,
  ExternalLink, BarChart3, ClipboardList,
} from 'lucide-react'

export function CompliancePage({ onNavigateFormF }: { onNavigateFormF?: () => void }) {
  const [tab, setTab] = useState('nabl')
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Compliance</h1>
        <p className="text-muted-foreground text-sm mt-1">Regulatory & accreditation compliance — NABL audits and PCPNDT Form F</p>
      </div>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="nabl"><ShieldCheck className="w-3.5 h-3.5 mr-1" /> NABL Compliance</TabsTrigger>
          <TabsTrigger value="form-f"><FileText className="w-3.5 h-3.5 mr-1" /> PCPNDT Form F</TabsTrigger>
        </TabsList>
        <TabsContent value="nabl"><NablPage /></TabsContent>
        <TabsContent value="form-f"><FormFSummaryTab onNavigateFormF={onNavigateFormF} /></TabsContent>
      </Tabs>
    </div>
  )
}

const STATUS_STYLE: Record<string, string> = {
  draft: 'bg-amber-50 text-amber-700 border-amber-200',
  submitted: 'bg-blue-50 text-blue-700 border-blue-200',
  approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  rejected: 'bg-rose-50 text-rose-700 border-rose-200',
}

function FormFSummaryTab({ onNavigateFormF }: { onNavigateFormF?: () => void }) {
  const api = useApi()
  const [records, setRecords] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/api/form-f').then((d) => { setRecords(d.records || []); setLoading(false) }).catch((e) => { toast.error(e.message); setLoading(false) })
  }, [])

  if (loading) return (
    <div className="flex items-center justify-center py-16 text-muted-foreground">
      <Loader2 className="w-5 h-5 mr-2 animate-spin" /> Loading Form F summary...
    </div>
  )

  const byStatus: Record<string, number> = {}
  for (const r of records) byStatus[r.status] = (byStatus[r.status] || 0) + 1

  const byMonth: Record<string, number> = {}
  for (const r of records) {
    const d = r.procedureDate || r.date || r.createdAt?.slice(0, 10)
    if (d) {
      const month = d.slice(0, 7)
      byMonth[month] = (byMonth[month] || 0) + 1
    }
  }

  const byDoctor: Record<string, number> = {}
  for (const r of records) {
    const doc = r.doctorName || 'Unknown'
    byDoctor[doc] = (byDoctor[doc] || 0) + 1
  }

  const sortedMonths = Object.entries(byMonth).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 12)
  const sortedDoctors = Object.entries(byDoctor).sort((a, b) => b[1] - a[1]).slice(0, 10)

  return (
    <div className="space-y-4">
      <Card className="border-emerald-200 bg-gradient-to-r from-emerald-50 to-amber-50">
        <CardContent className="p-4 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-brand-gradient text-white flex items-center justify-center">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <p className="font-medium">PCPNDT Form F Management</p>
              <p className="text-xs text-muted-foreground">{records.length} total Form F records — mandatory legal compliance for prenatal diagnostics</p>
            </div>
          </div>
          {onNavigateFormF && (
            <Button onClick={onNavigateFormF} className="bg-brand-gradient text-white">
              Open Form F Page <ExternalLink className="w-4 h-4 ml-1" />
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-border/60"><CardContent className="p-3"><p className="text-xs text-muted-foreground">Total Records</p><p className="text-xl font-bold">{records.length}</p></CardContent></Card>
        <Card className="border-amber-200 bg-amber-50"><CardContent className="p-3"><p className="text-xs text-amber-700">Drafts</p><p className="text-xl font-bold text-amber-700">{byStatus.draft || 0}</p></CardContent></Card>
        <Card className="border-emerald-200 bg-emerald-50"><CardContent className="p-3"><p className="text-xs text-emerald-700">Approved</p><p className="text-xl font-bold text-emerald-700">{byStatus.approved || 0}</p></CardContent></Card>
        <Card className="border-rose-200 bg-rose-50"><CardContent className="p-3"><p className="text-xs text-rose-700">Rejected</p><p className="text-xl font-bold text-rose-700">{byStatus.rejected || 0}</p></CardContent></Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* By Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><BarChart3 className="w-4 h-4 text-emerald-600" /> Records by Status</CardTitle>
            <CardDescription>Distribution across the workflow stages</CardDescription>
          </CardHeader>
          <CardContent>
            {Object.keys(byStatus).length === 0 ? (
              <p className="text-center py-6 text-muted-foreground text-sm">No records</p>
            ) : (
              <div className="space-y-2">
                {Object.entries(byStatus).sort((a, b) => b[1] - a[1]).map(([status, count]) => {
                  const pct = records.length > 0 ? (count / records.length) * 100 : 0
                  return (
                    <div key={status}>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <Badge variant="outline" className={`capitalize ${STATUS_STYLE[status] || ''}`}>{status}</Badge>
                        <span className="font-medium">{count} ({pct.toFixed(0)}%)</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-brand-gradient" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* By Month */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><Calendar className="w-4 h-4 text-amber-600" /> Records by Month</CardTitle>
            <CardDescription>Monthly Form F volume (last 12 months)</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {sortedMonths.length === 0 ? (
              <p className="text-center py-6 text-muted-foreground text-sm">No dated records</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Month</TableHead>
                      <TableHead className="text-right">Count</TableHead>
                      <TableHead className="text-right">Bar</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedMonths.map(([month, count]) => {
                      const max = sortedMonths[0]?.[1] || 1
                      const pct = (count / max) * 100
                      return (
                        <TableRow key={month}>
                          <TableCell className="font-mono text-xs">{month}</TableCell>
                          <TableCell className="text-right font-medium">{count}</TableCell>
                          <TableCell className="text-right">
                            <div className="inline-block w-24 h-2 bg-muted rounded-full overflow-hidden align-middle">
                              <div className="h-full bg-brand-gradient-amber" style={{ width: `${pct}%` }} />
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* By Doctor */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Stethoscope className="w-4 h-4 text-violet-600" /> Records by Doctor</CardTitle>
          <CardDescription>Top 10 doctors by Form F volume</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {sortedDoctors.length === 0 ? (
            <p className="text-center py-6 text-muted-foreground text-sm">No doctor-attributed records</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Doctor</TableHead>
                    <TableHead className="text-right">Form F Count</TableHead>
                    <TableHead>Share</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedDoctors.map(([doctor, count]) => {
                    const pct = records.length > 0 ? (count / records.length) * 100 : 0
                    return (
                      <TableRow key={doctor}>
                        <TableCell className="font-medium">{doctor}</TableCell>
                        <TableCell className="text-right font-semibold">{count}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                              <div className="h-full bg-brand-gradient-violet" style={{ width: `${pct}%` }} />
                            </div>
                            <span className="text-xs text-muted-foreground w-10 text-right">{pct.toFixed(0)}%</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent records preview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><ClipboardList className="w-4 h-4 text-emerald-600" /> Recent Form F Records</CardTitle>
          <CardDescription>Latest 10 records — full management on the Form F page</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {records.length === 0 ? (
            <p className="text-center py-6 text-muted-foreground text-sm">No Form F records yet</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Form F ID</TableHead>
                    <TableHead>Patient</TableHead>
                    <TableHead>Doctor</TableHead>
                    <TableHead>Procedure Date</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {records.slice(0, 10).map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono text-xs">{r.formFId}</TableCell>
                      <TableCell className="font-medium text-sm">{r.patientName || '—'}</TableCell>
                      <TableCell className="text-sm">{r.doctorName || '—'}</TableCell>
                      <TableCell className="text-xs">{formatDate(r.procedureDate || r.date)}</TableCell>
                      <TableCell><Badge variant="outline" className={`capitalize ${STATUS_STYLE[r.status] || ''}`}>{r.status}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {!onNavigateFormF && (
        <p className="text-center text-xs text-muted-foreground">Tip: Use the sidebar to navigate to the full Form F page for scanning, editing, and approving records.</p>
      )}
    </div>
  )
}
