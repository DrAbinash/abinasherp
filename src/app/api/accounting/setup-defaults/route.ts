import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getStaffSession } from '@/lib/session'
import { seedDefaultAccounts } from '@/lib/seed'

export async function POST() {
  const session = await getStaffSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await seedDefaultAccounts()
  const count = await db.account.count()
  return NextResponse.json({ ok: true, count })
}
