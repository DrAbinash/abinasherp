import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getStaffSession } from '@/lib/session'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ patientId: string }> },
) {
  const session = await getStaffSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { patientId } = await params
  const patient = await db.patient.findUnique({ where: { id: patientId } })
  if (!patient) return NextResponse.json({ error: 'Patient not found' }, { status: 404 })

  let loyalty = await db.loyaltyPoint.findUnique({ where: { patientId } })
  if (!loyalty) {
    loyalty = await db.loyaltyPoint.create({
      data: {
        patientId,
        patientName: patient.name,
        patientPhone: patient.phone,
        points: 0,
        totalEarned: 0,
        totalRedeemed: 0,
        tier: 'bronze',
      },
    })
  }

  const transactions = await db.loyaltyTransaction.findMany({
    where: { patientId },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })

  return NextResponse.json({ loyalty, transactions })
}
