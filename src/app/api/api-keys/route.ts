import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getStaffSession } from '@/lib/session'
import crypto from 'crypto'

function maskKey(key: string): string {
  if (key.length <= 4) return '****'
  return '*'.repeat(Math.max(0, key.length - 4)) + key.slice(-4)
}

function randomKey(len: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  const bytes = crypto.randomBytes(len)
  let out = ''
  for (let i = 0; i < len; i++) {
    out += chars[bytes[i] % chars.length]
  }
  return out
}

export async function GET(req: NextRequest) {
  const session = await getStaffSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!session.isOwner) return NextResponse.json({ error: 'Forbidden: owner role required' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const includeInactive = searchParams.get('includeInactive') === 'true'

  const where: any = {}
  if (!includeInactive) where.isActive = true

  const keys = await db.apiKey.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  })

  const masked = keys.map((k) => ({
    ...k,
    key: maskKey(k.key),
  }))

  return NextResponse.json({ keys: masked })
}

export async function POST(req: NextRequest) {
  const session = await getStaffSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!session.isOwner) return NextResponse.json({ error: 'Forbidden: owner role required' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const { name, permissions, rateLimitPerMin } = body
  if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 })

  const count = await db.apiKey.count()
  const keyId = `key-${String(count + 1).padStart(4, '0')}`
  const fullKey = randomKey(32)

  let perms: string[] = []
  if (Array.isArray(permissions)) perms = permissions
  else if (typeof permissions === 'string') {
    try { perms = JSON.parse(permissions) } catch { perms = [] }
  }

  const apiKey = await db.apiKey.create({
    data: {
      keyId,
      name,
      key: fullKey,
      permissions: JSON.stringify(perms),
      rateLimitPerMin: rateLimitPerMin ? parseInt(rateLimitPerMin) : 60,
      isActive: true,
      createdBy: session.id,
    },
  })

  return NextResponse.json({
    apiKey: {
      ...apiKey,
      key: fullKey,
    },
    fullKey,
    warning: 'Store this key securely. It will not be shown again.',
  })
}
