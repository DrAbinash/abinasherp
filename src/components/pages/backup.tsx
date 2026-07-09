'use client'

import { useState, useEffect, useRef } from 'react'
import { apiPath } from '@/lib/base-path'
import { useApi, useAuth } from '@/lib/auth-context'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { formatDateTime } from '@/lib/format'
import {
  Download, Upload, Database, AlertTriangle, ShieldAlert,
  CheckCircle2, FileWarning, Loader2, HardDrive,
} from 'lucide-react'

export function BackupPage() {
  const api = useApi()
  const { user, token } = useAuth()
  const [info, setInfo] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const [restoreResult, setRestoreResult] = useState<any>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  const isOwner = user?.normalizedRole === 'owner' || user?.role === 'owner'

  const load = async () => {
    setLoading(true)
    try {
      const d = await api.get('/api/backup/download?info=true')
      setInfo(d)
    } catch (e: any) { toast.error(e.message) } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const downloadBackup = async () => {
    setDownloading(true)
    try {
      const res = await fetch(apiPath('/api/backup/download'), {
        headers: { Authorization: `Bearer ${token || ''}` },
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Download failed')
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `care-erp-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.sql`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success('Backup downloaded')
      load()
    } catch (e: any) { toast.error(e.message) } finally { setDownloading(false) }
  }

  const restoreBackup = async () => {
    if (!selectedFile) { toast.error('Select a backup file first'); return }
    if (!confirm('Restoring will OVERWRITE all current data. A backup of the current DB will be saved automatically. Continue?')) return
    setRestoring(true)
    setRestoreResult(null)
    try {
      const formData = new FormData()
      formData.append('file', selectedFile)
      const res = await fetch(apiPath('/api/backup/restore'), {
        method: 'POST',
        headers: { Authorization: `Bearer ${token || ''}` },
        body: formData,
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Restore failed')
      setRestoreResult(data)
      toast.success('Database restored — restart the application to apply changes')
      setSelectedFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
    } catch (e: any) { toast.error(e.message) } finally { setRestoring(false) }
  }

  const dbSizeMB = info?.database?.sizeBytes ? (info.database.sizeBytes / (1024 * 1024)).toFixed(2) : '—'

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Backup & Restore</h1>
        <p className="text-muted-foreground text-sm mt-1">Database backup download and disaster-recovery restore (owner-only)</p>
      </div>

      {!isOwner && (
        <Card className="border-rose-200 bg-rose-50">
          <CardContent className="p-4 flex items-center gap-3">
            <ShieldAlert className="w-5 h-5 text-rose-600" />
            <div>
              <p className="font-medium text-rose-800">Owner access required</p>
              <p className="text-sm text-rose-700">Backup and restore operations are restricted to owner-role users only.</p>
            </div>
          </CardContent>
        </Card>
      )}

      {restoreResult && (
        <Card className="border-emerald-200 bg-emerald-50">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5" />
              <div className="flex-1">
                <p className="font-medium text-emerald-800">Restore Successful</p>
                <div className="text-sm text-emerald-700 mt-1 space-y-0.5">
                  <p>Restored from: <strong>{restoreResult.restoredFrom}</strong></p>
                  <p>Size: {(restoreResult.sizeBytes / (1024 * 1024)).toFixed(2)} MB</p>
                  <p>Previous DB backup saved at: <code className="text-xs bg-emerald-100 px-1 rounded">{restoreResult.backupPath}</code></p>
                </div>
                <p className="text-sm font-medium text-emerald-800 mt-2">{restoreResult.warning}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Download card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Download className="w-5 h-5 text-emerald-600" /> Download Backup</CardTitle>
            <CardDescription>Download a PostgreSQL SQL dump (pg_dump) of the database</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? (
              <div className="flex items-center justify-center py-6 text-muted-foreground text-sm">
                <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Loading backup info...
              </div>
            ) : (
              <div className="space-y-3">
                <div className="bg-muted/30 rounded-lg p-3 space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Database file</span><span className="font-mono text-xs">{info?.database?.path || '—'}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">File exists</span>{info?.database?.exists ? <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">Yes</Badge> : <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-200">No</Badge>}</div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Size</span><span className="font-medium flex items-center gap-1"><HardDrive className="w-3.5 h-3.5" /> {dbSizeMB} MB</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Uploads dir</span>{info?.uploads?.exists ? <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">Present</Badge> : <Badge variant="outline">Not present</Badge>}</div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Last checked</span><span className="text-xs">{formatDateTime(info?.timestamp)}</span></div>
                </div>
                <Button onClick={downloadBackup} disabled={downloading || !info?.database?.exists || !isOwner} className="w-full bg-brand-gradient text-white">
                  {downloading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Downloading...</> : <><Download className="w-4 h-4 mr-2" /> Download Backup (.sql)</>}
                </Button>
                <p className="text-xs text-muted-foreground">{info?.instructions}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Restore card */}
        <Card className={isOwner ? '' : 'opacity-60'}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Upload className="w-5 h-5 text-amber-600" /> Restore from Backup</CardTitle>
            <CardDescription>Restore the database from a previously-saved .sql dump</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Card className="border-rose-200 bg-rose-50">
              <CardContent className="p-3 flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-rose-800 text-sm">Warning: This will overwrite current data</p>
                  <p className="text-xs text-rose-700 mt-0.5">All data added since the backup file was created will be lost. The current DB will be auto-saved as a <code className="bg-rose-100 px-1 rounded">.bak-{`{timestamp}`}</code> file before overwriting.</p>
                </div>
              </CardContent>
            </Card>

            <div>
              <Label>PostgreSQL SQL Dump (.sql)</Label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".sql,text/plain,application/sql"
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                disabled={!isOwner || restoring}
                className="block w-full text-sm file:mr-3 file:py-2 file:px-3 file:rounded-md file:border-0 file:bg-brand-gradient file:text-white file:cursor-pointer file:font-medium hover:file:opacity-90 border border-input rounded-md disabled:opacity-50"
              />
              {selectedFile && (
                <div className="mt-2 text-xs text-muted-foreground flex items-center gap-1">
                  <FileWarning className="w-3.5 h-3.5" />
                  <span>{selectedFile.name} ({(selectedFile.size / (1024 * 1024)).toFixed(2)} MB)</span>
                </div>
              )}
            </div>

            <Button onClick={restoreBackup} disabled={!isOwner || restoring || !selectedFile} className="w-full bg-rose-600 text-white hover:bg-rose-700">
              {restoring ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Restoring...</> : <><Upload className="w-4 h-4 mr-2" /> Restore Database</>}
            </Button>

            <div className="text-xs text-muted-foreground space-y-1">
              <p className="flex items-center gap-1"><Database className="w-3.5 h-3.5" /> File must be a valid pg_dump SQL file (max 500 MB)</p>
              <p className="flex items-center gap-1"><ShieldAlert className="w-3.5 h-3.5" /> After restore, restart the application to apply changes</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
