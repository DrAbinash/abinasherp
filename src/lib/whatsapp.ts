import { db } from '@/lib/db'

// ============================================================
// WHATSAPP BUSINESS API INTEGRATION
// Supports: Gupshup, Interakt, Wati, Twilio, Meta Cloud API
// ============================================================

export async function getWhatsAppSettings() {
  const s = await db.whatsAppSettings.findUnique({ where: { id: 1 } })
  if (!s) return null
  const clean = (v: string | null | undefined): string => {
    if (!v || v === 'NA' || v === 'null') return ''
    return v
  }
  return {
    ...s,
    apiKey: clean(s.apiKey),
    apiSecret: clean(s.apiSecret),
    phoneNumber: clean(s.phoneNumber),
    templateNamespace: clean(s.templateNamespace),
  }
}

// Send a WhatsApp text message via the configured provider
export async function sendWhatsAppMessage({
  to,
  message,
  templateName,
  billId,
  reportId,
  appointmentId,
  sentById,
  sentByName,
}: {
  to: string // phone with country code, no +
  message: string
  templateName?: string
  billId?: string
  reportId?: string
  appointmentId?: string
  sentById?: string
  sentByName?: string
}): Promise<{ ok: boolean; externalId?: string; error?: string; notificationId?: string }> {
  const settings = await getWhatsAppSettings()

  // Create notification record (regardless of whether send succeeds)
  const notification = await db.notification.create({
    data: {
      channel: 'whatsapp',
      recipientPhone: to,
      templateName: templateName || 'custom',
      message,
      status: 'queued',
      billId: billId || null,
      reportId: reportId || null,
      appointmentId: appointmentId || null,
      sentById: sentById || null,
      sentByName: sentByName || null,
      scheduledAt: new Date(),
    },
  })

  if (!settings || !settings.isEnabled || !settings.apiKey || !settings.phoneNumber) {
    await db.notification.update({
      where: { id: notification.id },
      data: { status: 'failed', errorMessage: 'WhatsApp not configured or disabled' },
    })
    return { ok: false, error: 'WhatsApp not configured or disabled', notificationId: notification.id }
  }

  // Normalize recipient phone (strip +, spaces, dashes; ensure country code)
  const normalizedTo = to.replace(/[+\s\-()]/g, '')
  const recipient = normalizedTo.startsWith('91') ? normalizedTo : (normalizedTo.length === 10 ? `91${normalizedTo}` : normalizedTo)

  try {
    let externalId = ''
    let success = false

    if (settings.provider === 'gupshup') {
      // Gupshup WhatsApp API
      // POST https://api.gupshup.io/sm/api/v1/msg
      // Headers: api-key
      // Body (form-urlencoded): channel=whatsapp, source, destination, message, src.name
      const res = await fetch('https://api.gupshup.io/sm/api/v1/msg', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'apikey': settings.apiKey,
        },
        body: new URLSearchParams({
          channel: 'whatsapp',
          source: settings.phoneNumber,
          destination: recipient,
          message,
          'src.name': settings.templateNamespace || 'CareERP',
        }),
      })
      const data = await res.json().catch(() => ({}))
      success = res.ok && data.status === 'submitted' || res.ok
      externalId = data.messageId || data.id || ''
      if (!success) {
        await db.notification.update({
          where: { id: notification.id },
          data: { status: 'failed', errorMessage: JSON.stringify(data).slice(0, 500), attempts: 1 },
        })
        return { ok: false, error: data.message || 'Gupshup send failed', notificationId: notification.id }
      }
    } else if (settings.provider === 'interakt') {
      // Interakt WhatsApp API
      // POST https://api.interakt.ai/v1/public/message/
      // Headers: Authorization: Basic <api_key>
      // Body: JSON { countryCode, phoneNumber, type, data }
      const countryCode = recipient.slice(0, 2)
      const phone = recipient.slice(2)
      const res = await fetch('https://api.interakt.ai/v1/public/message/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${settings.apiKey}`,
        },
        body: JSON.stringify({
          countryCode,
          phoneNumber: phone,
          type: 'Text',
          data: { message },
        }),
      })
      const data = await res.json().catch(() => ({}))
      success = res.ok && (data.result === true || data.success === true || res.status === 200)
      externalId = data.id || data.messageId || ''
      if (!success) {
        await db.notification.update({
          where: { id: notification.id },
          data: { status: 'failed', errorMessage: JSON.stringify(data).slice(0, 500), attempts: 1 },
        })
        return { ok: false, error: data.message || 'Interakt send failed', notificationId: notification.id }
      }
    } else if (settings.provider === 'wati') {
      // Wati WhatsApp API
      // POST https://live-server-<instance-id>.wati.chat/api/v1/sendTextMessage?whatsappNumber=<number>
      // Headers: Authorization: Bearer <token>
      const res = await fetch(`https://live-server.wati.chat/api/v1/sendTextMessage?whatsappNumber=${recipient}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${settings.apiKey}`,
        },
        body: JSON.stringify({ text: message }),
      })
      const data = await res.json().catch(() => ({}))
      success = res.ok && data.result === true
      externalId = data.id || ''
      if (!success) {
        await db.notification.update({
          where: { id: notification.id },
          data: { status: 'failed', errorMessage: JSON.stringify(data).slice(0, 500), attempts: 1 },
        })
        return { ok: false, error: data.message || 'Wati send failed', notificationId: notification.id }
      }
    } else if (settings.provider === 'twilio') {
      // Twilio WhatsApp API
      // POST https://api.twilio.com/2010-04-01/Accounts/<SID>/Messages.json
      // Headers: Authorization: Basic base64(SID:token)
      // Body (form): From=whatsapp:+<number>, To=whatsapp:+<number>, Body=<message>
      const sid = settings.apiKey
      const token = settings.apiSecret
      const auth = Buffer.from(`${sid}:${token}`).toString('base64')
      const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${auth}`,
        },
        body: new URLSearchParams({
          From: `whatsapp:+${settings.phoneNumber}`,
          To: `whatsapp:+${recipient}`,
          Body: message,
        }),
      })
      const data = await res.json().catch(() => ({}))
      success = res.ok && !!data.sid
      externalId = data.sid || ''
      if (!success) {
        await db.notification.update({
          where: { id: notification.id },
          data: { status: 'failed', errorMessage: data.message || 'Twilio send failed', attempts: 1 },
        })
        return { ok: false, error: data.message || 'Twilio send failed', notificationId: notification.id }
      }
    } else if (settings.provider === 'meta') {
      // Meta WhatsApp Cloud API
      // POST https://graph.facebook.com/v18.0/<phone_number_id>/messages
      // Headers: Authorization: Bearer <token>
      // Body: JSON { messaging_product, recipient_type, to, type, text }
      const phoneNumberId = settings.phoneNumber
      const res = await fetch(`https://graph.facebook.com/v18.0/${phoneNumberId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${settings.apiKey}`,
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: recipient,
          type: 'text',
          text: { body: message },
        }),
      })
      const data = await res.json().catch(() => ({}))
      success = res.ok && !!data.messages?.[0]?.id
      externalId = data.messages?.[0]?.id || ''
      if (!success) {
        await db.notification.update({
          where: { id: notification.id },
          data: { status: 'failed', errorMessage: JSON.stringify(data.error || data).slice(0, 500), attempts: 1 },
        })
        return { ok: false, error: data.error?.message || 'Meta send failed', notificationId: notification.id }
      }
    } else {
      await db.notification.update({
        where: { id: notification.id },
        data: { status: 'failed', errorMessage: `Unknown provider: ${settings.provider}`, attempts: 1 },
      })
      return { ok: false, error: `Unknown provider: ${settings.provider}`, notificationId: notification.id }
    }

    // Success — update notification
    await db.notification.update({
      where: { id: notification.id },
      data: {
        status: 'sent',
        externalId,
        sentAt: new Date(),
        attempts: 1,
      },
    })

    return { ok: true, externalId, notificationId: notification.id }
  } catch (e: any) {
    await db.notification.update({
      where: { id: notification.id },
      data: { status: 'failed', errorMessage: e.message, attempts: 1 },
    })
    return { ok: false, error: e.message, notificationId: notification.id }
  }
}

