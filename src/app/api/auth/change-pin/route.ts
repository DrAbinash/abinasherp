import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { hashPin, verifyPin } from '@/lib/auth'
import { getStaffSession } from '@/lib/session'

export async function POST(req: NextRequest) {
  const session = await getStaffSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { currentPin, newPin } = body
  if (!currentPin || !newPin || newPin.length < 4) {
    return NextResponse.json({ error: 'PIN must be at least 4 characters' }, { status: 400 })
  }

  const user = await db.user.findUnique({ where: { id: session.id } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const ok = await verifyPin(currentPin, user.pinHash)
  if (!ok) return NextResponse.json({ error: 'Current PIN incorrect' }, { status: 401 })

  await db.user.update({
    where: { id: user.id },
    data: { pinHash: await hashPin(newPin), mustChangePin: false },
  })

  return NextResponse.json({ ok: true })
}
