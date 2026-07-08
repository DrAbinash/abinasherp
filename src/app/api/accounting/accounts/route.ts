import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getStaffSession } from '@/lib/session'

export async function GET() {
  const session = await getStaffSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const accounts = await db.account.findMany({
    orderBy: { name: 'asc' },
    include: {
      _count: { select: { creditVouchers: true, debitVouchers: true } },
    },
  })
  return NextResponse.json({ accounts })
}

export async function POST(req: NextRequest) {
  const session = await getStaffSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { name, type, code, bankName, accountNumber, ifscCode, branch, tallyGroup, openingBalance, openingBalanceType, gstApplicable, gstNumber, pan } = body
  if (!name || !type) return NextResponse.json({ error: 'Name and type required' }, { status: 400 })

  try {
    const account = await db.account.create({
      data: {
        name,
        type,
        code: code || null,
        bankName,
        accountNumber,
        ifscCode,
        branch,
        tallyGroup,
        openingBalance: parseFloat(openingBalance || '0'),
        openingBalanceType: openingBalanceType || 'Dr',
        gstApplicable: !!gstApplicable,
        gstNumber,
        pan,
      },
    })
    return NextResponse.json({ account })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}
