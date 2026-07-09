import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// Helper to verify portal session from Authorization header
export async function getPortalSession(req: NextRequest) {
  const auth = req.headers.get('authorization') || ''
  if (!auth.startsWith('Bearer ')) return null
  const token = auth.slice(7).trim()
  if (!token) return null

  const session = await db.patientPortalSession.findUnique({
    where: { token },
  })
  if (!session) return null
  if (session.expiresAt < new Date()) return null

  // Touch last activity
  await db.patientPortalSession.update({
    where: { id: session.id },
    data: { lastActivityAt: new Date() },
  })

  return session
}

// GET /api/portal/me — get patient info
export async function GET(req: NextRequest) {
  const session = await getPortalSession(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const patient = await db.patient.findUnique({
    where: { id: session.patientId },
    select: {
      id: true, patientId: true, name: true, phone: true, email: true,
      age: true, gender: true, address: true, createdAt: true,
    },
  })

  if (!patient) return NextResponse.json({ error: 'Patient not found' }, { status: 404 })

  // Get summary stats
  const [bills, reports, appointments] = await Promise.all([
    db.bill.findMany({ where: { patientId: patient.id, status: { not: 'cancelled' } } }),
    db.patientReport.findMany({ where: { patientId: patient.id } }),
    db.appointment.findMany({ where: { patientId: patient.id } }),
  ])

  const totalBilled = bills.reduce((s, b) => s + b.totalAmount, 0)
  const totalPaid = bills.reduce((s, b) => s + b.paidAmount, 0)
  const outstandingDues = bills.reduce((s, b) => s + b.balanceAmount, 0)
  const reportsReady = reports.filter((r) => r.status === 'delivered' || r.status === 'approved').length
  const upcomingAppointments = appointments.filter((a) => a.status === 'booked' && a.appointmentDate >= new Date().toISOString().slice(0, 10)).length

  return NextResponse.json({
    patient,
    summary: {
      totalVisits: bills.length,
      totalBilled,
      totalPaid,
      outstandingDues,
      reportsReady,
      totalReports: reports.length,
      upcomingAppointments,
    },
  })
}

// DELETE /api/portal/me — logout
export async function DELETE(req: NextRequest) {
  const session = await getPortalSession(req)
  if (session) {
    await db.patientPortalSession.delete({ where: { id: session.id } }).catch(() => {})
  }
  return NextResponse.json({ ok: true })
}
