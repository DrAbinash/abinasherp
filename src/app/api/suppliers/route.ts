import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getStaffSession } from '@/lib/session'

export async function GET(req: NextRequest) {
  const session = await getStaffSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q') || ''
  const type = searchParams.get('type') || ''

  const where: any = {}
  if (q) {
    where.OR = [
      { name: { contains: q, mode: 'insensitive' as const } },
      { supplierId: { contains: q, mode: 'insensitive' as const } },
      { phone: { contains: q, mode: 'insensitive' as const } },
      { gstin: { contains: q, mode: 'insensitive' as const } },
    ]
  }
  if (type) where.type = type

  const suppliers = await db.supplier.findMany({
    where,
    orderBy: { name: 'asc' },
    include: { _count: { select: { bills: true } } },
  })
  return NextResponse.json({ suppliers })
}

export async function POST(req: NextRequest) {
  const session = await getStaffSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { name, type, phone, email, contactPerson, gstin, pan, address, city, state, pincode, bankAccount, ifsc, branch, openingBalance, openingBalanceType } = body
  if (!name) return NextResponse.json({ error: 'Name required' }, { status: 400 })

  // Generate supplier ID
  const count = await db.supplier.count()
  const supplierId = `SUP-${String(count + 1).padStart(4, '0')}`

  // Auto-create ledger account under Sundry Creditors or Debtors
  const tallyGroup = type === 'debtor' ? 'Sundry Debtors' : 'Sundry Creditors'
  let ledger = await db.account.findUnique({ where: { name } })
  if (!ledger) {
    ledger = await db.account.create({
      data: {
        name,
        type: 'liability',
        tallyGroup,
        gstApplicable: !!gstin,
        gstNumber: gstin,
        pan,
        openingBalance: parseFloat(openingBalance || '0'),
        openingBalanceType: openingBalanceType || 'Cr',
      },
    })
  }

  const supplier = await db.supplier.create({
    data: {
      supplierId,
      name,
      type: type || 'creditor',
      phone, email, contactPerson, gstin, pan,
      address, city, state, pincode,
      bankAccount, ifsc, branch,
      ledgerAccountId: ledger.id,
      openingBalance: parseFloat(openingBalance || '0'),
      openingBalanceType: openingBalanceType || 'Cr',
    },
  })

  return NextResponse.json({ supplier })
}
