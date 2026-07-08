import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getStaffSession } from '@/lib/session'

export async function GET() {
  const session = await getStaffSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const branches = await db.branch.findMany({
    orderBy: { name: 'asc' },
  })
  return NextResponse.json({ branches })
}

export async function POST(req: NextRequest) {
  const session = await getStaffSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!session.isOwner) {
    return NextResponse.json({ error: 'Only admin/owner can create branches' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const { name, code, address, phone, email, gstin, isHeadOffice } = body
  if (!name || !code) return NextResponse.json({ error: 'name and code required' }, { status: 400 })

  const branch = await db.branch.create({
    data: {
      branchId: `BR-${code.toUpperCase()}`,
      name,
      code: code.toUpperCase(),
      address, phone, email, gstin,
      isHeadOffice: !!isHeadOffice,
    },
  })

  return NextResponse.json({ branch })
}
