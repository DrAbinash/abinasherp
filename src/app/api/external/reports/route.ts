import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyApiKey, logApiAccess } from '@/lib/external-auth'

export async function GET(req: NextRequest) {
  const start = Date.now()
  const endpoint = '/api/external/reports'

  const verified = await verifyApiKey('read:reports')
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
  const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 500)
  const from = searchParams.get('from') || ''
  const to = searchParams.get('to') || ''

  const where: Record<string, unknown> = {
    status: { in: ['approved', 'delivered'] },
  }
  if (from || to) {
    const dateFilter: Record<string, Date> = {}
    if (from) dateFilter.gte = new Date(from + 'T00:00:00+05:30')
    if (to) dateFilter.lte = new Date(to + 'T23:59:59+05:30')
    where.createdAt = dateFilter
  }

  const reports = await db.patientReport.findMany({
    where,
    take: limit,
    orderBy: { createdAt: 'desc' },
    select: {
      reportNumber: true,
      patientName: true,
      testName: true,
      status: true,
      createdAt: true,
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

  return NextResponse.json({ reports, count: reports.length })
}
