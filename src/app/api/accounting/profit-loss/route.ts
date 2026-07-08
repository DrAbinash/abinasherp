import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getStaffSession } from '@/lib/session'

export async function GET() {
  const session = await getStaffSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const accounts = await db.account.findMany({
    include: { creditVouchers: true, debitVouchers: true },
  })

  let totalIncome = 0
  let totalExpenses = 0
  const incomeRows: Array<{ name: string; amount: number }> = []
  const expenseRows: Array<{ name: string; amount: number }> = []

  for (const a of accounts) {
    const debit = a.debitVouchers.reduce((s, v) => s + v.amount, 0)
    const credit = a.creditVouchers.reduce((s, v) => s + v.amount, 0)
    if (a.type === 'income') {
      const amount = credit - debit // Cr − Dr
      if (amount !== 0) {
        incomeRows.push({ name: a.name, amount })
        totalIncome += amount
      }
    } else if (a.type === 'expense') {
      const amount = debit - credit // Dr − Cr
      if (amount !== 0) {
        expenseRows.push({ name: a.name, amount })
        totalExpenses += amount
      }
    }
  }

  return NextResponse.json({
    income: incomeRows,
    expenses: expenseRows,
    totalIncome,
    totalExpenses,
    netProfit: totalIncome - totalExpenses,
  })
}
