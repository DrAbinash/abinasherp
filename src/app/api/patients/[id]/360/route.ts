import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getStaffSession } from '@/lib/session'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getStaffSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const patient = await db.patient.findUnique({ where: { id } })
  if (!patient) return NextResponse.json({ error: 'Patient not found' }, { status: 404 })

  const [orders, bills, reports, appointments, payments, loyalty] = await Promise.all([
    db.order.findMany({
      where: { patientId: id },
      orderBy: { createdAt: 'desc' },
      include: {
        doctor: true,
        orderTests: { include: { test: true } },
        _count: { select: { bills: true } },
      },
    }),
    db.bill.findMany({
      where: { patientId: id },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { payments: true } } },
    }),
    db.patientReport.findMany({
      where: { patientId: id },
      orderBy: { createdAt: 'desc' },
    }),
    db.appointment.findMany({
      where: { patientId: id },
      orderBy: { appointmentDate: 'desc' },
    }),
    db.payment.findMany({
      where: { bill: { patientId: id } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    }),
    db.loyaltyPoint.findUnique({ where: { patientId: id } }),
  ])

  const lifetimeValue = bills
    .filter((b) => b.status !== 'cancelled')
    .reduce((s, b) => s + b.paidAmount, 0)

  const outstandingDues = bills
    .filter((b) => b.status === 'pending' || b.status === 'partial')
    .reduce((s, b) => s + b.balanceAmount, 0)

  const lastVisitDate = bills.length > 0 ? bills[0].createdAt : null

  const referralDoctor = orders.find((o) => o.doctor)?.doctor || null

  const activeBillsCount = bills.filter((b) => b.status !== 'cancelled').length
  const pendingReportsCount = reports.filter((r) => r.status === 'draft' || r.status === 'pending_review').length
  const completedReportsCount = reports.filter((r) => r.status === 'approved' || r.status === 'delivered').length

  return NextResponse.json({
    patient,
    summary: {
      lifetimeValue,
      outstandingDues,
      lastVisitDate,
      totalOrders: orders.length,
      totalBills: activeBillsCount,
      totalReports: reports.length,
      pendingReports: pendingReportsCount,
      completedReports: completedReportsCount,
      totalAppointments: appointments.length,
      totalPayments: payments.length,
      loyaltyPoints: loyalty?.points || 0,
      loyaltyTier: loyalty?.tier || 'bronze',
    },
    referralDoctor,
    orders,
    bills,
    reports,
    appointments,
    payments,
    loyalty,
  })
}
