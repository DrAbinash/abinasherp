import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getStaffSession } from '@/lib/session'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getStaffSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const { status, reviewNotes } = body

  if (!status || !['approved', 'rejected'].includes(status)) {
    return NextResponse.json({ error: 'status must be approved or rejected' }, { status: 400 })
  }

  const existing = await db.discountApproval.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (existing.status !== 'pending') {
    return NextResponse.json({ error: `Already ${existing.status}` }, { status: 400 })
  }

  const approval = await db.discountApproval.update({
    where: { id },
    data: {
      status,
      reviewNotes: reviewNotes || null,
      reviewedById: session.id,
      reviewedByName: session.name,
      reviewedAt: new Date(),
    },
  })

  return NextResponse.json({ approval })
}
