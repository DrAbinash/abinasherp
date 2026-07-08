import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getStaffSession } from '@/lib/session'

export async function GET(req: NextRequest) {
  const session = await getStaffSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const accountId = searchParams.get('accountId') || ''
  const from = searchParams.get('from') || ''
  const to = searchParams.get('to') || ''

  if (!accountId) return NextResponse.json({ error: 'accountId required' }, { status: 400 })

  const account = await db.account.findUnique({ where: { id: accountId } })
  if (!account) return NextResponse.json({ error: 'Account not found' }, { status: 404 })

  const where: Record<string, unknown> = {
    OR: [{ creditAccountId: accountId }, { debitAccountId: accountId }],
  }
  if (from || to) {
    where.date = {}
    if (from) where.date.gte = from
    if (to) where.date.lte = to
  }

  const vouchers = await db.voucher.findMany({
    where,
    orderBy: { date: 'asc' },
    include: { creditAccount: true, debitAccount: true },
  })

  // Running balance — for asset/expense: Dr - Cr; for income/liability/equity: Cr - Dr
  const isDebitNature = account.type === 'asset' || account.type === 'expense' || account.type === 'cash' || account.type === 'bank'
  let running = account.openingBalance * (isDebitNature ? 1 : -1) * (account.openingBalanceType === 'Dr' ? 1 : -1)
  // Simplified: opening balance Dr increases debit-nature, Cr decreases
  if (account.openingBalanceType === 'Cr' && isDebitNature) running = -account.openingBalance
  else if (account.openingBalanceType === 'Dr' && !isDebitNature) running = -account.openingBalance
  else running = isDebitNature ? account.openingBalance : -account.openingBalance

  const entries = vouchers.map((v) => {
    const isCredit = v.creditAccountId === accountId
    const amount = v.amount
    const debit = isCredit ? 0 : amount
    const credit = isCredit ? amount : 0
    if (isDebitNature) {
      running += debit - credit
    } else {
      running += credit - debit
    }
    return {
      id: v.id,
      voucherNumber: v.voucherNumber,
      date: v.date,
      type: v.type,
      particular: v.particular,
      reference: v.reference,
      debit,
      credit,
      balance: running,
      oppositeAccount: isCredit ? v.debitAccount : v.creditAccount,
    }
  })

  return NextResponse.json({
    account,
    entries,
    summary: {
      totalDebit: entries.reduce((s, e) => s + e.debit, 0),
      totalCredit: entries.reduce((s, e) => s + e.credit, 0),
      closingBalance: running,
    },
  })
}
