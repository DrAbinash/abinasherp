import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getStaffSession } from '@/lib/session'

// POST /api/notifications/send
// Body: { channel: "whatsapp" | "sms" | "email", recipientPhone?, recipientEmail?, recipientName?, templateName, message }
export async function POST(req: NextRequest) {
  const session = await getStaffSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { channel, recipientPhone, recipientEmail, recipientName, templateName, message } = body

  if (!channel || !message) {
    return NextResponse.json({ error: 'channel and message required' }, { status: 400 })
  }
  if (channel === 'whatsapp' || channel === 'sms') {
    if (!recipientPhone) return NextResponse.json({ error: 'recipientPhone required for whatsapp/sms' }, { status: 400 })
  }
  if (channel === 'email' && !recipientEmail) {
    return NextResponse.json({ error: 'recipientEmail required for email' }, { status: 400 })
  }

  // In production, this would integrate with:
  // - WhatsApp Business API (Twilio, MessageBird, Gupshup, Interakt, Wati)
  // - SMS gateway (MSG91, Textlocal, Twilio)
  // - Email (SendGrid, Amazon SES, Mailgun)
  // For now we mock the send and mark as 'sent'

  const notification = await db.notification.create({
    data: {
      channel,
      recipientPhone: recipientPhone || null,
      recipientEmail: recipientEmail || null,
      recipientName: recipientName || null,
      templateName: templateName || 'custom',
      message,
      status: 'queued',
      sentById: session.id,
      sentByName: session.name,
      scheduledAt: new Date(),
    },
  })

  // Mock send (would be async in production)
  await db.notification.update({
    where: { id: notification.id },
    data: {
      status: 'sent',
      sentAt: new Date(),
      externalId: `mock-${Date.now()}`,
      attempts: 1,
    },
  })

  const updated = await db.notification.findUnique({ where: { id: notification.id } })
  return NextResponse.json({ notification: updated })
}
