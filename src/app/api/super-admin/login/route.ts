import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyPin, generateToken, normalizeRole } from '@/lib/auth'
import { isUsbGateEnforced, isValidUsbKey } from '@/lib/session'

const SUPER_ADMIN_USB_PIN = process.env.SUPER_ADMIN_USB_PIN

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const { name, pin, usbPin } = body

  if (!name || !pin) {
    return NextResponse.json({ error: 'Missing credentials' }, { status: 400 })
  }

  const user = await db.user.findFirst({
    where: {
      OR: [{ email: name.toLowerCase() }, { name }],
      isActive: true,
    },
  })

  if (!user) return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
  if (normalizeRole(user.role) !== 'super_admin') {
    return NextResponse.json({ error: 'Not a super-admin account' }, { status: 403 })
  }

  if (isUsbGateEnforced()) {
    const usbKeyHeader = req.headers.get('x-sa-usb-key')
    if (!isValidUsbKey(usbKeyHeader) && !user.remoteLoginEnabled) {
      return NextResponse.json({ error: 'USB key required' }, { status: 401 })
    }
  }

  // The per-user PIN (bcrypt) is ALWAYS verified — no shared-secret bypass.
  const ok = await verifyPin(pin, user.pinHash)
  if (!ok) return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })

  // If USB PIN gating is configured, it applies IN ADDITION to the user PIN.
  if (SUPER_ADMIN_USB_PIN && usbPin !== SUPER_ADMIN_USB_PIN) {
    return NextResponse.json({ error: 'Invalid USB PIN' }, { status: 401 })
  }

  const token = generateToken(48)
  const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000)

  await db.superAdminSession.create({
    data: { token, userId: user.id, expiresAt, isActive: true },
  })

  return NextResponse.json({
    token,
    userName: user.name,
    expiresAt: expiresAt.toISOString(),
  })
}
