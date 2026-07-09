import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getStaffSession } from '@/lib/session'

export async function GET(req: NextRequest) {
  const session = await getStaffSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status') || ''
  const accountId = searchParams.get('accountId') || ''
  const reconciliationStatus = searchParams.get('reconciliationStatus') || ''
  const limit = parseInt(searchParams.get('limit') || '100')

  const where: Record<string, unknown> = {}
  if (status) where.status = status
  if (accountId) where.bankAccountId = accountId
  if (reconciliationStatus) where.reconciliationStatus = reconciliationStatus

  const accounts = await db.bankAccount.findMany({ orderBy: { bankName: 'asc' } })

  const transactions = await db.bankTransaction.findMany({
    where,
    take: limit,
    orderBy: { transactionDate: 'desc' },
    include: { bankAccount: true, reconciliation: true },
  })

  return NextResponse.json({ accounts, transactions })
}

export async function POST(req: NextRequest) {
  const session = await getStaffSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { bankAccountId, transactionDate, description, amount, type, utr, referenceNumber } = body
  if (!bankAccountId || !amount || !type) {
    return NextResponse.json({ error: 'bankAccountId, amount, type required' }, { status: 400 })
  }

  const bankAccount = await db.bankAccount.findUnique({ where: { id: bankAccountId } })
  if (!bankAccount) return NextResponse.json({ error: 'Bank account not found' }, { status: 404 })

  const signedAmount = type === 'debit' ? -Math.abs(amount) : Math.abs(amount)
  const newBalance = bankAccount.currentBalance + signedAmount

  const tx = await db.bankTransaction.create({
    data: {
      bankAccountId,
      transactionDate: transactionDate ? new Date(transactionDate) : new Date(),
      description,
      amount: Math.abs(amount),
      type,
      balanceAfter: newBalance,
      utr,
      referenceNumber,
      reconciliationStatus: 'unreconciled',
    },
  })

  await db.bankAccount.update({
    where: { id: bankAccountId },
    data: { currentBalance: newBalance },
  })

  await db.bankAuditLog.create({
    data: {
      action: 'transaction_created',
      provider: bankAccount.provider,
      bankAccountId,
      externalId: tx.id,
      amount: Math.abs(amount),
      status: 'success',
      performedBy: session.name,
    },
  })

  return NextResponse.json({ transaction: tx, newBalance })
}
