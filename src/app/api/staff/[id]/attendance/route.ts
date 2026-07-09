import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getStaffSession } from '@/lib/session'
import { istDateLabel } from '@/lib/auth'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getStaffSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const attendance = await db.staffAttendance.findMany({
    where: { staffId: id },
    orderBy: { attendanceDate: 'desc' },
    take: 60,
  })
  return NextResponse.json({ attendance })
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getStaffSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const { type } = body // 'in' | 'out'
  const today = istDateLabel()

  if (type === 'in') {
    // Punch in: insert if not exists, else update punchIn only if NULL
    const existing = await db.staffAttendance.findUnique({
      where: { staffId_attendanceDate: { staffId: id, attendanceDate: today } },
    })
    if (existing) {
      if (!existing.punchIn) {
        const updated = await db.staffAttendance.update({
          where: { id: existing.id },
          data: { punchIn: new Date() },
        })
        return NextResponse.json({ attendance: updated })
      }
      return NextResponse.json({ attendance: existing, message: 'Already punched in' })
    }
    const attendance = await db.staffAttendance.create({
      data: { staffId: id, attendanceDate: today, punchIn: new Date() },
    })
    return NextResponse.json({ attendance })
  } else if (type === 'out') {
    const existing = await db.staffAttendance.findUnique({
      where: { staffId_attendanceDate: { staffId: id, attendanceDate: today } },
    })
    if (!existing || !existing.punchIn) {
      return NextResponse.json({ error: 'No punch-in record found' }, { status: 400 })
    }
    if (existing.punchOut) {
      return NextResponse.json({ attendance: existing, message: 'Already punched out' })
    }
    const updated = await db.staffAttendance.update({
      where: { id: existing.id },
      data: { punchOut: new Date() },
    })
    return NextResponse.json({ attendance: updated })
  } else {
    return NextResponse.json({ error: 'type must be in or out' }, { status: 400 })
  }
}
