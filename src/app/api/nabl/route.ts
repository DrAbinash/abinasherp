import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getStaffSession } from '@/lib/session'

export async function GET(req: NextRequest) {
  const session = await getStaffSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const category = searchParams.get('category') || ''
  const status = searchParams.get('status') || ''

  const where: any = {}
  if (category) where.category = category
  if (status) where.status = status

  const checklists = await db.nablChecklist.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { correctiveActions: true } } },
  })
  return NextResponse.json({ checklists })
}

export async function POST(req: NextRequest) {
  const session = await getStaffSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { title, category, auditDate, auditorName, notes } = body

  if (!title || !category || !auditDate) {
    return NextResponse.json({ error: 'title, category, auditDate required' }, { status: 400 })
  }

  const year = new Date(auditDate).getFullYear() || new Date().getFullYear()
  const yearCount = await db.nablChecklist.count({
    where: { checklistId: { startsWith: `NABL-${year}-` } },
  })
  const checklistId = `NABL-${year}-${String(yearCount + 1).padStart(4, '0')}`

  const checklist = await db.nablChecklist.create({
    data: {
      checklistId,
      title,
      category,
      auditDate,
      auditorName: auditorName || null,
      notes: notes || null,
    },
  })

  return NextResponse.json({ checklist })
}
