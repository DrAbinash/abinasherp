import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getStaffSession } from '@/lib/session'

export async function GET(req: NextRequest) {
  const session = await getStaffSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status') || ''

  const where: Record<string, unknown> = {}
  if (status) where.status = status

  const approvals = await db.discountApproval.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 200,
  })
  return NextResponse.json({ approvals })
}

export async function POST(req: NextRequest) {
  const session = await getStaffSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const {
    billId, billNumber, patientName, requestedDiscount, requestedDiscountPercent,
    reason, requestedById, requestedByName,
  } = body

  if (reason === undefined || requestedDiscount === undefined) {
    return NextResponse.json({ error: 'requestedDiscount and reason required' }, { status: 400 })
  }

  const approval = await db.discountApproval.create({
    data: {
      billId: billId || null,
      billNumber: billNumber || null,
      patientName: patientName || null,
      requestedDiscount: parseFloat(requestedDiscount),
      requestedDiscountPercent: parseFloat(requestedDiscountPercent || '0'),
      reason,
      status: 'pending',
      requestedById: requestedById || session.id,
      requestedByName: requestedByName || session.name,
    },
  })

  return NextResponse.json({ approval })
}
