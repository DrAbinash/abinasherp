import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getStaffSession } from '@/lib/session'

function computeTier(points: number): string {
  if (points >= 10000) return 'platinum'
  if (points >= 5000) return 'gold'
  if (points >= 1000) return 'silver'
  return 'bronze'
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ patientId: string }> },
) {
  const session = await getStaffSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { patientId } = await params
  const patient = await db.patient.findUnique({ where: { id: patientId } })
  if (!patient) return NextResponse.json({ error: 'Patient not found' }, { status: 404 })

  const body = await req.json().catch(() => ({}))
  const { type, points, reason, billId, billNumber, redemptionValue } = body

  if (!type || !['earn', 'redeem', 'adjust', 'expire'].includes(type)) {
    return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
  }
  const pts = parseInt(points)
  if (isNaN(pts) || pts === 0) {
    return NextResponse.json({ error: 'points (non-zero integer) required' }, { status: 400 })
  }

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

  let newPoints = loyalty.points
  let newEarned = loyalty.totalEarned
  let newRedeemed = loyalty.totalRedeemed

  if (type === 'earn') {
    newPoints += Math.abs(pts)
    newEarned += Math.abs(pts)
  } else if (type === 'redeem') {
    const deduct = Math.abs(pts)
    if (deduct > newPoints) {
      return NextResponse.json({ error: 'Insufficient points' }, { status: 400 })
    }
    newPoints -= deduct
    newRedeemed += deduct
  } else if (type === 'adjust') {
    newPoints += pts
    if (pts > 0) newEarned += pts
    else newRedeemed += Math.abs(pts)
  } else if (type === 'expire') {
    const deduct = Math.abs(pts)
    newPoints = Math.max(0, newPoints - deduct)
  }

  const newTier = computeTier(newPoints)
  const previousTier = loyalty.tier

  const tx = await db.$transaction(async (prisma) => {
    const transaction = await prisma.loyaltyTransaction.create({
      data: {
        patientId,
        type,
        points: type === 'earn' ? Math.abs(pts) : (type === 'redeem' || type === 'expire' ? -Math.abs(pts) : pts),
        reason: reason || null,
        billId: billId || null,
        billNumber: billNumber || null,
        redemptionValue: redemptionValue ? parseFloat(redemptionValue) : 0,
        performedById: session.id,
        performedByName: session.name,
      },
    })

    const updatedLoyalty = await prisma.loyaltyPoint.update({
      where: { patientId },
      data: {
        points: newPoints,
        totalEarned: newEarned,
        totalRedeemed: newRedeemed,
        tier: newTier,
      },
    })

    return { transaction, loyalty: updatedLoyalty }
  })

  return NextResponse.json({
    transaction: tx.transaction,
    loyalty: tx.loyalty,
    tierUpgraded: newTier !== previousTier,
    previousTier,
    newTier,
  })
}
