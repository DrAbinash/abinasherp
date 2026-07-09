'use client'

import { useState, useEffect, useRef } from 'react'
import { apiPath } from '@/lib/base-path'
import { useApi } from '@/lib/auth-context'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { formatDate, todayIST } from '@/lib/format'
import { ScanLine, Upload, FileText, Loader2, Sparkles, FileCheck } from 'lucide-react'

export function FormFPage() {
  const api = useApi()
  const [records, setRecords] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [scanOpen, setScanOpen] = useState(false)
  const [statusFilter, setStatusFilter] = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const d = await api.get(`/api/form-f?status=${statusFilter}`)
      setRecords(d.records || [])
    } catch (e: any) { toast.error(e.message) } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [statusFilter])

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Form F (PCPNDT)</h1>
          <p className="text-muted-foreground text-sm mt-1">Mandatory legal compliance for prenatal diagnostics — scan & auto-extract with VLM</p>
        </div>
        <Button onClick={() => setScanOpen(true)} className="bg-brand-gradient text-white">
          <ScanLine className="w-4 h-4 mr-2" /> Scan Form F
        </Button>
      </div>

      <div className="flex gap-2">
        {['', 'draft', 'submitted', 'approved', 'rejected'].map((s) => (
          <Button key={s || 'all'} variant={statusFilter === s ? 'default' : 'outline'} size="sm" onClick={() => setStatusFilter(s)} className="capitalize">
            {s || 'All'}
          </Button>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? <p className="text-center py-8 text-muted-foreground">Loading...</p> : records.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">No Form F records yet. Scan a Form F to auto-extract data.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Form F ID</TableHead>
                  <TableHead>Patient</TableHead>
                  <TableHead>Mobile</TableHead>
                  <TableHead>Age</TableHead>
                  <TableHead>Procedure</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Doctor</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-xs">{r.formFId}</TableCell>
                    <TableCell className="font-medium">{r.patientName || '—'}</TableCell>
                    <TableCell className="text-sm">{r.mobile || '—'}</TableCell>
                    <TableCell>{r.age || '—'}</TableCell>
                    <TableCell className="text-sm">{r.procedure || '—'}</TableCell>
                    <TableCell className="text-xs">{r.procedureDate || '—'}</TableCell>
                    <TableCell className="text-sm">{r.doctorName || '—'}</TableCell>
                    <TableCell><Badge variant="outline" className={
                      r.status === 'approved' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                      r.status === 'submitted' ? 'bg-blue-50 text-blue-700 border-blue-200' :
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

      <Dialog open={scanOpen} onOpenChange={setScanOpen}>
        <ScanFormFDialog onClose={() => setScanOpen(false)} onDone={() => { setScanOpen(false); load() }} />
      </Dialog>
    </div>
  )
}

function ScanFormFDialog({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const api = useApi()
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [extracted, setExtracted] = useState<any>(null)
  const [saving, setSaving] = useState(false)

  const handleFile = async (file: File) => {
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const token = localStorage.getItem('care_erp_token') || ''
      const res = await fetch(apiPath('/api/form-f/scan'), {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Scan failed')
      setExtracted({ ...data.extracted, ocrConfidence: data.ocrConfidence })
      toast.success('Form F scanned — review extracted data')
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setUploading(false)
    }
  }

  const save = async () => {
    setSaving(true)
    try {
      await api.post('/api/form-f', {
        ...extracted,
        ocrConfidence: extracted.ocrConfidence,
        status: 'draft',
      })
      toast.success('Form F record saved as draft')
      onDone()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
      <DialogHeader><DialogTitle>Scan Form F</DialogTitle></DialogHeader>
      {!extracted ? (
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
          className="border-2 border-dashed rounded-lg p-8 text-center"
        >
          {uploading ? (
            <div>
              <Loader2 className="w-12 h-12 mx-auto animate-spin text-emerald-600 mb-3" />
              <p className="text-sm text-muted-foreground">Scanning Form F with VLM...</p>
              <p className="text-xs text-muted-foreground mt-1">Extracting all 30+ PCPNDT fields</p>
            </div>
          ) : (
            <>
              <Upload className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
              <p className="font-medium">Drop Form F scan here or click to upload</p>
              <p className="text-xs text-muted-foreground mt-1">JPEG, PNG, or WebP · max 8MB</p>
              <Button onClick={() => fileRef.current?.click()} className="mt-4 bg-brand-gradient text-white">
                <ScanLine className="w-4 h-4 mr-1" /> Select File
              </Button>
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
            </>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-50 border border-emerald-200">
            <Sparkles className="w-5 h-5 text-emerald-600" />
            <p className="text-sm text-emerald-800">VLM extracted Form F data — review and edit before saving</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
            <Field label="Patient Name" value={extracted.patientName} onChange={(v) => setExtracted({ ...extracted, patientName: v })} />
            <Field label="Age" value={extracted.age ? String(extracted.age) : ''} onChange={(v) => setExtracted({ ...extracted, age: v })} />
            <Field label="Mobile" value={extracted.mobile} onChange={(v) => setExtracted({ ...extracted, mobile: v })} />
            <Field label="Husband/Father Name" value={extracted.husbandFatherName} onChange={(v) => setExtracted({ ...extracted, husbandFatherName: v })} />
            <Field label="Children Details" value={extracted.childrenDetails} onChange={(v) => setExtracted({ ...extracted, childrenDetails: v })} placeholder="e.g. 1M 0F" />
            <Field label="Referred By" value={extracted.referredBy} onChange={(v) => setExtracted({ ...extracted, referredBy: v })} />
            <Field label="Address" value={extracted.address} onChange={(v) => setExtracted({ ...extracted, address: v })} colSpan={3} />
            <Field label="LMP (Weeks)" value={extracted.lmpWeeks} onChange={(v) => setExtracted({ ...extracted, lmpWeeks: v })} />
            <Field label="Genetic History" value={extracted.geneticHistory} onChange={(v) => setExtracted({ ...extracted, geneticHistory: v })} />
            <Field label="Doctor Name" value={extracted.doctorName} onChange={(v) => setExtracted({ ...extracted, doctorName: v })} />
            <Field label="Procedure" value={extracted.procedure} onChange={(v) => setExtracted({ ...extracted, procedure: v })} />
            <Field label="Procedure Purpose" value={extracted.procedurePurpose} onChange={(v) => setExtracted({ ...extracted, procedurePurpose: v })} />
            <Field label="Procedure Date" value={extracted.procedureDate} onChange={(v) => setExtracted({ ...extracted, procedureDate: v })} type="date" />
            <Field label="Consent Date" value={extracted.consentDate} onChange={(v) => setExtracted({ ...extracted, consentDate: v })} type="date" />
            <Field label="Gestational Age (weeks)" value={extracted.gestationalAgeWeeks ? String(extracted.gestationalAgeWeeks) : ''} onChange={(v) => setExtracted({ ...extracted, gestationalAgeWeeks: v })} />
            <Field label="Gestational Age (days)" value={extracted.gestationalAgeDays ? String(extracted.gestationalAgeDays) : ''} onChange={(v) => setExtracted({ ...extracted, gestationalAgeDays: v })} />
            <Field label="Ultrasound Result" value={extracted.ultrasoundResult} onChange={(v) => setExtracted({ ...extracted, ultrasoundResult: v })} colSpan={2} />
            <Field label="Abnormality" value={extracted.abnormality} onChange={(v) => setExtracted({ ...extracted, abnormality: v })} />
            <Field label="MTP Advised" value={extracted.mtpAdvised} onChange={(v) => setExtracted({ ...extracted, mtpAdvised: v })} />
            <Field label="MTP Date" value={extracted.mtpDate} onChange={(v) => setExtracted({ ...extracted, mtpDate: v })} type="date" />
            <Field label="Place" value={extracted.place} onChange={(v) => setExtracted({ ...extracted, place: v })} />
            <Field label="Date" value={extracted.date} onChange={(v) => setExtracted({ ...extracted, date: v })} type="date" />
            <Field label="Basis of Diagnosis" value={extracted.basisDiagnosis} onChange={(v) => setExtracted({ ...extracted, basisDiagnosis: v })} colSpan={2} />
            <Field label="Previous Child Issue" value={extracted.previousChildIssue} onChange={(v) => setExtracted({ ...extracted, previousChildIssue: v })} colSpan={2} />
            <Field label="Indication (other)" value={extracted.indicationOther} onChange={(v) => setExtracted({ ...extracted, indicationOther: v })} colSpan={2} />
            <Field label="Invasive Procedure" value={extracted.invasiveProcedure} onChange={(v) => setExtracted({ ...extracted, invasiveProcedure: v })} />
            <Field label="Complication" value={extracted.complication} onChange={(v) => setExtracted({ ...extracted, complication: v })} />
            <Field label="Lab Tests" value={extracted.labTests} onChange={(v) => setExtracted({ ...extracted, labTests: v })} />
            <Field label="Prenatal Result" value={extracted.prenatalResult} onChange={(v) => setExtracted({ ...extracted, prenatalResult: v })} />
            <Field label="Result Conveyed" value={extracted.resultConveyed} onChange={(v) => setExtracted({ ...extracted, resultConveyed: v })} colSpan={2} />
          </div>
        </div>
      )}
      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        {extracted && (
          <Button onClick={save} disabled={saving} className="bg-brand-gradient text-white">
            {saving ? 'Saving...' : 'Save Form F'}
          </Button>
        )}
      </DialogFooter>
    </DialogContent>
  )
}

function Field({ label, value, onChange, placeholder, type, colSpan }: {
  label: string; value: string | null | undefined; onChange: (v: string) => void
  placeholder?: string; type?: string; colSpan?: number
}) {
  return (
    <div className={colSpan === 2 ? 'col-span-2' : colSpan === 3 ? 'col-span-3' : ''}>
      <Label className="text-xs">{label}</Label>
      <Input
        type={type || 'text'}
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="text-sm"
      />
    </div>
  )
}
