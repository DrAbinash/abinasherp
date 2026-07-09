import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getStaffSession } from '@/lib/session'
import { istDateLabel } from '@/lib/auth'
import { sendEmail } from '@/lib/email'
import { sendWhatsAppMessage, buildDailySummaryMessage } from '@/lib/whatsapp'

// GET /api/reports/daily-collection?date=YYYY-MM-DD&send=email|whatsapp|both
// Comprehensive daily summary. With ?send=email → actually sends via SMTP.
// With ?send=whatsapp → sends via WhatsApp to admin phone.
// With ?send=both → sends both.
export async function GET(req: NextRequest) {
  const session = await getStaffSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const date = searchParams.get('date') || istDateLabel()
  const send = searchParams.get('send') || '' // email | whatsapp | both

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

  // By test (top 10) — load orderTests
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

  // If send requested, actually send the email/WhatsApp
  let emailResult: any = null
  let whatsappResult: any = null
  if (send === 'email' || send === 'both') {
    const emailSettings = await db.emailSettings.findUnique({ where: { id: 1 } })
    if (emailSettings && emailSettings.smtpHost && emailSettings.adminEmail) {
      const extras: string[] = (() => { try { return JSON.parse(emailSettings.extraRecipients || '[]') } catch { return [] } })()
      const recipients = [emailSettings.adminEmail, ...extras].filter(Boolean)
      const subject = `[Daily Summary] ${date} — Collected ₹${totalCollected.toFixed(2)}`
      const htmlBody = `<pre style="font-family: Arial, sans-serif; white-space: pre-wrap; font-size: 13px; line-height: 1.5;">${messageText}</pre>`
      emailResult = await sendEmail({
        to: recipients,
        subject,
        body: htmlBody,
        templateName: 'daily_summary',
        sentById: session.id,
        sentByName: session.name,
      })
    } else {
      emailResult = { ok: false, error: 'SMTP not configured' }
    }
  }
  if (send === 'whatsapp' || send === 'both') {
    const waSettings = await db.whatsAppSettings.findUnique({ where: { id: 1 } })
    if (waSettings && waSettings.isEnabled) {
      // Send to admin phone (stored in phoneNumber field, or pull from clinic settings)
      const adminPhone = waSettings.phoneNumber // sender phone — for daily summary, send to admin's personal WhatsApp
      // In production, admin phone would be a separate field. For now, use the clinic phone.
      const clinic = await db.clinic.findFirst()
      const recipientPhone = clinic?.phone?.replace(/[^\d]/g, '') || ''
      if (recipientPhone) {
        const waMessage = buildDailySummaryMessage(clinic?.name || 'Care ERP', date, {
          totalBills: summary.totalBills,
          totalBilled: summary.totalBilled,
          totalCollected: summary.totalCollected,
          totalRefunds: summary.totalRefunds,
          totalExpenses: summary.totalExpenses,
          netCash: summary.netCash,
          byMethod: Object.fromEntries(Object.entries(byMethod).map(([k, v]) => [k, v.amount])),
          newPatients: summary.newPatients,
          appointments: summary.totalAppointments,
        })
        whatsappResult = await sendWhatsAppMessage({
          to: recipientPhone,
          message: waMessage,
          templateName: 'daily_summary',
          sentById: session.id,
          sentByName: session.name,
        })
      } else {
        whatsappResult = { ok: false, error: 'No admin phone configured' }
      }
    } else {
      whatsappResult = { ok: false, error: 'WhatsApp not enabled' }
    }
  }

  // Log to DailySummaryLog
  await db.dailySummaryLog.upsert({
    where: { summaryDate: date },
    update: {
      emailSent: emailResult?.ok || false,
      emailLogId: emailResult?.logId || null,
      whatsappSent: whatsappResult?.ok || false,
      whatsappLogId: whatsappResult?.notificationId || null,
      totalCollected,
      totalBilled,
      totalExpenses,
      billsCount: bills.length,
      sentAt: new Date(),
    },
    create: {
      summaryDate: date,
      emailSent: emailResult?.ok || false,
      emailLogId: emailResult?.logId || null,
      whatsappSent: whatsappResult?.ok || false,
      whatsappLogId: whatsappResult?.notificationId || null,
      totalCollected,
      totalBilled,
      totalExpenses,
      billsCount: bills.length,
      sentAt: new Date(),
    },
  }).catch(() => {})

  return NextResponse.json({
    summary,
    messageText,
    delivery: {
      email: emailResult,
      whatsapp: whatsappResult,
    },
  })
}
