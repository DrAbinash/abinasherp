import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getStaffSession } from '@/lib/session'
import { istDateLabel } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const session = await getStaffSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const date = searchParams.get('date') || istDateLabel()
  const status = searchParams.get('status') || ''

  const where: Record<string, unknown> = { appointmentDate: date }
  if (status) where.status = status

  const appointments = await db.appointment.findMany({
    where,
    orderBy: { timeSlot: 'asc' },
  })
  return NextResponse.json({ appointments, date })
}

export async function POST(req: NextRequest) {
  const session = await getStaffSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { patientId, patientName, patientPhone, packageId, packageName, testIds, appointmentDate, timeSlot, durationMin, notes, source, isFasting } = body

  if (!patientName || !appointmentDate || !timeSlot) {
    return NextResponse.json({ error: 'patientName, appointmentDate, timeSlot required' }, { status: 400 })
  }

  // Generate APT-YYYYMMDD-####
  const dateStr = appointmentDate.replace(/-/g, '')
  const counter = await db.appointmentCounter.upsert({
    where: { dateStr },
    update: { counter: { increment: 1 } },
    create: { dateStr, counter: 1 },
  })
  const appointmentId = `APT-${dateStr}-${String(counter.counter).padStart(4, '0')}`

  const appt = await db.appointment.create({
    data: {
      appointmentId,
      patientId: patientId || null,
      patientName,
      patientPhone: patientPhone || null,
      packageId: packageId || null,
      packageName: packageName || null,
      testIds: testIds ? JSON.stringify(testIds) : null,
      appointmentDate,
      timeSlot,
      durationMin: parseInt(durationMin || '30'),
      notes,
      source: source || 'walk-in',
      isFasting: !!isFasting,
      status: 'booked',
    },
  })

  // Schedule reminder notification (if phone provided)
  if (patientPhone) {
    const clinic = await db.clinic.findFirst()
    const clinicName = clinic?.name || 'Care Diagnostic Centre'
    const message = `*${clinicName}*\n\nHello ${patientName},\nYour appointment is confirmed for ${appointmentDate} at ${timeSlot}.${packageName ? `\nPackage: ${packageName}` : ''}${isFasting ? '\n\n*FASTING REQUIRED* — please do not eat or drink (except water) for 8-10 hours before the test.' : ''}\n\nThank you.`

    await db.notification.create({
      data: {
        channel: 'whatsapp',
        recipientPhone: patientPhone,
        recipientName: patientName,
        templateName: 'appointment_reminder',
        message,
        status: 'queued',
        appointmentId: appt.id,
        sentById: session.id,
        sentByName: session.name,
        scheduledAt: new Date(),
      },
    })
  }

  return NextResponse.json({ appointment: appt })
}
