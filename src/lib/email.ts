import nodemailer from 'nodemailer'
import { db } from '@/lib/db'
import crypto from 'crypto'

// ============================================================
// EMAIL SETTINGS + SMTP TRANSPORT (matches reference repo email.ts)
// ============================================================

export async function getEmailSettings() {
  const s = await db.emailSettings.findUnique({ where: { id: 1 } })
  if (!s) return null
  // Treat "NA", "null", "" as missing (matches reference repo's cleanVal)
  const clean = (v: string | null | undefined): string => {
    if (!v || v === 'NA' || v === 'null' || v === '') return ''
    return v
  }
  return {
    ...s,
    smtpHost: clean(s.smtpHost),
    smtpUser: clean(s.smtpUser),
    smtpPassword: clean(s.smtpPassword),
    fromAddress: clean(s.fromAddress),
    adminEmail: clean(s.adminEmail),
  }
}

export async function getTransporter() {
  const s = await getEmailSettings()
  if (!s || !s.smtpHost || !s.smtpUser) return null
  return nodemailer.createTransport({
    host: s.smtpHost,
    port: Number(s.smtpPort) || 587,
    secure: s.smtpSecure,
    auth: { user: s.smtpUser, pass: s.smtpPassword },
  })
}

export async function getAllRecipients(s: NonNullable<Awaited<ReturnType<typeof getEmailSettings>>>) {
  const extras: string[] = (() => {
    try { return JSON.parse(s.extraRecipients || '[]') as string[] } catch { return [] }
  })()
  const all = [s.adminEmail, ...extras].filter(Boolean)
  return Array.from(new Set(all)) // dedupe
}

// Generic sender — inserts EmailLog row, attempts send, updates status
export async function sendEmail({
  to, subject, body, templateName, billId, reportId, sentById, sentByName,
}: {
  to: string | string[]
  subject: string
  body: string
  templateName: string
  billId?: string
  reportId?: string
  sentById?: string
  sentByName?: string
}) {
  const recipients = Array.isArray(to) ? to.join(',') : to
  const log = await db.emailLog.create({
    data: {
      to: recipients,
      subject,
      body,
      templateName,
      billId: billId || null,
      reportId: reportId || null,
      status: 'queued',
      sentById: sentById || null,
      sentByName: sentByName || null,
    },
  })

  try {
    const transporter = await getTransporter()
    const s = await getEmailSettings()
    if (!transporter || !s || !s.fromAddress) {
      await db.emailLog.update({
        where: { id: log.id },
        data: { status: 'failed', errorMessage: 'SMTP not configured' },
      })
      return { ok: false, error: 'SMTP not configured', logId: log.id }
    }

    const info = await transporter.sendMail({
      from: `"${s.fromName}" <${s.fromAddress}>`,
      to: recipients,
      subject,
      html: body,
    })

    await db.emailLog.update({
      where: { id: log.id },
      data: {
        status: 'sent',
        messageId: info.messageId,
        attempts: 1,
        sentAt: new Date(),
      },
    })
    return { ok: true, logId: log.id, messageId: info.messageId }
  } catch (e: any) {
    await db.emailLog.update({
      where: { id: log.id },
      data: {
        status: 'failed',
        errorMessage: e.message,
        attempts: 1,
      },
    })
    console.error('Email send failed:', e.message)
    return { ok: false, error: e.message, logId: log.id }
  }
}

// ============================================================
// BILL EDIT / REPRINT EMAIL TEMPLATES (matches reference repo)
// ============================================================

interface BillEditEmailParams {
  billNumber: string
  patientName: string
  changeType: string // status | discount | cancelled | refund | test_swapped | etc.
  oldValue?: string | null
  newValue?: string | null
  reason?: string | null
  actor: string // who performed the action
  totalAmount?: number
  reprintCount?: number
}

