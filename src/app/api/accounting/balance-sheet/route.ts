import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getStaffSession } from '@/lib/session'

export async function GET() {
  const session = await getStaffSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const accounts = await db.account.findMany({
    include: { creditVouchers: true, debitVouchers: true },
  })

  const assets: Array<{ name: string; amount: number; type: string; tallyGroup: string | null }> = []
  const liabilities: Array<{ name: string; amount: number; type: string; tallyGroup: string | null }> = []
  let totalAssets = 0
  let totalLiabilities = 0
  let netProfit = 0

  for (const a of accounts) {
    const debit = a.debitVouchers.reduce((s, v) => s + v.amount, 0)
    const credit = a.creditVouchers.reduce((s, v) => s + v.amount, 0)
    const opening = a.openingBalance * (a.openingBalanceType === 'Dr' ? 1 : -1)

    if (a.type === 'asset' || a.type === 'cash' || a.type === 'bank') {
      const amount = debit - credit + opening
      if (amount > 0) {
        assets.push({ name: a.name, amount, type: a.type, tallyGroup: a.tallyGroup })
        totalAssets += amount
      }
    } else if (a.type === 'liability') {
      const amount = credit - debit - opening
      if (amount > 0) {
        liabilities.push({ name: a.name, amount, type: a.type, tallyGroup: a.tallyGroup })
        totalLiabilities += amount
      }
    } else if (a.type === 'income') {
      netProfit += credit - debit
    } else if (a.type === 'expense') {
      netProfit -= debit - credit
    }
  }

  // Net profit injected into liabilities (capital)
  if (netProfit > 0) {
    liabilities.push({ name: 'Net Profit (Capital)', amount: netProfit, type: 'income', tallyGroup: 'Capital Account' })
    totalLiabilities += netProfit
  }

  return NextResponse.json({
    assets,
    liabilities,
    totalAssets,
    totalLiabilities,
    diff: totalAssets - totalLiabilities,
  })
}
