import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getStaffSession } from '@/lib/session'

export async function GET() {
  const session = await getStaffSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const categories = await db.testCategory.findMany({
    include: { _count: { select: { tests: true } } },
    orderBy: { name: 'asc' },
  })
  return NextResponse.json({ categories })
}

export async function POST(req: NextRequest) {
  const session = await getStaffSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { name, description } = body
  if (!name) return NextResponse.json({ error: 'Name required' }, { status: 400 })

  const category = await db.testCategory.create({ data: { name, description } })
  return NextResponse.json({ category })
}
