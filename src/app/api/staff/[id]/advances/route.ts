import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getStaffSession } from '@/lib/session'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getStaffSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const advances = await db.staffAdvance.findMany({
    where: { staffId: id },
    orderBy: { advanceDate: 'desc' },
  })
  return NextResponse.json({ advances })
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getStaffSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const { amount, advanceDate, paymentMode, reason } = body
  if (!amount || amount <= 0) {
    return NextResponse.json({ error: 'Positive amount required' }, { status: 400 })
  }

  const advance = await db.staffAdvance.create({
    data: {
      staffId: id,
      amount: parseFloat(amount),
      advanceDate: advanceDate || new Date().toISOString().slice(0, 10),
      paymentMode: paymentMode || 'cash',
      reason,
      status: 'outstanding',
    },
  })
  return NextResponse.json({ advance })
}
