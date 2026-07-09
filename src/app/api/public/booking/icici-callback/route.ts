import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { ICICI_WEBHOOK_SUCCESS_CODES } from '@/lib/icici'

// ============================================================
// GET /api/public/booking/icici-callback
// Browser return URL — ICICI redirects here after payment
// Query params from ICICI: merchantTxnNo (or addlParam1), txnID, amount, txnStatus (or responseCode), secureHash
//
// This is the BROWSER-FACING callback. The server-to-server webhook
// at /api/gateway/icici-webhook is the source of truth for payment status.
// Here we just render a success/failure page for the patient.
// ============================================================
export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const params = url.searchParams

  const merchantTxnNo = params.get('merchantTxnNo') || params.get('addlParam1') || ''
  const txnId = params.get('txnID') || params.get('txnId') || ''
  const amount = params.get('amount') || ''
  const txnStatus = params.get('txnStatus') || params.get('responseCode') || ''

  const isSuccess = ICICI_WEBHOOK_SUCCESS_CODES.includes(txnStatus)

  // Log diagnostic
  await db.paymentGatewayDiagnostic.create({
    data: {
      gateway: 'icici',
      stage: 'callback',
      merchantTxnNo,
      success: isSuccess,
      responseCode: txnStatus,
      responseBody: JSON.stringify(Object.fromEntries(params.entries())).slice(0, 4000),
      returnUrl: url.pathname,
      clientIp: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '',
      userAgent: req.headers.get('user-agent') || '',
      referer: req.headers.get('referer') || '',
      amount: amount ? parseFloat(amount) : null,
    },
  }).catch(() => {})

  // Look up the booking to show patient details
  let booking: any = null
  if (merchantTxnNo) {
    booking = await db.onlineBooking.findFirst({
      where: { bookingRef: merchantTxnNo },
    }).catch(() => null)
  }

  // If booking found and webhook hasn't updated it yet, do a status check
  // (in production the webhook would already have updated it; this is a fallback)
  if (booking && isSuccess && booking.status !== 'paid' && booking.status !== 'confirmed') {
    try {
      const { getIciciCredentials, checkStatus } = await import('@/lib/icici')
      const creds = await getIciciCredentials()
      if (creds) {
        const statusResult = await checkStatus(merchantTxnNo, creds)
        if (statusResult.success) {
          // AMOUNT RECONCILIATION: only confirm if the gateway's amount matches
          // the booking (when the gateway reports one).
          const statusAmount =
            statusResult.raw?.amount != null ? parseFloat(String(statusResult.raw.amount)) : null
          if (statusAmount !== null && Math.abs(statusAmount - booking.amount) > 0.01) {
            // Flag mismatch (do NOT confirm) — atomic guard
            await db.onlineBooking.updateMany({
              where: { id: booking.id, status: { notIn: ['paid', 'confirmed'] } },
              data: {
                status: 'amount_mismatch',
                iciciResponseCode: statusResult.responseCode || txnStatus,
                iciciResponseMsg: `Amount mismatch: expected ${booking.amount} got ${statusAmount}`,
              },
            }).catch(() => {})
          } else {
            // Mark as paid — atomic idempotency guard (webhook may also do this)
            await db.onlineBooking.updateMany({
              where: { id: booking.id, status: { notIn: ['paid', 'confirmed'] } },
              data: {
                status: 'paid',
                iciciTransactionId: statusResult.txnId || txnId,
                iciciResponseCode: statusResult.responseCode || txnStatus,
                iciciResponseMsg: statusResult.respDescription,
                paymentCompletedAt: new Date(),
                paymentMethod: 'online',
              },
            }).catch(() => {})
          }
          booking = await db.onlineBooking.findFirst({ where: { bookingRef: merchantTxnNo } })
        }
      }
    } catch (e) { /* ignore — webhook will handle */ }
  }

  // SUCCESS shown to the patient is derived from the persisted booking status
  // (source of truth), NOT the forgeable `txnStatus` query param.
  const confirmed = !!(booking && (booking.status === 'paid' || booking.status === 'confirmed'))

  // Render HTML response for the patient
  const html = renderCallbackPage(confirmed, booking, merchantTxnNo, txnId, txnStatus)
  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}

