import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getStaffSession } from '@/lib/session'

// POST /api/patient-reports/:id/deliver
// Body: { method: "whatsapp" | "email" | "print", recipient?: string }
// Creates a Notification record (queued for sending) and marks report as delivered
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getStaffSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const { method } = body as { method: string }

  if (!method || !['whatsapp', 'email', 'print', 'portal'].includes(method)) {
    return NextResponse.json({ error: 'method must be whatsapp, email, print, or portal' }, { status: 400 })
  }

  const report = await db.patientReport.findUnique({ where: { id } })
  if (!report) return NextResponse.json({ error: 'Report not found' }, { status: 404 })
  if (report.status !== 'approved' && report.status !== 'delivered') {
    return NextResponse.json({ error: `Report must be approved before delivery (current: ${report.status})` }, { status: 400 })
  }

  // Get clinic info for message
  const clinic = await db.clinic.findFirst()
  const clinicName = clinic?.name || 'Care Diagnostic Centre'

  // Compose message
  const portalLink = method === 'portal' ? `\n\nView report: https://your-portal.example/r/${report.reportNumber}` : ''
  const message = `*${clinicName}*\n\nHello ${report.patientName},\n\nYour report for *${report.testName}* is ready.\nReport Number: ${report.reportNumber}\nDate: ${new Date().toLocaleDateString('en-IN')}${portalLink}\n\nThank you for choosing us.`

  // Create notification
  const notification = await db.notification.create({
    data: {
      channel: method === 'print' ? 'sms' : method,
      recipientPhone: method === 'whatsapp' || method === 'sms' ? (body.recipient || report.patientPhone) : null,
      recipientEmail: method === 'email' ? (body.recipient || null) : null,
      recipientName: report.patientName,
      templateName: 'report_ready',
      message,
      status: 'queued',
      reportId: report.id,
      sentById: session.id,
      sentByName: session.name,
      scheduledAt: new Date(),
    },
  })

  // Mark report as delivered
  await db.patientReport.update({
    where: { id },
    data: {
      status: 'delivered',
      deliveredAt: new Date(),
      deliveryMethod: method,
      deliveryRef: notification.id,
    },
  })

  // In production, this would trigger the WhatsApp Business API / SMS gateway / email service
  // For now we mark as 'sent' immediately (mock delivery)
  await db.notification.update({
    where: { id: notification.id },
    data: {
      status: 'sent',
      sentAt: new Date(),
      externalId: `mock-${Date.now()}`,
    },
  })

  return NextResponse.json({
    ok: true,
    notification,
    report: await db.patientReport.findUnique({ where: { id } }),
  })
}
