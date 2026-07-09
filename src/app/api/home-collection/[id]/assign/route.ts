import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getStaffSession } from '@/lib/session'

// POST /api/home-collection/:id/assign — assign phlebotomist
// Body: { phlebotomistId, phlebotomistName }
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getStaffSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const { phlebotomistId, phlebotomistName } = body

  if (!phlebotomistId || !phlebotomistName) {
    return NextResponse.json({ error: 'phlebotomistId and phlebotomistName required' }, { status: 400 })
  }

  const request = await db.homeCollectionRequest.update({
    where: { id },
    data: {
      assignedPhlebotomistId: phlebotomistId,
      assignedPhlebotomistName: phlebotomistName,
      assignedAt: new Date(),
      status: 'assigned',
    },
  })

  return NextResponse.json({ request })
}
