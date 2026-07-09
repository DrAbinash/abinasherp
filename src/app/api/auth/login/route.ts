import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { hashPin, verifyPin, generateToken, DEFAULT_ROLE_PERMISSIONS, normalizeRole } from '@/lib/auth'
import { bootstrapAdminIfNeeded } from '@/lib/seed'

export async function POST(req: NextRequest) {
  await bootstrapAdminIfNeeded()

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
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
  }

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    return NextResponse.json({ error: 'Account temporarily locked' }, { status: 423 })
  }

  const ok = await verifyPin(pin, user.pinHash)
  if (!ok) {
    const attempts = user.failedLoginAttempts + 1
    const lockFor = attempts >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : null
    await db.user.update({
      where: { id: user.id },
      data: { failedLoginAttempts: attempts, lockedUntil: lockFor },
    })
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
  }

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
