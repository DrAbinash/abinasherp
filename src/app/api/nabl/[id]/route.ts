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
  const checklist = await db.nablChecklist.findUnique({
    where: { id },
    include: { correctiveActions: { orderBy: { createdAt: 'desc' } } },
  })
  if (!checklist) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ checklist })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getStaffSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const { title, status, findings, notes, auditorName } = body

  const update: Record<string, unknown> = {}
  if (title !== undefined) update.title = title
  if (status !== undefined) update.status = status
  if (notes !== undefined) update.notes = notes
  if (auditorName !== undefined) update.auditorName = auditorName
  if (findings !== undefined) {
    update.findings = typeof findings === 'string' ? findings : JSON.stringify(findings)
    try {
      const parsed = typeof findings === 'string' ? JSON.parse(findings) : findings
      if (Array.isArray(parsed)) {
        update.totalFindings = parsed.length
        update.closedFindings = parsed.filter((f: Record<string, unknown>) => f.status === 'closed').length
      }
    } catch {
      // ignore parse error
    }
  }

  const checklist = await db.nablChecklist.update({ where: { id }, data: update })
  return NextResponse.json({ checklist })
}
