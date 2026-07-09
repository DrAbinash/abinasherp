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
  const pkg = await db.package.findUnique({ where: { id } })
  if (!pkg) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Hydrate test IDs to actual test objects
  const testIds = JSON.parse(pkg.testIds || '[]') as string[]
  const tests = await db.test.findMany({ where: { id: { in: testIds } } })
  return NextResponse.json({ package: { ...pkg, tests } })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getStaffSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const update: any = {}
  if (body.name !== undefined) update.name = body.name
  if (body.description !== undefined) update.description = body.description
  if (body.category !== undefined) update.category = body.category
  if (body.testIds !== undefined) {
    update.testIds = JSON.stringify(body.testIds)
    update.totalTests = body.testIds.length
  }
  if (body.mrp !== undefined) update.mrp = parseFloat(body.mrp)
  if (body.sellingPrice !== undefined) update.sellingPrice = parseFloat(body.sellingPrice)
  if (body.durationHours !== undefined) update.durationHours = parseInt(body.durationHours)
  if (body.fastingRequired !== undefined) update.fastingRequired = !!body.fastingRequired
  if (body.instructions !== undefined) update.instructions = body.instructions
  if (body.isActive !== undefined) update.isActive = !!body.isActive

  const pkg = await db.package.update({ where: { id }, data: update })
  return NextResponse.json({ package: pkg })
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getStaffSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  // Soft delete
  await db.package.update({ where: { id }, data: { isActive: false } })
  return NextResponse.json({ ok: true })
}