export async function sendBillEditEmail(params: BillEditEmailParams) {
  const s = await getEmailSettings()
  if (!s || !s.billEditEnabled) return { ok: false, skipped: true, reason: 'billEditEnabled=false' }

  const recipients = await getAllRecipients(s)
  if (recipients.length === 0) return { ok: false, skipped: true, reason: 'no recipients' }

  const subject = `[Bill Edit] ${params.billNumber} — ${params.patientName}`
  const changeLabel = params.changeType.replace(/_/g, ' ').toUpperCase()

  const body = `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <div style="background:#1e40af; color:white; padding:15px 20px; border-radius:8px 8px 0 0;">
    <h2 style="margin:0; font-size:18px;">Bill Modified: ${params.billNumber}</h2>
    <p style="margin:5px 0 0; opacity:0.9; font-size:13px;">Patient: ${params.patientName}</p>
  </div>
  <div style="border:1px solid #e5e7eb; padding:20px; border-radius:0 0 8px 8px;">
    <p style="margin:0 0 15px; color:#374151;">A bill was modified by <strong>${params.actor}</strong> on ${new Date().toLocaleString('en-IN')}.</p>
    <table style="width:100%; border-collapse:collapse; margin:15px 0;">
      <thead>
        <tr style="background:#f9fafb;">
          <th style="text-align:left; padding:10px; border:1px solid #e5e7eb;">Field</th>
          <th style="text-align:left; padding:10px; border:1px solid #e5e7eb;">Before</th>
          <th style="text-align:left; padding:10px; border:1px solid #e5e7eb;">After</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td style="padding:10px; border:1px solid #e5e7eb; font-weight:600;">${changeLabel}</td>
          <td style="padding:10px; border:1px solid #e5e7eb; color:#dc2626;">${params.oldValue || '—'}</td>
          <td style="padding:10px; border:1px solid #e5e7eb; color:#16a34a;">${params.newValue || '—'}</td>
        </tr>
      </tbody>
    </table>
    ${params.reason ? `<p style="margin:15px 0; padding:10px; background:#fef3c7; border-left:4px solid #f59e0b; font-size:13px;"><strong>Reason:</strong> ${params.reason}</p>` : ''}
    ${params.totalAmount !== undefined ? `<p style="margin:15px 0; font-size:14px;"><strong>Bill Total:</strong> ₹${params.totalAmount.toFixed(2)}</p>` : ''}
    ${params.reprintCount ? `<p style="margin:15px 0; font-size:14px;"><strong>Re-print count:</strong> #${params.reprintCount}</p>` : ''}
    <p style="margin:20px 0 0; padding-top:15px; border-top:1px solid #e5e7eb; font-size:11px; color:#9ca3af;">
      Sent by Care Diagnostics ERP • ${new Date().toLocaleString('en-IN')}
    </p>
  </div>
</div>`

  return sendEmail({
    to: recipients,
    subject,
    body,
    templateName: params.reprintCount ? 'bill_reprint' : 'bill_edit',
    billId: undefined, // we don't have billId in this context — caller can pass
    sentByName: params.actor,
  })
}

export async function sendBillReprintEmail(params: BillEditEmailParams) {
  return sendBillEditEmail({ ...params, reprintCount: params.reprintCount || 1 })
}

// ============================================================
// DAILY SUMMARY EMAIL
// ============================================================
export async function sendDailySummaryEmail(messageText: string, totalCollected: number) {
  const s = await getEmailSettings()
  if (!s || !s.dailySummaryEnabled) return { ok: false, skipped: true }
  const recipients = await getAllRecipients(s)
  if (recipients.length === 0) return { ok: false, skipped: true }

  const subject = `[Daily Summary] ${new Date().toLocaleDateString('en-IN')} — Collected ₹${totalCollected.toFixed(2)}`
  const body = `<pre style="font-family: Arial, sans-serif; white-space: pre-wrap; font-size: 13px; line-height: 1.5;">${messageText}</pre>`

  return sendEmail({
    to: recipients,
    subject,
    body,
    templateName: 'daily_summary',
  })
}
