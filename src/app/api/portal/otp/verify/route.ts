import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { generateToken } from '@/lib/auth'

// POST /api/portal/otp/verify
// Body: { phone, code }
// Verifies OTP, creates PatientPortalSession, returns token
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const { phone, code } = body

  if (!phone || !code) return NextResponse.json({ error: 'phone and code required' }, { status: 400 })

  const normalizedPhone = String(phone).replace(/\D/g, '')

  // Find the most recent unused OTP for this phone
  const otp = await db.patientOtp.findFirst({
    where: { phone: normalizedPhone, verified: false },
    orderBy: { createdAt: 'desc' },
  })

  if (!otp) {
    return NextResponse.json({ error: 'No OTP found. Please request a new one.' }, { status: 404 })
  }

  if (otp.expiresAt < new Date()) {
    return NextResponse.json({ error: 'OTP expired. Please request a new one.' }, { status: 400 })
  }

  if (otp.attempts >= 3) {
    return NextResponse.json({ error: 'Too many attempts. Please request a new OTP.' }, { status: 429 })
  }

  if (otp.code !== code) {
    await db.patientOtp.update({ where: { id: otp.id }, data: { attempts: otp.attempts + 1 } })
    return NextResponse.json({ error: 'Invalid OTP' }, { status: 401 })
  }

  // Mark OTP as verified
  await db.patientOtp.update({ where: { id: otp.id }, data: { verified: true } })

  // Find patient
  const patient = await db.patient.findFirst({
    where: { phone: { contains: normalizedPhone.slice(-10) } },
  })
  if (!patient) {
    return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
  }

  // Create portal session
  const token = generateToken(32)
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours

  await db.patientPortalSession.create({
    data: {
      token,
      patientId: patient.id,
      patientName: patient.name,
      patientPhone: patient.phone || normalizedPhone,
      ipAddress: req.headers.get('x-forwarded-for') || '',
      userAgent: req.headers.get('user-agent') || '',
      expiresAt,
    },
  })

  return NextResponse.json({
    token,
    patient: {
      id: patient.id,
      name: patient.name,
      phone: patient.phone,
      patientId: patient.patientId,
    },
    expiresAt: expiresAt.toISOString(),
  })
}
