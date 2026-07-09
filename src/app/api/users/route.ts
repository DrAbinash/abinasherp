import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getStaffSession } from '@/lib/session'
import { hashPin, DEFAULT_ROLE_PERMISSIONS, normalizeRole, ERP_ROLES } from '@/lib/auth'

export async function GET() {
  const session = await getStaffSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const users = await db.user.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      email: true,
      username: true,
      role: true,
      isActive: true,
      mustChangePin: true,
      remoteLoginEnabled: true,
      maxDiscount: true,
      photoDataUrl: true,
      defaultStartPage: true,
      createdAt: true,
    },
  })
  return NextResponse.json({ users, roles: ERP_ROLES })
}

export async function POST(req: NextRequest) {
  const session = await getStaffSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!session.isOwner) {
    return NextResponse.json({ error: 'Only admin/owner can create users' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const { name, email, username, role, pin, permissions, maxDiscount, photoDataUrl, remoteLoginEnabled, defaultStartPage } = body
  if (!name || !email || !pin) {
    return NextResponse.json({ error: 'name, email, pin required' }, { status: 400 })
  }
  const normalizedRole = normalizeRole(role)
  if (!ERP_ROLES.includes(normalizedRole as never)) {
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
  }
  // Non-super_admin cannot create super_admin
  if (normalizedRole === 'super_admin' && session.normalizedRole !== 'super_admin') {
    return NextResponse.json({ error: 'Cannot create super_admin' }, { status: 403 })
  }

  const existing = await db.user.findUnique({ where: { email: email.toLowerCase() } })
  if (existing) return NextResponse.json({ error: 'Email already in use' }, { status: 400 })

  const perms = permissions || DEFAULT_ROLE_PERMISSIONS[normalizedRole] || ['*']

  const user = await db.user.create({
    data: {
      name,
      email: email.toLowerCase(),
      username: username || null,
      role: normalizedRole,
      pinHash: await hashPin(pin),
      permissions: JSON.stringify(perms),
      maxDiscount: parseFloat(maxDiscount || '0'),
      photoDataUrl,
      remoteLoginEnabled: !!remoteLoginEnabled,
      defaultStartPage,
      mustChangePin: true,
      isActive: true,
    },
    select: { id: true, name: true, email: true, role: true, createdAt: true },
  })

  await db.auditLog.create({
    data: {
      userId: session.id,
      userName: session.name,
      action: 'user_created',
      module: 'users',
      entityId: user.id,
      details: JSON.stringify({ name, email, role: normalizedRole }),
      ipAddress: req.headers.get('x-forwarded-for') || '',
    },
  })

  return NextResponse.json({ user })
}
