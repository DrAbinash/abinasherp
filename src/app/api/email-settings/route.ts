import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getStaffSession } from '@/lib/session'

export async function GET() {
  const session = await getStaffSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const settings = await db.emailSettings.findUnique({ where: { id: 1 } })
  if (!settings) {
    // Create default
    const created = await db.emailSettings.create({ data: { id: 1 } })
    return NextResponse.json({ settings: created })
  }
  // Mask password
  return NextResponse.json({
    settings: { ...settings, smtpPassword: settings.smtpPassword ? '***' : '' },
  })
}

export async function PUT(req: NextRequest) {
  const session = await getStaffSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!session.isOwner) return NextResponse.json({ error: 'Admin only' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const update: any = {}
  const allowed = [
    'smtpHost', 'smtpPort', 'smtpUser', 'smtpPassword', 'smtpSecure',
    'fromAddress', 'fromName', 'adminEmail', 'extraRecipients',
    'billEditEnabled', 'dailySummaryEnabled', 'dailySummaryTime',
  ]
  for (const k of allowed) {
    if (body[k] !== undefined) update[k] = body[k]
  }
  // Don't overwrite password with the masked value
  if (update.smtpPassword === '***') delete update.smtpPassword

  const settings = await db.emailSettings.upsert({
    where: { id: 1 },
    update,
    create: { id: 1, ...update },
  })

  return NextResponse.json({
    settings: { ...settings, smtpPassword: settings.smtpPassword ? '***' : '' },
  })
}
