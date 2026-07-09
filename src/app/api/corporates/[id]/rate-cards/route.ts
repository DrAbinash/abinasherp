import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getStaffSession } from '@/lib/session'

// GET /api/corporates/:id/rate-cards — list negotiated rates
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getStaffSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const rateCards = await db.corporateRateCard.findMany({
    where: { corporateId: id, isActive: true },
    include: { test: { select: { id: true, name: true, code: true, price: true } } },
  })
  return NextResponse.json({ rateCards })
}

// PUT /api/corporates/:id/rate-cards — bulk upsert rate cards
// Body: [{ testId, negotiatedPrice }, ...]
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getStaffSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!session.isOwner) return NextResponse.json({ error: 'Admin only' }, { status: 403 })

  const { id } = await params
  const body = await req.json().catch(() => [])
  if (!Array.isArray(body)) return NextResponse.json({ error: 'Expected array' }, { status: 400 })

  // Upsert each rate card
  for (const rc of body) {
    if (!rc.testId) continue
    await db.corporateRateCard.upsert({
      where: { corporateId_testId: { corporateId: id, testId: rc.testId } },
      update: { negotiatedPrice: parseFloat(rc.negotiatedPrice) },
      create: {
        corporateId: id,
        testId: rc.testId,
        negotiatedPrice: parseFloat(rc.negotiatedPrice),
      },
    })
  }

  const rateCards = await db.corporateRateCard.findMany({
    where: { corporateId: id, isActive: true },
    include: { test: { select: { name: true, code: true, price: true } } },
  })
  return NextResponse.json({ rateCards })
}

// DELETE /api/corporates/:id/rate-cards?rateCardId=... — delete single rate card
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getStaffSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { searchParams } = new URL(req.url)
  const rateCardId = searchParams.get('rateCardId')
  if (rateCardId) {
    await db.corporateRateCard.update({ where: { id: rateCardId }, data: { isActive: false } })
  }
  return NextResponse.json({ ok: true })
}
