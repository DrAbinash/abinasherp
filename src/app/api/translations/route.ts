import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getStaffSession } from '@/lib/session'

export async function GET(req: NextRequest) {
  const session = await getStaffSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q') || ''

  const where: any = {}
  if (q) where.key = { contains: q, mode: 'insensitive' as const }

  const translations = await db.translation.findMany({
    where,
    orderBy: { key: 'asc' },
  })
  return NextResponse.json({ translations })
}

export async function POST(req: NextRequest) {
  const session = await getStaffSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { key, enValue, hiValue, bnValue, taValue, teValue, mrValue } = body

  if (!key || !enValue) {
    return NextResponse.json({ error: 'key and enValue required' }, { status: 400 })
  }

  const data = {
    key,
    enValue,
    hiValue: hiValue || null,
    bnValue: bnValue || null,
    taValue: taValue || null,
    teValue: teValue || null,
    mrValue: mrValue || null,
  }

  const existing = await db.translation.findUnique({ where: { key } })
  let translation
  if (existing) {
    translation = await db.translation.update({ where: { key }, data })
  } else {
    translation = await db.translation.create({ data })
  }

  return NextResponse.json({ translation })
}
