import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getPortalSession } from '../me/route'
import { istDateLabel } from '@/lib/auth'

// GET /api/portal/appointments — patient's appointments
export async function GET(req: NextRequest) {
  const session = await getPortalSession(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const appointments = await db.appointment.findMany({
    where: { patientId: session.patientId },
    orderBy: { appointmentDate: 'desc' },
  })
  return NextResponse.json({ appointments })
}

// POST /api/portal/appointments — patient books a new appointment
export async function POST(req: NextRequest) {
  const session = await getPortalSession(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { packageId, testIds, appointmentDate, timeSlot } = body

  if (!appointmentDate || !timeSlot) {
    return NextResponse.json({ error: 'appointmentDate and timeSlot required' }, { status: 400 })
  }
  if (!packageId && (!Array.isArray(testIds) || testIds.length === 0)) {
    return NextResponse.json({ error: 'packageId or testIds required' }, { status: 400 })
  }

  const patient = await db.patient.findUnique({ where: { id: session.patientId } })
  if (!patient) return NextResponse.json({ error: 'Patient not found' }, { status: 404 })

  // Generate appointment ID
  const dateStr = appointmentDate.replace(/-/g, '')
  const counter = await db.appointmentCounter.upsert({
    where: { dateStr },
    update: { counter: { increment: 1 } },
    create: { dateStr, counter: 1 },
  })
  const appointmentId = `APT-${dateStr}-${String(counter.counter).padStart(4, '0')}`

  let packageName: string | null = null
  if (packageId) {
    const pkg = await db.package.findUnique({ where: { id: packageId } })
    if (pkg) packageName = pkg.name
  }

  const appt = await db.appointment.create({
    data: {
      appointmentId,
      patientId: patient.id,
      patientName: patient.name,
      patientPhone: patient.phone || '',
      packageId: packageId || null,
      packageName,
      testIds: testIds ? JSON.stringify(testIds) : null,
      appointmentDate,
      timeSlot,
      status: 'booked',
      source: 'online',
    },
  })

  return NextResponse.json({ appointment: appt })
}
