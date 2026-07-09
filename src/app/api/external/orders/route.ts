import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyApiKey, logApiAccess } from '@/lib/external-auth'
import { generateOrderNumber, generatePatientId } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const start = Date.now()
  const endpoint = '/api/external/orders'

  const verified = await verifyApiKey('create:orders')
  if (!verified.ok) {
    await logApiAccess({
      keyId: undefined,
      endpoint,
      method: 'POST',
      statusCode: verified.status || 401,
      durationMs: Date.now() - start,
      errorMessage: verified.error,
    })
    return NextResponse.json({ error: verified.error }, { status: verified.status || 401 })
  }

  const body = await req.json().catch(() => ({}))
  const { patientName, patientPhone, testCodes, doctorName } = body

  if (!patientName || !patientPhone || !Array.isArray(testCodes) || testCodes.length === 0) {
    await logApiAccess({
      apiKeyId: verified.apiKey!.id,
      keyId: verified.apiKey!.keyId,
      endpoint,
      method: 'POST',
      statusCode: 400,
      durationMs: Date.now() - start,
      errorMessage: 'Missing required fields',
    })
    return NextResponse.json(
      { error: 'patientName, patientPhone, testCodes (non-empty array) required' },
      { status: 400 },
    )
  }

  const tests = await db.test.findMany({
    where: { code: { in: testCodes }, isActive: true },
  })
  const foundCodes = tests.map((t) => t.code)
  const missing = testCodes.filter((c: string) => !foundCodes.includes(c))
  if (missing.length > 0) {
    await logApiAccess({
      apiKeyId: verified.apiKey!.id,
      keyId: verified.apiKey!.keyId,
      endpoint,
      method: 'POST',
      statusCode: 400,
      durationMs: Date.now() - start,
      errorMessage: `Tests not found: ${missing.join(', ')}`,
    })
    return NextResponse.json(
      { error: 'Some test codes not found', missing },
      { status: 400 },
    )
  }

  let patient = await db.patient.findFirst({ where: { phone: patientPhone } })
  if (!patient) {
    const patientCount = await db.patient.count()
    const newPatientId = generatePatientId(patientCount + 1)
    patient = await db.patient.create({
      data: {
        patientId: newPatientId,
        name: patientName,
        phone: patientPhone,
      },
    })
  }

  let doctorId: string | null = null
  if (doctorName) {
    const doctor = await db.doctor.findFirst({ where: { name: { contains: doctorName } } })
    if (doctor) doctorId = doctor.id
  }

  const total = tests.reduce((s, t) => s + t.price, 0)
  const orderCount = await db.order.count()
  const orderNumber = generateOrderNumber(orderCount + 1)

  const order = await db.order.create({
    data: {
      orderNumber,
      patientId: patient.id,
      doctorId,
      totalAmount: total,
      status: 'pending',
      notes: `Created via external API by ${verified.apiKey!.name} (${verified.apiKey!.keyId})`,
      createdByName: `API:${verified.apiKey!.name}`,
      orderTests: { create: tests.map((t) => ({ testId: t.id, price: t.price })) },
    },
    include: {
      patient: true,
      orderTests: { include: { test: true } },
    },
  })

  await logApiAccess({
    apiKeyId: verified.apiKey!.id,
    keyId: verified.apiKey!.keyId,
    endpoint,
    method: 'POST',
    statusCode: 200,
    durationMs: Date.now() - start,
  })

  return NextResponse.json({
    order: {
      orderNumber: order.orderNumber,
      orderId: order.id,
      patientId: order.patient.patientId,
      patientName: order.patient.name,
      patientPhone: order.patient.phone,
      totalAmount: order.totalAmount,
      status: order.status,
      tests: order.orderTests.map((ot) => ({
        code: ot.test.code,
        name: ot.test.name,
        price: ot.price,
      })),
    },
  })
}
