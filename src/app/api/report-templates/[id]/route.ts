import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getStaffSession } from '@/lib/session'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getStaffSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const update: Record<string, unknown> = {}
  if (body.name !== undefined) update.name = body.name
  if (body.testId !== undefined) update.testId = body.testId
  if (body.testName !== undefined) update.testName = body.testName
  if (body.category !== undefined) update.category = body.category
  if (body.template !== undefined) update.template = typeof body.template === 'string' ? body.template : JSON.stringify(body.template)
  if (body.defaultValues !== undefined) update.defaultValues = body.defaultValues ? (typeof body.defaultValues === 'string' ? body.defaultValues : JSON.stringify(body.defaultValues)) : null
  if (body.notes !== undefined) update.notes = body.notes
  if (body.isActive !== undefined) update.isActive = !!body.isActive

  const tmpl = await db.reportTemplate.update({ where: { id }, data: update })
  return NextResponse.json({ template: tmpl })
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getStaffSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  await db.reportTemplate.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
