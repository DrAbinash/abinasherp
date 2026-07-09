import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getStaffSession } from '@/lib/session'

export async function GET() {
  const session = await getStaffSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!session.isOwner) return NextResponse.json({ error: 'Forbidden: owner role required' }, { status: 403 })

  const refunds = await db.refundRequest.findMany({
    orderBy: { createdAt: 'desc' },
    take: 100,
    // No FK relation to Bill on RefundRequest — callers fetch bill details separately.
  })
  return NextResponse.json({ refunds })
}

export async function POST(req: NextRequest) {
  const session = await getStaffSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!session.isOwner) return NextResponse.json({ error: 'Forbidden: owner role required' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const { billId, paymentId, amount, reason } = body
  if (!amount || amount <= 0) {
    return NextResponse.json({ error: 'Positive amount required' }, { status: 400 })
  }

  const refund = await db.refundRequest.create({
    data: {
      billId,
      paymentId,
      amount: parseFloat(amount),
      reason,
      requestedById: session.id,
      requestedByName: session.name,
      status: 'requested',
    },
  })
  return NextResponse.json({ refund })
}
