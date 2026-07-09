import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getStaffSession } from '@/lib/session'
import { sendWhatsAppMessage } from '@/lib/whatsapp'

// POST /api/whatsapp/send
// Body: { to, message, templateName?, billId?, reportId?, appointmentId? }
export async function POST(req: NextRequest) {
  const session = await getStaffSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { to, message, templateName, billId, reportId, appointmentId } = body

  if (!to || !message) {
    return NextResponse.json({ error: 'to and message required' }, { status: 400 })
  }

  const result = await sendWhatsAppMessage({
    to,
    message,
    templateName,
    billId,
    reportId,
    appointmentId,
    sentById: session.id,
    sentByName: session.name,
  })

  if (!result.ok) {
    return NextResponse.json({ error: result.error, notificationId: result.notificationId }, { status: 400 })
  }

  return NextResponse.json({ ok: true, externalId: result.externalId, notificationId: result.notificationId })
}
