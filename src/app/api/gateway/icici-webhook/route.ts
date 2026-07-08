import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyIciciWebhookSignature, isIciciWebhookSuccess } from '@/lib/icici'

// ============================================================
// POST /api/gateway/icici-webhook
// SERVER-TO-SERVER webhook from ICICI (no auth — verification via HMAC only)
//
// CRITICAL SECURITY: Webhook signature verification is MANDATORY.
// Previously the check was conditional (`if (secureHash && secretKey)`) which
// allowed forged POSTs that omitted secureHash to skip verification entirely.
// Now: missing secureHash → reject. Hash mismatch → reject. Always.
//
// ICICI requires HTTP 200 within 5 seconds, so we acknowledge immediately
// and process asynchronously.
// ============================================================
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || ''

  // Acknowledge immediately (ICICI requires 200 within 5s)
  // Process asynchronously
  processWebhook(body, ip).catch((e) => console.error('ICICI webhook processing failed:', e))

  return NextResponse.json({ status: 'received' })
}

async function processWebhook(body: any, ip: string) {
  const merchantTxnNo = body.merchantTxnNo || body.addlParam1 || ''
  const txnId = body.txnID || body.txnId || ''
  const amount = body.amount ? parseFloat(body.amount) : null
  const txnStatus = body.txnStatus || body.responseCode || ''

  // Get secret key
  const secretKey = process.env.ICICI_SECRET_KEY || ''

  // Log diagnostic
  const diagBase = {
    gateway: 'icici',
    stage: 'callback' as const,
    merchantTxnNo,
    responseBody: JSON.stringify(body).slice(0, 4000),
    clientIp: ip,
    amount,
  }

  // MANDATORY signature verification
  if (!secretKey) {
    await db.paymentGatewayDiagnostic.create({
      data: { ...diagBase, success: false, errorMessage: 'ICICI_SECRET_KEY not configured — cannot verify webhook' },
    }).catch(() => {})
    return
  }

  const signatureValid = verifyIciciWebhookSignature(body, secretKey)
  if (!signatureValid) {
    await db.paymentGatewayDiagnostic.create({
      data: {
        ...diagBase,
        success: false,
        errorMessage: body.secureHash ? 'Signature mismatch' : 'Signature missing',
        secureHashMasked: body.secureHash ? `${body.secureHash.slice(0, 6)}***` : '',
      },
    }).catch(() => {})
    return
  }

  const isSuccess = isIciciWebhookSuccess(body)

  await db.paymentGatewayDiagnostic.create({
    data: {
      ...diagBase,
      success: isSuccess,
      responseCode: txnStatus,
      secureHashMasked: body.secureHash ? `${body.secureHash.slice(0, 6)}***${body.secureHash.slice(-4)}` : '',
    },
  }).catch(() => {})

  // Find the booking
  if (!merchantTxnNo) {
    console.error('ICICI webhook: missing merchantTxnNo')
    return
  }

  const booking = await db.onlineBooking.findFirst({
    where: { bookingRef: merchantTxnNo },
  })
  if (!booking) {
    console.error('ICICI webhook: booking not found for ref:', merchantTxnNo)
    return
  }

  // Idempotency: skip if already paid/confirmed
  if (booking.status === 'paid' || booking.status === 'confirmed') {
    return
  }

  if (isSuccess) {
    // Mark as paid
    await db.onlineBooking.update({
      where: { id: booking.id },
      data: {
        status: 'paid',
        iciciTransactionId: txnId,
        iciciResponseCode: txnStatus,
        iciciResponseMsg: body.respDescription || 'Payment successful',
        paymentCompletedAt: new Date(),
        paymentMethod: body.paymentMethod || 'online',
      },
    })

    // TODO: In production, create a Patient + Order + Bill here automatically
    // For now we leave that for the front desk to do when patient arrives
    console.log(`✓ ICICI payment confirmed for booking ${merchantTxnNo}, txnId=${txnId}`)
  } else {
    // Payment failed
    await db.onlineBooking.update({
      where: { id: booking.id },
      data: {
        status: 'failed',
        iciciResponseCode: txnStatus,
        iciciResponseMsg: body.respDescription || 'Payment failed',
      },
    })
    console.log(`✗ ICICI payment failed for booking ${merchantTxnNo}: ${txnStatus}`)
  }
}
