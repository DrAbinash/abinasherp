import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getStaffSession } from '@/lib/session'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getStaffSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const actions = await db.nablCorrectiveAction.findMany({
    where: { checklistId: id },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json({ actions })
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getStaffSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const checklist = await db.nablChecklist.findUnique({ where: { id } })
  if (!checklist) return NextResponse.json({ error: 'Checklist not found' }, { status: 404 })

  const body = await req.json().catch(() => ({}))
  const {
    finding, severity, rootCause, correctiveAction, preventiveAction,
    assignedTo, dueDate, status,
  } = body

  if (!finding) return NextResponse.json({ error: 'finding required' }, { status: 400 })

  const action = await db.nablCorrectiveAction.create({
    data: {
      checklistId: id,
      finding,
      severity: severity || 'minor',
      rootCause: rootCause || null,
      correctiveAction: correctiveAction || null,
      preventiveAction: preventiveAction || null,
      assignedTo: assignedTo || null,
      dueDate: dueDate || null,
      status: status || 'open',
    },
  })

  await db.nablChecklist.update({
    where: { id },
    data: { totalFindings: { increment: 1 } },
  })

  return NextResponse.json({ action })
}
