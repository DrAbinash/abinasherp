import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import crypto from 'crypto'

// In-memory rate limiting: max 3 OTP sends per phone number per hour
const OTP_RATE_WINDOW_MS = 60 * 60 * 1000
const OTP_RATE_MAX = 3
const otpSends = new Map<string, { count: number; resetAt: number }>()

function isOtpRateLimited(phone: string): boolean {
  const now = Date.now()
  const entry = otpSends.get(phone)
  if (!entry || entry.resetAt < now) {
    otpSends.set(phone, { count: 1, resetAt: now + OTP_RATE_WINDOW_MS })
    return false
  }
  if (entry.count >= OTP_RATE_MAX) return true
  entry.count++
  return false
}

const UNIFORM_RESPONSE = {
  ok: true,
  message: 'If the number is registered, an OTP has been sent.',
}

// POST /api/portal/otp/send
// Body: { phone }
// Generates 6-digit OTP, saves to PatientOtp, returns a uniform success response
// that does not reveal whether the phone number is registered.
// In production: integrate with WhatsApp/SMS provider to actually send the OTP
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const { phone } = body

  if (!phone) return NextResponse.json({ error: 'phone required' }, { status: 400 })

  const normalizedPhone = String(phone).replace(/\D/g, '')
  if (normalizedPhone.length < 10) {
    return NextResponse.json({ error: 'Invalid phone number' }, { status: 400 })
  }

  // Rate limit per phone number
  if (isOtpRateLimited(normalizedPhone)) {
    return NextResponse.json({ error: 'Too many OTP requests. Please try again later.' }, { status: 429 })
  }

  // Find patient by phone — but do NOT reveal existence via the response
  const patient = await db.patient.findFirst({
    where: { phone: { contains: normalizedPhone.slice(-10), mode: 'insensitive' as const } },
  })
  if (!patient) {
    return NextResponse.json(UNIFORM_RESPONSE)
  }

  // Generate 6-digit OTP
  const code = String(crypto.randomInt(100000, 999999))
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000) // 5 minutes

  await db.patientOtp.create({
    data: {
      phone: normalizedPhone,
      code,
      purpose: 'login',
      expiresAt,
    },
  })

  // Try to send OTP via WhatsApp (if configured)
  try {
    const { sendWhatsAppMessage } = await import('@/lib/whatsapp')
    const clinic = await db.clinic.findFirst()
    const message = `*${clinic?.name || 'Care Diagnostic Centre'}*

Your login OTP is: *${code}*

Valid for 5 minutes. Do not share with anyone.`
    sendWhatsAppMessage({
      to: normalizedPhone,
      message,
      templateName: 'otp',
    }).catch(() => {}) // fire-and-forget
  } catch {}

  // Only expose the OTP when explicitly enabled for debugging in non-production
  const debugOtp =
    process.env.PORTAL_DEBUG_OTP === 'true' && process.env.NODE_ENV !== 'production'
  return NextResponse.json({
    ...UNIFORM_RESPONSE,
    ...(debugOtp ? { devOtp: code } : {}),
  })
}
