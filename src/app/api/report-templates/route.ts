import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getStaffSession } from '@/lib/session'

export async function GET(req: NextRequest) {
  const session = await getStaffSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q') || ''
  const category = searchParams.get('category') || ''

  const where: any = {}
  if (q) where.OR = [{ name: { contains: q, mode: 'insensitive' as const } }, { testName: { contains: q, mode: 'insensitive' as const } }]
  if (category) where.category = category

  const templates = await db.reportTemplate.findMany({
    where,
    orderBy: { name: 'asc' },
  })
  return NextResponse.json({ templates })
}

export async function POST(req: NextRequest) {
  const session = await getStaffSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { name, testId, testName, category, template, defaultValues, notes } = body
  if (!name || !testName) return NextResponse.json({ error: 'name and testName required' }, { status: 400 })

  const tmpl = await db.reportTemplate.create({
    data: {
      name, testId: testId || null, testName, category: category || 'general',
      template: typeof template === 'string' ? template : JSON.stringify(template || { fields: [] }),
      defaultValues: defaultValues ? (typeof defaultValues === 'string' ? defaultValues : JSON.stringify(defaultValues)) : null,
      notes,
    },
  })
  return NextResponse.json({ template: tmpl })
}
