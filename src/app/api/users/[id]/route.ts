import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getStaffSession } from '@/lib/session'
import { hashPin, normalizeRole, DEFAULT_ROLE_PERMISSIONS } from '@/lib/auth'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getStaffSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const { name, email, username, role, pin, permissions, maxDiscount, photoDataUrl, remoteLoginEnabled, isActive, defaultStartPage } = body

  const target = await db.user.findUnique({ where: { id } })
  if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  // Permission checks
  if (!session.isOwner) {
    if (target.id !== session.id) {
      return NextResponse.json({ error: 'Cannot edit other users' }, { status: 403 })
    }
  }
  // Block non-super_admin editing super_admin rows
  if (normalizeRole(target.role) === 'super_admin' && session.normalizedRole !== 'super_admin') {
    return NextResponse.json({ error: 'Cannot edit super_admin user' }, { status: 403 })
  }
  // Block promoting to super_admin
  if (role && normalizeRole(role) === 'super_admin' && session.normalizedRole !== 'super_admin') {
    return NextResponse.json({ error: 'Cannot promote to super_admin' }, { status: 403 })
  }

  const update: any = {}
  if (name !== undefined) update.name = name
  if (email !== undefined) update.email = (email as string).toLowerCase()
  if (username !== undefined) update.username = username
  if (role !== undefined) update.role = normalizeRole(role)
  if (permissions !== undefined) update.permissions = JSON.stringify(permissions)
  if (maxDiscount !== undefined) update.maxDiscount = parseFloat(maxDiscount)
  if (photoDataUrl !== undefined) update.photoDataUrl = photoDataUrl
  if (remoteLoginEnabled !== undefined) update.remoteLoginEnabled = !!remoteLoginEnabled
  if (isActive !== undefined) update.isActive = !!isActive
  if (defaultStartPage !== undefined) update.defaultStartPage = defaultStartPage
  if (pin) {
    update.pinHash = await hashPin(pin)
    update.mustChangePin = false
  }

  const updated = await db.user.update({
    where: { id },
    data: update,
    select: { id: true, name: true, email: true, role: true, isActive: true, maxDiscount: true },
  })

  await db.auditLog.create({
    data: {
      userId: session.id,
      userName: session.name,
      action: 'user_updated',
      module: 'users',
      entityId: id,
      details: JSON.stringify(update),
      ipAddress: req.headers.get('x-forwarded-for') || '',
    },
  })

  return NextResponse.json({ user: updated })
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getStaffSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!session.isOwner) {
    return NextResponse.json({ error: 'Only admin/owner can delete users' }, { status: 403 })
  }

  const { id } = await params
  const target = await db.user.findUnique({ where: { id } })
  if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 })
  if (normalizeRole(target.role) === 'super_admin' && session.normalizedRole !== 'super_admin') {
    return NextResponse.json({ error: 'Cannot delete super_admin' }, { status: 403 })
  }
  if (target.id === session.id) {
    return NextResponse.json({ error: 'Cannot delete self' }, { status: 400 })
  }

  await db.user.delete({ where: { id } })
  await db.auditLog.create({
    data: {
      userId: session.id,
      userName: session.name,
      action: 'user_deleted',
      module: 'users',
      entityId: id,
      ipAddress: req.headers.get('x-forwarded-for') || '',
    },
  })
  return NextResponse.json({ ok: true })
}

import { DEFAULT_ROLE_PERMISSIONS as _ } from '@/lib/auth'
void _
