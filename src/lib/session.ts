import { db } from '@/lib/db'
import { headers } from 'next/headers'
import { normalizeRole, FULL_ACCESS_ROLES } from '@/lib/auth'

export interface StaffSession {
  id: string
  name: string
  email: string
  role: string
  normalizedRole: string
  permissions: string[]
  isOwner: boolean
  maxDiscount: number
  isActive: boolean
}

export async function getStaffSession(): Promise<StaffSession | null> {
  const h = await headers()
  const auth = h.get('authorization') || ''
  if (!auth.startsWith('Bearer ')) return null
  const token = auth.slice(7).trim()
  if (!token) return null

  const session = await db.session.findUnique({
    where: { token },
    include: { user: true },
  })
  if (!session) return null
  if (session.expiresAt < new Date()) return null
  if (!session.user.isActive) return null

  // Touch last activity
  await db.session.update({
    where: { id: session.id },
    data: { lastActivityAt: new Date() },
  })

  const normalized = normalizeRole(session.user.role)
  let permissions: string[] = []
  try {
    permissions = JSON.parse(session.user.permissions || '[]')
  } catch {
    permissions = []
  }

  return {
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
    role: session.user.role,
    normalizedRole: normalized,
    permissions,
    isOwner: FULL_ACCESS_ROLES.has(normalized),
    maxDiscount: session.user.maxDiscount,
    isActive: session.user.isActive,
  }
}

export async function requireStaff(): Promise<StaffSession> {
  const s = await getStaffSession()
  if (!s) throw new Error('Unauthorized')
  return s
}

export async function requireOwner(): Promise<StaffSession> {
  const s = await requireStaff()
  if (!s.isOwner) throw new Error('Forbidden: owner role required')
  return s
}

export async function requirePermission(path: string): Promise<StaffSession> {
  const s = await requireStaff()
  if (s.isOwner) return s
  if (s.permissions.includes('*')) return s
  if (s.permissions.includes(path)) return s
  if (s.permissions.some((p) => p.startsWith(path + ':'))) return s
  if (s.permissions.some((p) => path.startsWith(p + '/'))) return s
  throw new Error(`Forbidden: missing permission ${path}`)
}

// Super-admin token verification (USB-gated in reference; here we use a simpler env-based secret)
const SUPER_ADMIN_USB_KEY = process.env.SUPER_ADMIN_USB_KEY

export function isUsbGateEnforced(): boolean {
  return !!SUPER_ADMIN_USB_KEY
}

export function isValidUsbKey(presented?: string | null): boolean {
  if (!SUPER_ADMIN_USB_KEY) return true // gate disabled
  if (!presented) return false
  try {
    const a = Buffer.from(presented)
    const b = Buffer.from(SUPER_ADMIN_USB_KEY)
    if (a.length !== b.length) return false
    return crypto.timingSafeEqual(a, b)
  } catch {
    return false
  }
}

export async function requireSuperAdmin(): Promise<StaffSession> {
  const h = await headers()
  const saToken = h.get('x-sa-token') || ''
  const saUsbKey = h.get('x-sa-usb-key')

  // USB gate
  if (isUsbGateEnforced()) {
    if (!isValidUsbKey(saUsbKey)) {
      // Check if user has remoteLoginEnabled
      const saSession = await db.superAdminSession.findUnique({
        where: { token: saToken },
        include: { user: true },
      })
      if (!saSession || !saSession.isActive || !saSession.user.remoteLoginEnabled) {
        throw new Error('USB key required')
      }
    }
  }

  const saSession = await db.superAdminSession.findUnique({
    where: { token: saToken },
    include: { user: true },
  })
  if (!saSession || !saSession.isActive) throw new Error('Invalid super-admin token')
  if (saSession.expiresAt < new Date()) {
    await db.superAdminSession.update({
      where: { id: saSession.id },
      data: { isActive: false },
    })
    throw new Error('Super-admin token expired')
  }
  if (!saSession.user.isActive) throw new Error('User inactive')
  if (normalizeRole(saSession.user.role) !== 'super_admin') throw new Error('Not a super-admin')

  let permissions: string[] = []
  try {
    permissions = JSON.parse(saSession.user.permissions || '[]')
  } catch {
    permissions = []
  }

  return {
    id: saSession.user.id,
    name: saSession.user.name,
    email: saSession.user.email,
    role: saSession.user.role,
    normalizedRole: 'super_admin',
    permissions,
    isOwner: true,
    maxDiscount: saSession.user.maxDiscount,
    isActive: saSession.user.isActive,
  }
}

import crypto from 'crypto'
