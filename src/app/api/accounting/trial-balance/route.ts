import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getStaffSession } from '@/lib/session'

export async function GET() {
  const session = await getStaffSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const accounts = await db.account.findMany({
    include: {
      creditVouchers: true,
      debitVouchers: true,
    },
  })

  const rows = accounts.map((a) => {
    const debit = a.debitVouchers.reduce((s, v) => s + v.amount, 0)
    const credit = a.creditVouchers.reduce((s, v) => s + v.amount, 0)
    const opening = a.openingBalance * (a.openingBalanceType === 'Dr' ? 1 : -1)
    const net = debit - credit + opening
    return {
      id: a.id,
      name: a.name,
      type: a.type,
      tallyGroup: a.tallyGroup,
      openingDebit: a.openingBalanceType === 'Dr' ? a.openingBalance : 0,
      openingCredit: a.openingBalanceType === 'Cr' ? a.openingBalance : 0,
      debit,
      credit,
      closingDebit: net > 0 ? net : 0,
      closingCredit: net < 0 ? Math.abs(net) : 0,
    }
  })

  const totalDebit = rows.reduce((s, r) => s + r.closingDebit, 0)
  const totalCredit = rows.reduce((s, r) => s + r.closingCredit, 0)

  return NextResponse.json({
    rows,
    totals: { debit: totalDebit, credit: totalCredit, diff: totalDebit - totalCredit },
  })
}
