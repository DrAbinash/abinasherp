import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getStaffSession } from '@/lib/session'

export async function GET() {
  const session = await getStaffSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const s = await db.whatsAppSettings.findUnique({ where: { id: 1 } })
  if (!s) {
    const created = await db.whatsAppSettings.create({ data: { id: 1 } })
    return NextResponse.json({ settings: { ...created, apiKey: '', apiSecret: '' } })
  }
  // Mask secrets
  return NextResponse.json({
    settings: {
      ...s,
      apiKey: s.apiKey ? '***' : '',
      apiSecret: s.apiSecret ? '***' : '',
    },
  })
}

export async function PUT(req: NextRequest) {
  const session = await getStaffSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!session.isOwner) return NextResponse.json({ error: 'Admin only' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const update: Record<string, unknown> = {}
  const allowed = ['provider', 'apiKey', 'apiSecret', 'phoneNumber', 'templateNamespace', 'isEnabled',
    'sendOnReportReady', 'sendOnBillCreated', 'sendOnAppointmentReminder']
  for (const k of allowed) {
    if (body[k] !== undefined) update[k] = body[k]
  }
  // Don't overwrite secrets with masked values
  if (update.apiKey === '***') delete update.apiKey
  if (update.apiSecret === '***') delete update.apiSecret

  const settings = await db.whatsAppSettings.upsert({
    where: { id: 1 },
    update,
    create: { id: 1, ...update },
  })

  return NextResponse.json({
    settings: {
      ...settings,
      apiKey: settings.apiKey ? '***' : '',
      apiSecret: settings.apiSecret ? '***' : '',
    },
  })
}
