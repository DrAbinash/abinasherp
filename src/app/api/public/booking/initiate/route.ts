import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { istDateLabel } from '@/lib/auth'
import { getIciciCredentials, initiateSale } from '@/lib/icici'

// ============================================================
// POST /api/public/booking/initiate
// PUBLIC ENDPOINT — no auth required
// Body: {
//   patientName, patientPhone, patientEmail?, patientAge?, patientGender?,
//   packageId?, testIds?: string[],  // either packageId or testIds
//   appointmentDate, timeSlot
// }
//
// Flow:
//   1. Validate input
//   2. Compute amount (from package sellingPrice OR sum of test prices)
//   3. Create OnlineBooking record (status: "pending")
//   4. Get ICICI credentials — if missing, return booking WITHOUT payment (pay-at-centre)
//   5. If ICICI configured → call initiateSale → return redirectUrl
//   6. Update booking status to "payment_initiated"
// ============================================================
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const {
    patientName, patientPhone, patientEmail, patientAge, patientGender,
    packageId, testIds, appointmentDate, timeSlot,
  } = body

  // Validation
  if (!patientName || !patientPhone || !appointmentDate || !timeSlot) {
    return NextResponse.json({
      error: 'patientName, patientPhone, appointmentDate, timeSlot are required',
    }, { status: 400 })
  }
  if (!packageId && (!Array.isArray(testIds) || testIds.length === 0)) {
    return NextResponse.json({
      error: 'Either packageId or testIds (non-empty array) is required',
    }, { status: 400 })
  }

  // Phone validation (Indian mobile)
  const phone = String(patientPhone).replace(/\D/g, '')
  if (phone.length < 10 || phone.length > 12) {
    return NextResponse.json({ error: 'Invalid phone number' }, { status: 400 })
  }

  // Compute amount + test/package details
  let amount = 0
  let packageName: string | null = null
  let testNames: string[] = []
  let resolvedTestIds: string[] = []

  if (packageId) {
    const pkg = await db.package.findUnique({ where: { id: packageId, isActive: true } })
    if (!pkg) return NextResponse.json({ error: 'Package not found' }, { status: 404 })
    amount = pkg.sellingPrice
    packageName = pkg.name
    resolvedTestIds = JSON.parse(pkg.testIds || '[]')
    const tests = await db.test.findMany({ where: { id: { in: resolvedTestIds } }, select: { name: true } })
    testNames = tests.map((t) => t.name)
  } else {
    const tests = await db.test.findMany({ where: { id: { in: testIds }, isActive: true } })
    if (tests.length === 0) return NextResponse.json({ error: 'No valid tests selected' }, { status: 400 })
    amount = tests.reduce((s, t) => s + t.price, 0)
    resolvedTestIds = testIds
    testNames = tests.map((t) => t.name)
  }

  if (amount <= 0) {
    return NextResponse.json({ error: 'Amount must be positive' }, { status: 400 })
  }

  // Generate booking ref: OB-YYYYMMDD-####
  const today = istDateLabel().replace(/-/g, '')
  const counter = await db.onlineBooking.count({
    where: { bookingRef: { startsWith: `OB-${today}` } },
  })
  const bookingRef = `OB-${today}-${String(counter + 1).padStart(4, '0')}`

  // Get client IP
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || ''
  const userAgent = req.headers.get('user-agent') || ''

  // Create booking record (status: pending)
  const booking = await db.onlineBooking.create({
    data: {
      bookingRef,
      patientName: String(patientName).trim(),
      patientPhone: phone,
      patientEmail: patientEmail || null,
      patientAge: patientAge ? parseInt(patientAge) : null,
      patientGender: patientGender || null,
      packageId: packageId || null,
      packageName,
      testIds: JSON.stringify(resolvedTestIds),
      testNames: JSON.stringify(testNames),
      appointmentDate,
      timeSlot,
      amount,
      status: 'pending',
      ip,
      userAgent,
    },
  })

  // Try ICICI Orange Pay
  const creds = await getIciciCredentials()

  // Log diagnostic
  const diagBase = {
    gateway: 'icici',
    stage: 'initiate',
    merchantTxnNo: bookingRef,
    bookingRef,
    amount,
    currency: '356',
    clientIp: ip,
    userAgent,
    referer: req.headers.get('referer') || '',
    origin: req.headers.get('origin') || '',
    environment: creds?.environment || 'not_configured',
    publicBaseUrl: creds?.publicBaseUrl || '',
  }

  if (!creds) {
    // ICICI not configured — return booking without payment URL (pay at centre)
    await db.paymentGatewayDiagnostic.create({
      data: {
        ...diagBase,
        success: false,
        errorMessage: 'ICICI credentials not configured',
        responseBody: 'Set ICICI_MERCHANT_ID, ICICI_AGGREGATOR_ID, ICICI_SECRET_KEY env vars',
      },
    })

    return NextResponse.json({
      bookingRef,
      amount,
      testNames,
      packageName,
      appointmentDate,
      timeSlot,
      paymentRequired: false,
      message: 'Booking created. Payment will be collected at the centre.',
      status: 'pending',
    })
  }

  // returnUrl — ICICI will redirect browser here after payment
  const returnUrl = `${creds.publicBaseUrl}/api/public/booking/icici-callback`

  // Format amount as "100.00" (2 decimal string)
  const amountStr = amount.toFixed(2)

  const startMs = Date.now()
  const result = await initiateSale({
    merchantTxnNo: bookingRef,
    amount: amountStr,
    customerEmailID: patientEmail || undefined,
    customerMobileNo: phone,
    customerName: String(patientName).trim(),
    returnUrl,
  }, creds)
  const durationMs = Date.now() - startMs

  if (!result.success) {
    // Initiate failed
    await db.paymentGatewayDiagnostic.create({
      data: {
        ...diagBase,
        success: false,
        responseCode: result.responseCode,
        responseMessage: result.respDescription,
        responseBody: JSON.stringify(result.raw).slice(0, 4000),
        returnUrl,
        durationMs,
        errorMessage: result.respDescription || 'initiateSale failed',
      },
    })

    // Update booking status to failed
    await db.onlineBooking.update({
      where: { id: booking.id },
      data: {
        status: 'failed',
        iciciResponseCode: result.responseCode,
        iciciResponseMsg: result.respDescription,
      },
    })

    return NextResponse.json({
      error: 'Payment gateway initialization failed',
      bookingRef,
      details: result.respDescription || result.responseCode,
    }, { status: 502 })
  }

  // Initiate succeeded — update booking + log diagnostic
  await db.onlineBooking.update({
    where: { id: booking.id },
    data: {
      status: 'payment_initiated',
      iciciMerchantTxnNo: bookingRef,
      iciciTransactionId: result.tranCtx,
      paymentInitiatedAt: new Date(),
    },
  })

  await db.paymentGatewayDiagnostic.create({
    data: {
      ...diagBase,
      success: true,
      responseCode: result.responseCode,
      tranCtx: result.tranCtx,
      redirectUri: result.redirectUrl,
      returnUrl,
      merchantId: creds.merchantId,
      aggregatorId: creds.aggregatorId,
      durationMs,
    },
  })

  return NextResponse.json({
    bookingRef,
    amount,
    testNames,
    packageName,
    appointmentDate,
    timeSlot,
    paymentRequired: true,
    redirectUrl: result.redirectUrl,
    tranCtx: result.tranCtx,
    status: 'payment_initiated',
    message: 'Redirecting to ICICI Orange Pay...',
  })
}
