'use client'

import { useState, useEffect } from 'react'
import { useApi } from '@/lib/auth-context'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { formatDateTime } from '@/lib/format'
import { Key, Plus, Copy, AlertTriangle, ShieldCheck, Power, Check, Eye, EyeOff } from 'lucide-react'

const PERMISSION_PRESETS = [
  'read:patients',
  'read:reports',
  'create:orders',
  'create:bills',
  'read:bills',
  'read:analytics',
  'read:inventory',
  'write:inventory',
]

export function ApiKeysPage() {
  const api = useApi()
  const [keys, setKeys] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [addOpen, setAddOpen] = useState(false)
  const [newKey, setNewKey] = useState<string | null>(null)
  const [showInactive, setShowInactive] = useState(false)
  const [copied, setCopied] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const d = await api.get(`/api/api-keys?includeInactive=${showInactive}`)
      setKeys(d.keys || [])
    } catch (e: any) { toast.error(e.message) } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [showInactive])

  const deactivate = async (id: string) => {
    if (!confirm('Deactivate this API key? Existing integrations will stop working immediately.')) return
    try {
      await api.del(`/api/api-keys/${id}`)
      toast.success('Key deactivated')
      load()
    } catch (e: any) { toast.error(e.message) }
  }

  const copyKey = async () => {
    if (!newKey) return
    try {
      await navigator.clipboard.writeText(newKey)
      setCopied(true)
      toast.success('Key copied to clipboard')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Copy failed — select and copy manually')
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">API Keys</h1>
          <p className="text-muted-foreground text-sm mt-1">External integration tokens — secure, scoped, rate-limited</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowInactive((v) => !v)}>
            {showInactive ? 'Hide Inactive' : 'Show Inactive'}
          </Button>
          <Dialog open={addOpen} onOpenChange={(o) => { setAddOpen(o); if (!o) setNewKey(null) }}>
            <DialogTrigger asChild><Button className="bg-brand-gradient text-white"><Plus className="w-4 h-4 mr-1" /> New API Key</Button></DialogTrigger>
            <NewKeyDialog onClose={() => { setAddOpen(false); setNewKey(null) }} onCreated={(k) => { setNewKey(k); load() }} />
          </Dialog>
        </div>
      </div>

      <Dialog open={!!newKey} onOpenChange={(o) => { if (!o) setNewKey(null) }}>
        <DialogContent>
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Key className="w-5 h-5 text-emerald-600" /> API Key Created</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="border-amber-200 bg-amber-50 border rounded-lg p-3 flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-amber-800 text-sm">Save this key — it won't be shown again</p>
                <p className="text-xs text-amber-700 mt-0.5">Copy and store it securely. If you lose it, you must create a new key.</p>
              </div>
            </div>
            <div>
              <Label>Full API Key</Label>
              <div className="flex gap-2">
                <Input readOnly value={newKey || ''} className="font-mono text-xs" />
                <Button onClick={copyKey} className={copied ? 'bg-emerald-600 text-white' : 'bg-brand-gradient text-white'}>
                  {copied ? <><Check className="w-4 h-4 mr-1" /> Copied</> : <><Copy className="w-4 h-4 mr-1" /> Copy</>}
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">Use this key in the <code className="bg-muted px-1 py-0.5 rounded">Authorization: Bearer &lt;key&gt;</code> header for all external API calls.</p>
          </div>
          <DialogFooter>
            <Button onClick={() => setNewKey(null)} className="bg-brand-gradient text-white">I&apos;ve Saved It — Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Key className="w-5 h-5 text-emerald-600" /> Active Keys ({keys.filter((k) => k.isActive).length})</CardTitle></CardHeader>
        <CardContent className="p-0">
          {loading ? <p className="text-center py-8 text-muted-foreground">Loading...</p> : keys.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">No API keys yet. Create one to enable external integrations.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Key ID</TableHead>
                    <TableHead>Key</TableHead>
                    <TableHead>Permissions</TableHead>
                    <TableHead className="text-right">Rate Limit</TableHead>
                    <TableHead>Last Used</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {keys.map((k) => {
                    const perms = (() => { try { return JSON.parse(k.permissions || '[]') } catch { return [] } })()
                    return (
                      <TableRow key={k.id}>
                        <TableCell className="font-medium">{k.name}</TableCell>
                        <TableCell className="font-mono text-xs">{k.keyId}</TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">{k.key}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1 max-w-xs">
                            {perms.length === 0 ? (
                              <span className="text-xs text-muted-foreground">No permissions</span>
                            ) : perms.slice(0, 3).map((p: string) => (
                              <Badge key={p} variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200">{p}</Badge>
                            ))}
                            {perms.length > 3 && <Badge variant="outline" className="text-[10px]">+{perms.length - 3}</Badge>}
                          </div>
                        </TableCell>
                        <TableCell className="text-right text-sm">{k.rateLimitPerMin}/min</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{k.lastUsedAt ? formatDateTime(k.lastUsedAt) : 'Never'}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={k.isActive ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-50 text-slate-500 border-slate-200'}>
                            {k.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {k.isActive && (
                            <Button size="sm" variant="ghost" className="text-rose-600 hover:bg-rose-50" onClick={() => deactivate(k.id)}>
                              <Power className="w-3.5 h-3.5 mr-1" /> Deactivate
                            </Button>
                          )}
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
  )
}

function NewKeyDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (fullKey: string) => void }) {
  const api = useApi()
  const [name, setName] = useState('')
  const [rateLimit, setRateLimit] = useState('60')
  const [perms, setPerms] = useState<string[]>(['read:patients', 'read:reports'])
  const [loading, setLoading] = useState(false)
  const [showAll, setShowAll] = useState(false)

  const togglePerm = (p: string) => {
    setPerms((arr) => arr.includes(p) ? arr.filter((x) => x !== p) : [...arr, p])
  }

  const submit = async () => {
    if (!name) { toast.error('Name required'); return }
    setLoading(true)
    try {
      const d = await api.post('/api/api-keys', { name, permissions: perms, rateLimitPerMin: rateLimit })
      toast.success('API key created')
      onCreated(d.fullKey)
    } catch (e: any) { toast.error(e.message) } finally { setLoading(false) }
  }

  const visiblePerms = showAll ? PERMISSION_PRESETS : PERMISSION_PRESETS.slice(0, 6)

  return (
    <DialogContent>
      <DialogHeader><DialogTitle className="flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-emerald-600" /> Create API Key</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div><Label>Name *</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Mobile App, External LIS" /></div>
        <div><Label>Rate Limit (requests per minute)</Label><Input type="number" value={rateLimit} onChange={(e) => setRateLimit(e.target.value)} /></div>
        <div>
          <div className="flex items-center justify-between">
            <Label>Permissions</Label>
            <Button size="sm" variant="ghost" onClick={() => setShowAll((v) => !v)} className="text-xs h-6">
              {showAll ? <><EyeOff className="w-3 h-3 mr-1" /> Show Less</> : <><Eye className="w-3 h-3 mr-1" /> Show All</>}
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-1">
            {visiblePerms.map((p) => (
              <label key={p} className="flex items-center gap-2 p-2 border rounded cursor-pointer hover:bg-muted/40 has-[:checked]:bg-emerald-50 has-[:checked]:border-emerald-300">
                <input type="checkbox" checked={perms.includes(p)} onChange={() => togglePerm(p)} className="accent-emerald-600" />
                <span className="text-xs font-mono">{p}</span>
              </label>
            ))}
          </div>
          {perms.length > 0 && (
            <p className="text-xs text-muted-foreground mt-1">{perms.length} permission(s) selected</p>
          )}
        </div>
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button onClick={submit} disabled={loading} className="bg-brand-gradient text-white">{loading ? 'Creating...' : 'Create Key'}</Button>
      </DialogFooter>
    </DialogContent>
  )
}
