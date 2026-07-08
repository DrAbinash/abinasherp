import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getStaffSession } from '@/lib/session'
import { istDateLabel } from '@/lib/auth'

// GET /api/reports/daily-collection?date=YYYY-MM-DD
// Comprehensive daily summary — can be emailed/WhatsApp'd to owner each night
export async function GET(req: NextRequest) {
  const session = await getStaffSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const date = searchParams.get('date') || istDateLabel()

  const startOfDay = new Date(date + 'T00:00:00+05:30')
  const endOfDay = new Date(date + 'T23:59:59+05:30')

  const [bills, payments, expenses, refunds, newPatients, appointments] = await Promise.all([
    db.bill.findMany({
      where: { createdAt: { gte: startOfDay, lte: endOfDay }, status: { not: 'cancelled' } },
      include: { patient: true, order: { include: { doctor: true } } },
    }),
    db.payment.findMany({
      where: { createdAt: { gte: startOfDay, lte: endOfDay } },
    }),
    db.expense.findMany({
      where: { expenseDate: date },
    }),
    db.payment.findMany({
      where: { createdAt: { gte: startOfDay, lte: endOfDay }, amount: { lt: 0 } },
    }),
    db.patient.findMany({
      where: { createdAt: { gte: startOfDay, lte: endOfDay } },
    }),
    db.appointment.findMany({
      where: { appointmentDate: date },
    }),
  ])

  // By method breakdown
  const byMethod: Record<string, { count: number; amount: number }> = {}
  for (const p of payments) {
    if (p.amount > 0) {
      if (!byMethod[p.method]) byMethod[p.method] = { count: 0, amount: 0 }
      byMethod[p.method].count++
      byMethod[p.method].amount += p.amount
    }
  }

  // By test (top 10)
  const testCount: Record<string, number> = {}
  for (const b of bills) {
    for (const ot of b.order.orderTests) {
      if (ot.status === 'cancelled') continue
      testCount[ot.test.name || 'Unknown'] = (testCount[ot.test.name || 'Unknown'] || 0) + 1
    }
  }
  // Actually need to load orderTests
  const billsWithTests = await db.bill.findMany({
    where: { createdAt: { gte: startOfDay, lte: endOfDay }, status: { not: 'cancelled' } },
    include: { order: { include: { orderTests: { include: { test: true } } } } },
  })
  const testCount2: Record<string, number> = {}
  for (const b of billsWithTests) {
    for (const ot of b.order.orderTests) {
      if (ot.status === 'cancelled') continue
      testCount2[ot.test.name] = (testCount2[ot.test.name] || 0) + 1
    }
  }
  const topTests = Object.entries(testCount2)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)

  // Doctor-wise (referral breakdown)
  const doctorBreakdown: Record<string, { patientCount: number; revenue: number }> = {}
  for (const b of bills) {
    const docName = b.order.doctor?.name || 'Walk-in'
    if (!doctorBreakdown[docName]) doctorBreakdown[docName] = { patientCount: 0, revenue: 0 }
    doctorBreakdown[docName].patientCount++
    doctorBreakdown[docName].revenue += b.totalAmount
  }

  // Status-wise appointments
  const apptStatus: Record<string, number> = {}
  for (const a of appointments) {
    apptStatus[a.status] = (apptStatus[a.status] || 0) + 1
  }

  const totalCollected = payments.filter((p) => p.amount > 0).reduce((s, p) => s + p.amount, 0)
  const totalRefunds = refunds.reduce((s, p) => s + Math.abs(p.amount), 0)
  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0)
  const totalBilled = bills.reduce((s, b) => s + b.totalAmount, 0)
  const netCash = (byMethod.cash?.amount || 0) - refunds.filter((r) => r.method === 'cash').reduce((s, r) => s + Math.abs(r.amount), 0) - expenses.filter((e) => e.paymentMode === 'cash').reduce((s, e) => s + e.amount, 0)

  const summary = {
    date,
    totalBills: bills.length,
    totalBilled,
    totalCollected,
    totalRefunds,
    totalExpenses,
    netCash,
    netCollection: totalCollected - totalRefunds - totalExpenses,
    newPatients: newPatients.length,
    totalAppointments: appointments.length,
    byMethod,
    topTests,
    doctorBreakdown: Object.entries(doctorBreakdown).map(([name, v]) => ({ doctor: name, ...v })),
    appointmentStatus: apptStatus,
    expenses: expenses.map((e) => ({ expenseId: e.expenseId, category: e.category, description: e.description, amount: e.amount, paymentMode: e.paymentMode })),
    bills: bills.map((b) => ({
      billNumber: b.billNumber,
      patientName: b.patient.name,
      doctorName: b.order.doctor?.name || 'Walk-in',
      totalAmount: b.totalAmount,
      paidAmount: b.paidAmount,
      balanceAmount: b.balanceAmount,
      status: b.status,
      createdAt: b.createdAt,
    })),
  }

  // Generate WhatsApp/email-ready text
  const clinic = await db.clinic.findFirst()
  const clinicName = clinic?.name || 'Care Diagnostic Centre'
  const messageText = `*${clinicName} — Daily Collection Report*
Date: ${date}

📊 SUMMARY
Bills: ${summary.totalBills}
Billed: ₹${summary.totalBilled.toFixed(2)}
Collected: ₹${summary.totalCollected.toFixed(2)}
Refunds: ₹${summary.totalRefunds.toFixed(2)}
Expenses: ₹${summary.totalExpenses.toFixed(2)}
Net Cash: ₹${summary.netCash.toFixed(2)}
Net Collection: ₹${summary.netCollection.toFixed(2)}

💳 BY METHOD
${Object.entries(byMethod).map(([m, v]) => `${m.toUpperCase()}: ${v.count} txns · ₹${v.amount.toFixed(2)}`).join('\n')}

👥 NEW PATIENTS: ${summary.newPatients}
📅 APPOINTMENTS: ${summary.totalAppointments} (${apptStatus.booked || 0} booked, ${apptStatus.completed || 0} completed, ${apptStatus.cancelled || 0} cancelled)

🩺 TOP TESTS
${topTests.slice(0, 5).map((t, i) => `${i + 1}. ${t.name}: ${t.count}`).join('\n')}`

  return NextResponse.json({ summary, messageText })
}