function renderCallbackPage(success: boolean, booking: any, bookingRef: string, txnId: string, txnStatus: string): string {
  const clinicName = 'Care Diagnostic Centre' // would come from clinic settings in production
  const color = success ? '#10b981' : '#ef4444'
  const icon = success ? '✓' : '✗'
  const title = success ? 'Payment Successful' : 'Payment Failed'
  const message = success
    ? 'Your payment has been received. Your appointment is confirmed. Please save your booking reference for future use.'
    : 'Your payment could not be processed. Please try again or contact us for assistance.'

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title} — ${clinicName}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: linear-gradient(135deg, #f0fdf4 0%, #fef3c7 100%); min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 20px; }
  .card { background: white; border-radius: 16px; box-shadow: 0 20px 60px rgba(0,0,0,0.1); max-width: 480px; width: 100%; overflow: hidden; }
  .header { background: ${color}; color: white; padding: 40px 20px; text-align: center; }
  .icon { font-size: 64px; line-height: 1; margin-bottom: 12px; }
  .header h1 { font-size: 22px; font-weight: 600; }
  .body { padding: 30px 24px; }
  .body p { color: #4b5563; line-height: 1.6; margin-bottom: 20px; font-size: 14px; }
  .details { background: #f9fafb; border-radius: 8px; padding: 16px; margin-bottom: 20px; }
  .detail-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 13px; border-bottom: 1px solid #f3f4f6; }
  .detail-row:last-child { border-bottom: none; }
  .detail-label { color: #6b7280; }
  .detail-value { font-weight: 600; color: #1f2937; }
  .booking-ref { font-family: monospace; color: ${color}; font-size: 16px; }
  .btn { display: block; width: 100%; padding: 14px; background: ${color}; color: white; text-align: center; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px; border: none; cursor: pointer; }
  .clinic { text-align: center; margin-top: 20px; font-size: 12px; color: #9ca3af; }
</style></head>
<body>
  <div class="card">
    <div class="header">
      <div class="icon">${icon}</div>
      <h1>${title}</h1>
    </div>
    <div class="body">
      <p>${message}</p>
      ${booking ? `
      <div class="details">
        <div class="detail-row"><span class="detail-label">Booking Ref</span><span class="detail-value booking-ref">${booking.bookingRef}</span></div>
        <div class="detail-row"><span class="detail-label">Patient</span><span class="detail-value">${booking.patientName}</span></div>
        <div class="detail-row"><span class="detail-label">Phone</span><span class="detail-value">${booking.patientPhone}</span></div>
        ${booking.packageName ? `<div class="detail-row"><span class="detail-label">Package</span><span class="detail-value">${booking.packageName}</span></div>` : ''}
        <div class="detail-row"><span class="detail-label">Appointment</span><span class="detail-value">${booking.appointmentDate} ${booking.timeSlot}</span></div>
        <div class="detail-row"><span class="detail-label">Amount Paid</span><span class="detail-value">₹${booking.amount.toFixed(2)}</span></div>
        ${txnId ? `<div class="detail-row"><span class="detail-label">Transaction ID</span><span class="detail-value" style="font-family:monospace;font-size:11px">${txnId}</span></div>` : ''}
      </div>
      ` : `
      <div class="details">
        <div class="detail-row"><span class="detail-label">Booking Ref</span><span class="detail-value booking-ref">${bookingRef}</span></div>
        ${txnStatus ? `<div class="detail-row"><span class="detail-label">Status Code</span><span class="detail-value">${txnStatus}</span></div>` : ''}
      </div>
      `}
      <a href="/" class="btn">${success ? 'Done' : 'Try Again'}</a>
      <div class="clinic">${clinicName} · Thank you for choosing us</div>
    </div>
  </div>
</body></html>`
}
