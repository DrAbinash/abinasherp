import { db } from '@/lib/db'
import { headers } from 'next/headers'

export interface VerifiedApiKey {
  id: string
  keyId: string
  name: string
  permissions: string[]
  rateLimitPerMin: number
}

export async function verifyApiKey(requiredPermission: string): Promise<{
  ok: boolean
  apiKey?: VerifiedApiKey
  error?: string
  status?: number
}> {
  const h = await headers()
  const key = h.get('x-api-key') || h.get('X-API-Key')
  if (!key) {
    return { ok: false, error: 'Missing X-API-Key header', status: 401 }
  }

  const record = await db.apiKey.findFirst({
    where: { key, isActive: true },
  })
  if (!record) {
    return { ok: false, error: 'Invalid API key', status: 401 }
  }

  let perms: string[] = []
  try {
    perms = JSON.parse(record.permissions || '[]')
  } catch {
    perms = []
  }

  const hasAll = perms.includes('*')
  const hasExact = perms.includes(requiredPermission)
  const hasWildcard = perms.some((p) => p.endsWith(':*') && requiredPermission.startsWith(p.slice(0, -1)))

  if (!hasAll && !hasExact && !hasWildcard) {
    return { ok: false, error: `Missing permission: ${requiredPermission}`, status: 403 }
  }

  await db.apiKey.update({
    where: { id: record.id },
    data: { lastUsedAt: new Date() },
  })

  return {
    ok: true,
    apiKey: {
      id: record.id,
      keyId: record.keyId,
      name: record.name,
      permissions: perms,
      rateLimitPerMin: record.rateLimitPerMin,
    },
  }
}

export async function logApiAccess(params: {
  apiKeyId?: string
  keyId?: string
  endpoint: string
  method: string
  statusCode: number
  durationMs?: number
  errorMessage?: string | null
}) {
  const h = await headers()
  try {
    await db.apiAccessLog.create({
      data: {
        apiKeyId: params.apiKeyId || null,
        keyId: params.keyId || null,
        endpoint: params.endpoint,
        method: params.method,
        statusCode: params.statusCode,
        ipAddress: h.get('x-forwarded-for') || h.get('x-real-ip') || null,
        userAgent: h.get('user-agent') || null,
        durationMs: params.durationMs ?? null,
        errorMessage: params.errorMessage || null,
      },
    })
  } catch {
    // ignore logging failures
  }
}
