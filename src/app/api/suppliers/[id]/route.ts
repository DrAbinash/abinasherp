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
  const supplier = await db.supplier.findUnique({
    where: { id },
    include: { bills: { orderBy: { billDate: 'desc' }, take: 50 } },
  })
  if (!supplier) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ supplier })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getStaffSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const { name, type, phone, email, contactPerson, gstin, pan, address, city, state, pincode, bankAccount, ifsc, branch, isActive } = body

  const update: any = {}
  if (name !== undefined) update.name = name
  if (type !== undefined) update.type = type
  if (phone !== undefined) update.phone = phone
  if (email !== undefined) update.email = email
  if (contactPerson !== undefined) update.contactPerson = contactPerson
  if (gstin !== undefined) update.gstin = gstin
  if (pan !== undefined) update.pan = pan
  if (address !== undefined) update.address = address
  if (city !== undefined) update.city = city
  if (state !== undefined) update.state = state
  if (pincode !== undefined) update.pincode = pincode
  if (bankAccount !== undefined) update.bankAccount = bankAccount
  if (ifsc !== undefined) update.ifsc = ifsc
  if (branch !== undefined) update.branch = branch
  if (isActive !== undefined) update.isActive = !!isActive

  const supplier = await db.supplier.update({ where: { id }, data: update })
  return NextResponse.json({ supplier })
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getStaffSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  await db.supplier.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
