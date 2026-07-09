import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import crypto from 'crypto'

// POST /api/portal/otp/send
// Body: { phone }
// Generates 6-digit OTP, saves to PatientOtp, returns success
// In production: integrate with WhatsApp/SMS provider to actually send the OTP
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const { phone } = body

  if (!phone) return NextResponse.json({ error: 'phone required' }, { status: 400 })

  const normalizedPhone = String(phone).replace(/\D/g, '')
  if (normalizedPhone.length < 10) {
    return NextResponse.json({ error: 'Invalid phone number' }, { status: 400 })
  }

  // Find patient by phone
  const patient = await db.patient.findFirst({
    where: { phone: { contains: normalizedPhone.slice(-10) } },
  })
  if (!patient) {
    return NextResponse.json({ error: 'No patient found with this phone number. Please visit the centre to register.' }, { status: 404 })
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

  // In development, return the OTP in response (for testing)
  const isDev = process.env.NODE_ENV !== 'production'
  return NextResponse.json({
    ok: true,
    message: isDev ? `OTP sent (dev mode: ${code})` : 'OTP sent via WhatsApp',
    ...(isDev ? { devOtp: code } : {}),
    patientName: patient.name, // hint for UI
  })
}
