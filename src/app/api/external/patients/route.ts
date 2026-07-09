import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyApiKey, logApiAccess } from '@/lib/external-auth'

export async function GET(req: NextRequest) {
  const start = Date.now()
  const endpoint = '/api/external/patients'

  const verified = await verifyApiKey('read:patients')
  if (!verified.ok) {
    await logApiAccess({
      keyId: undefined,
      endpoint,
      method: 'GET',
      statusCode: verified.status || 401,
      durationMs: Date.now() - start,
      errorMessage: verified.error,
    })
    return NextResponse.json({ error: verified.error }, { status: verified.status || 401 })
  }

  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q') || ''
  const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 500)

  const where: Record<string, unknown> = { isActive: true }
  if (q) {
    where.OR = [
      { name: { contains: q, mode: 'insensitive' as const } },
      { phone: { contains: q, mode: 'insensitive' as const } },
      { patientId: { contains: q, mode: 'insensitive' as const } },
    ]
  }

  const patients = await db.patient.findMany({
    where,
    take: limit,
    orderBy: { createdAt: 'desc' },
    select: {
      patientId: true,
      name: true,
      phone: true,
      age: true,
      gender: true,
    },
  })

  await logApiAccess({
    apiKeyId: verified.apiKey!.id,
    keyId: verified.apiKey!.keyId,
    endpoint,
    method: 'GET',
    statusCode: 200,
    durationMs: Date.now() - start,
  })

  return NextResponse.json({ patients, count: patients.length })
}