// ============================================================
// MESSAGE TEMPLATES
// ============================================================

export function buildReportReadyMessage(clinicName: string, patientName: string, testName: string, reportNumber: string, portalLink?: string): string {
  return `*${clinicName}*

Hello ${patientName},

Your report for *${testName}* is ready.

Report Number: ${reportNumber}
Date: ${new Date().toLocaleDateString('en-IN')}
${portalLink ? `\nView Report: ${portalLink}` : ''}

Thank you for choosing us.`
}

export function buildBillCreatedMessage(clinicName: string, patientName: string, billNumber: string, totalAmount: number, paidAmount: number, balance: number): string {
  return `*${clinicName}*

Hello ${patientName},

Your bill has been generated.

Bill Number: ${billNumber}
Total Amount: ₹${totalAmount.toFixed(2)}
Paid: ₹${paidAmount.toFixed(2)}
${balance > 0 ? `Balance Due: ₹${balance.toFixed(2)}` : 'Status: PAID ✅'}

Thank you for choosing us.`
}

export function buildAppointmentReminderMessage(clinicName: string, patientName: string, appointmentDate: string, timeSlot: string, packageName?: string, fastingRequired?: boolean): string {
  return `*${clinicName}*

Hello ${patientName},

Your appointment is confirmed.

Date: ${appointmentDate}
Time: ${timeSlot}
${packageName ? `Package: ${packageName}` : ''}
${fastingRequired ? '\n⚠️ *FASTING REQUIRED* — Please do not eat or drink (except water) for 8-10 hours before the test.' : ''}

Please arrive 10 minutes early.

Thank you.`
}

export function buildDailySummaryMessage(clinicName: string, date: string, data: {
  totalBills: number; totalBilled: number; totalCollected: number
  totalRefunds: number; totalExpenses: number; netCash: number
  byMethod: Record<string, number>; newPatients: number; appointments: number
}): string {
  const methodBreakdown = Object.entries(data.byMethod)
    .map(([m, v]) => `${m.toUpperCase()}: ₹${v.toFixed(2)}`)
    .join('\n')
  return `*${clinicName} — Daily Summary*
Date: ${date}

📊 SUMMARY
Bills: ${data.totalBills}
Billed: ₹${data.totalBilled.toFixed(2)}
Collected: ₹${data.totalCollected.toFixed(2)}
Refunds: ₹${data.totalRefunds.toFixed(2)}
Expenses: ₹${data.totalExpenses.toFixed(2)}
Net Cash: ₹${data.netCash.toFixed(2)}

💳 BY METHOD
${methodBreakdown || 'No collections today'}

👥 NEW PATIENTS: ${data.newPatients}
📅 APPOINTMENTS: ${data.appointments}`
}
