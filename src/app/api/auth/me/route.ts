import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getStaffSession } from '@/lib/session'

export async function GET() {
  const session = await getStaffSession()
  if (!session) return NextResponse.json({ authenticated: false }, { status: 401 })
  return NextResponse.json({ authenticated: true, user: session })
}

export async function DELETE(req: NextRequest) {
  const auth = req.headers.get('authorization') || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : ''
  if (token) {
    await db.session.deleteMany({ where: { token } }).catch(() => {})
  }
  return NextResponse.json({ ok: true })
}
