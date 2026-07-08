import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getStaffSession } from '@/lib/session'

export async function GET() {
  const session = await getStaffSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const clinic = await db.clinic.findFirst()
  return NextResponse.json({ clinic })
}

export async function PUT(req: NextRequest) {
  const session = await getStaffSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!session.isOwner) {
    return NextResponse.json({ error: 'Only admin/owner can update clinic' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const { name, address, phone, email, gstin, registrationNo, currency, commissionDiscountMode, vipPercentage, sessionIdleTimeoutMinutes } = body

  const existing = await db.clinic.findFirst()
  if (!existing) {
    const clinic = await db.clinic.create({
      data: {
        name: name || 'Care Diagnostic Centre',
        address, phone, email, gstin, registrationNo,
        currency: currency || 'INR',
        commissionDiscountMode: commissionDiscountMode || 'none',
        vipPercentage: parseFloat(vipPercentage || '50'),
        sessionIdleTimeoutMinutes: parseInt(sessionIdleTimeoutMinutes || '30'),
      },
    })
    return NextResponse.json({ clinic })
  }

  const update: Record<string, unknown> = {}
  if (name !== undefined) update.name = name
  if (address !== undefined) update.address = address
  if (phone !== undefined) update.phone = phone
  if (email !== undefined) update.email = email
  if (gstin !== undefined) update.gstin = gstin
  if (registrationNo !== undefined) update.registrationNo = registrationNo
  if (currency !== undefined) update.currency = currency
  if (commissionDiscountMode !== undefined) update.commissionDiscountMode = commissionDiscountMode
  if (vipPercentage !== undefined) update.vipPercentage = parseFloat(vipPercentage)
  if (sessionIdleTimeoutMinutes !== undefined) update.sessionIdleTimeoutMinutes = parseInt(sessionIdleTimeoutMinutes)

  const clinic = await db.clinic.update({ where: { id: existing.id }, data: update })
  return NextResponse.json({ clinic })
}
