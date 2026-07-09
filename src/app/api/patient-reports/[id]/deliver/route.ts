import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getStaffSession } from '@/lib/session'
import { sendWhatsAppMessage, buildReportReadyMessage } from '@/lib/whatsapp'
import { sendEmail } from '@/lib/email'

// POST /api/patient-reports/:id/deliver
// Body: { method: "whatsapp" | "email" | "print" | "portal", recipient?: string }
// For whatsapp: uses WhatsApp Business API (Gupshup/Interakt/Wati/Twilio/Meta)
// For email: uses SMTP (nodemailer)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getStaffSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const { method, recipient } = body as { method: string; recipient?: string }

  if (!method || !['whatsapp', 'email', 'print', 'portal'].includes(method)) {
    return NextResponse.json({ error: 'method must be whatsapp, email, print, or portal' }, { status: 400 })
  }

  const report = await db.patientReport.findUnique({ where: { id } })
  if (!report) return NextResponse.json({ error: 'Report not found' }, { status: 404 })
  if (report.status !== 'approved' && report.status !== 'delivered') {
    return NextResponse.json({ error: `Report must be approved before delivery (current: ${report.status})` }, { status: 400 })
  }

  const clinic = await db.clinic.findFirst()
  const clinicName = clinic?.name || 'Care Diagnostic Centre'
  const portalLink = method === 'portal' ? `${process.env.PUBLIC_BASE_URL || 'http://localhost:3000'}/api/patient-reports/${report.id}/pdf` : undefined

  let deliveryRef: string | undefined

  if (method === 'whatsapp') {
    const phone = recipient || report.patientPhone
    if (!phone) {
      return NextResponse.json({ error: 'Patient has no phone number — cannot send WhatsApp' }, { status: 400 })
    }
    const message = buildReportReadyMessage(clinicName, report.patientName, report.testName, report.reportNumber, portalLink)
    const result = await sendWhatsAppMessage({
      to: phone,
      message,
      templateName: 'report_ready',
      reportId: report.id,
      sentById: session.id,
      sentByName: session.name,
    })
    if (!result.ok) {
      return NextResponse.json({ error: `WhatsApp send failed: ${result.error}`, notificationId: result.notificationId }, { status: 400 })
    }
    deliveryRef = result.notificationId
  } else if (method === 'email') {
    const emailAddr = recipient || report.patientPhone // fallback — in production patient would have email field
    if (!emailAddr) {
      return NextResponse.json({ error: 'No email address provided' }, { status: 400 })
    }
    const subject = `Report Ready — ${report.testName} — ${clinicName}`
    const body_html = `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <div style="background:#10b981; color:white; padding:20px; border-radius:8px 8px 0 0;">
    <h2 style="margin:0;">${clinicName}</h2>
    <p style="margin:5px 0 0; opacity:0.9;">Your report is ready</p>
  </div>
  <div style="border:1px solid #e5e7eb; padding:20px; border-radius:0 0 8px 8px;">
    <p>Dear ${report.patientName},</p>
    <p>Your report for <strong>${report.testName}</strong> is now ready.</p>
    <table style="width:100%; border-collapse:collapse; margin:15px 0;">
      <tr><td style="padding:8px; border:1px solid #e5e7eb; background:#f9fafb;">Report Number</td><td style="padding:8px; border:1px solid #e5e7eb;"><strong>${report.reportNumber}</strong></td></tr>
      <tr><td style="padding:8px; border:1px solid #e5e7eb; background:#f9fafb;">Date</td><td style="padding:8px; border:1px solid #e5e7eb;">${new Date().toLocaleDateString('en-IN')}</td></tr>
      <tr><td style="padding:8px; border:1px solid #e5e7eb; background:#f9fafb;">Test</td><td style="padding:8px; border:1px solid #e5e7eb;">${report.testName}</td></tr>
    </table>
    ${portalLink ? `<p><a href="${portalLink}" style="background:#10b981; color:white; padding:10px 20px; text-decoration:none; border-radius:5px; display:inline-block;">View Report</a></p>` : ''}
    <p style="margin-top:20px; color:#6b7280; font-size:13px;">Thank you for choosing ${clinicName}.</p>
  </div>
</div>`
    const result = await sendEmail({
      to: emailAddr,
      subject,
      body: body_html,
      templateName: 'report_ready',
      reportId: report.id,
      sentById: session.id,
      sentByName: session.name,
    })
    if (!result.ok) {
      return NextResponse.json({ error: `Email send failed: ${result.error}` }, { status: 400 })
    }
    deliveryRef = result.logId
  } else if (method === 'print' || method === 'portal') {
    // No async send — just mark as delivered with the method
    deliveryRef = `print-${Date.now()}`
  }

  // Mark report as delivered
  const updated = await db.patientReport.update({
    where: { id },
    data: {
      status: 'delivered',
      deliveredAt: new Date(),
      deliveryMethod: method,
      deliveryRef,
    },
  })

  return NextResponse.json({
    ok: true,
    report: updated,
    deliveryMethod: method,
    deliveryRef,
  })
}
