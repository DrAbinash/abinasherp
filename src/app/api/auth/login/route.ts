import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { hashPin, verifyPin, generateToken, DEFAULT_ROLE_PERMISSIONS, normalizeRole } from '@/lib/auth'
import { bootstrapAdminIfNeeded } from '@/lib/seed'

// In-memory IP rate limiting: max 20 failed attempts per IP per 15 minutes
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000
const RATE_LIMIT_MAX = 20
const ipFailures = new Map<string, { count: number; resetAt: number }>()

function getIp(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
}

function isRateLimited(ip: string): boolean {
  const now = Date.now()
  const entry = ipFailures.get(ip)
  if (!entry || entry.resetAt < now) return false
  return entry.count >= RATE_LIMIT_MAX
}

function recordFailure(ip: string): void {
  const now = Date.now()
  const entry = ipFailures.get(ip)
  if (!entry || entry.resetAt < now) {
    ipFailures.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
  } else {
    entry.count++
  }
}

export async function POST(req: NextRequest) {
  await bootstrapAdminIfNeeded()

  const ip = getIp(req)
  if (isRateLimited(ip)) {
    return NextResponse.json({ error: 'Too many failed attempts. Try again later.' }, { status: 429 })
  }

  const body = await req.json().catch(() => ({}))
  const { name, email, pin } = body

  const identifier = (email || name || '').trim()
  if (!identifier || !pin) {
    return NextResponse.json({ error: 'Missing credentials' }, { status: 400 })
  }

  const user = await db.user.findFirst({
    where: {
      OR: [
        { email: identifier.toLowerCase() },
        { name: identifier },
      ],
      isActive: true,
    },
  })

  if (!user) {
    recordFailure(ip)
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
  }

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    return NextResponse.json({ error: 'Account temporarily locked' }, { status: 423 })
  }

  const ok = await verifyPin(pin, user.pinHash)
  if (!ok) {
    recordFailure(ip)
    const attempts = user.failedLoginAttempts + 1
    const lockFor = attempts >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : null
    await db.user.update({
      where: { id: user.id },
      data: { failedLoginAttempts: attempts, lockedUntil: lockFor },
    })
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
  }

  // Successful login — clear IP failure counter
  ipFailures.delete(ip)

  await db.user.update({
    where: { id: user.id },
    data: { failedLoginAttempts: 0, lockedUntil: null },
  })

  const token = generateToken(32)
  const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000)

  await db.session.create({
    data: {
      userId: user.id,
      token,
      expiresAt,
      ipAddress: req.headers.get('x-forwarded-for') || '',
      userAgent: req.headers.get('user-agent') || '',
    },
  })

  let permissions: string[] = []
  try { permissions = JSON.parse(user.permissions || '[]') } catch { permissions = [] }

  return NextResponse.json({
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      normalizedRole: normalizeRole(user.role),
      permissions,
      mustChangePin: user.mustChangePin,
      maxDiscount: user.maxDiscount,
      photoDataUrl: user.photoDataUrl,
      defaultStartPage: user.defaultStartPage,
    },
    expiresAt: expiresAt.toISOString(),
  })
}
