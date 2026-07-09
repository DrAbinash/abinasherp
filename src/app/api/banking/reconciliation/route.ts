import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getStaffSession } from '@/lib/session'

// List unreconciled + manual match
export async function GET() {
  const session = await getStaffSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const unreconciled = await db.bankTransaction.findMany({
    where: { reconciliationStatus: 'unreconciled' },
    orderBy: { transactionDate: 'desc' },
    include: { bankAccount: true },
  })

  const matched = await db.reconciliationLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: { bankTransaction: { include: { bankAccount: true } } },
  })

  return NextResponse.json({ unreconciled, matched })
}

// Manual match: bankTransactionId + billId (or paymentId)
export async function POST(req: NextRequest) {
  const session = await getStaffSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { bankTransactionId, billId, paymentId, voucherId } = body
  if (!bankTransactionId) return NextResponse.json({ error: 'bankTransactionId required' }, { status: 400 })

  const tx = await db.bankTransaction.findUnique({ where: { id: bankTransactionId } })
  if (!tx) return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })

  const log = await db.reconciliationLog.create({
    data: {
      bankTransactionId,
      billId,
      paymentId,
      voucherId,
      confidenceScore: 100,
      matchStrategy: 'manual',
      status: 'manual',
      resolvedById: session.id,
      resolvedByName: session.name,
      resolvedAt: new Date(),
    },
  })

  await db.bankTransaction.update({
    where: { id: bankTransactionId },
    data: {
      reconciliationStatus: 'matched',
      billId,
      paymentId,
      voucherId,
    },
  })

  return NextResponse.json({ log })
}

// Batch auto-reconcile (simplified — match by UTR or amount)
export async function PUT(req: NextRequest) {
  const session = await getStaffSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const autoCloseThreshold = 80
  const unreconciled = await db.bankTransaction.findMany({
    where: { reconciliationStatus: 'unreconciled', type: 'credit' },
  })

  const results: Array<{ id: string; matched: boolean; strategy: string }> = []
  for (const tx of unreconciled) {
    // Try exact UTR match
    if (tx.utr) {
      const payment = await db.payment.findFirst({
        where: { referenceNumber: tx.utr, amount: tx.amount },
        include: { bill: true },
      })
      if (payment) {
        await db.reconciliationLog.create({
          data: {
            bankTransactionId: tx.id,
            billId: payment.billId,
            paymentId: payment.id,
            confidenceScore: 100,
            matchStrategy: 'exact_utr',
            status: 'auto_matched',
            autoClosed: true,
            autoClosedAmount: tx.amount,
            resolvedById: session.id,
            resolvedByName: session.name,
            resolvedAt: new Date(),
          },
        })
        await db.bankTransaction.update({
          where: { id: tx.id },
          data: { reconciliationStatus: 'matched', billId: payment.billId, paymentId: payment.id },
        })
        results.push({ id: tx.id, matched: true, strategy: 'exact_utr' })
        continue
      }
    }

    // Try bill-number-in-description match
    if (tx.description) {
      const m = tx.description.match(/(?:BILL|INV|ORD)[\s-]*([A-Z0-9-]+)/i)
      if (m) {
        const bill = await db.bill.findFirst({ where: { billNumber: { contains: m[1], mode: 'insensitive' as const } } })
        if (bill) {
          await db.reconciliationLog.create({
            data: {
              bankTransactionId: tx.id,
              billId: bill.id,
              confidenceScore: 90,
              matchStrategy: 'exact_invoice_ref',
              status: 'auto_matched',
              autoClosed: true,
              autoClosedAmount: tx.amount,
              resolvedById: session.id,
              resolvedByName: session.name,
              resolvedAt: new Date(),
            },
          })
          await db.bankTransaction.update({
            where: { id: tx.id },
            data: { reconciliationStatus: 'matched', billId: bill.id },
          })
          results.push({ id: tx.id, matched: true, strategy: 'exact_invoice_ref' })
          continue
        }
      }
    }

    // Try amount+time match
    const lowerBound = tx.amount * 0.99
    const upperBound = tx.amount * 1.01
    const candidates = await db.payment.findMany({
      where: { amount: { gte: lowerBound, lte: upperBound } },
      include: { bill: true },
    })
    for (const c of candidates) {
      const timeDiff = Math.abs(c.createdAt.getTime() - tx.transactionDate.getTime())
      if (timeDiff < 30 * 60 * 1000) { // 30 min
        await db.reconciliationLog.create({
          data: {
            bankTransactionId: tx.id,
            billId: c.billId,
            paymentId: c.id,
            confidenceScore: 80,
            matchStrategy: 'exact_amount_time',
            status: 'auto_matched',
            autoClosed: true,
            autoClosedAmount: tx.amount,
            resolvedById: session.id,
            resolvedByName: session.name,
            resolvedAt: new Date(),
          },
        })
        await db.bankTransaction.update({
          where: { id: tx.id },
          data: { reconciliationStatus: 'matched', billId: c.billId, paymentId: c.id },
        })
        results.push({ id: tx.id, matched: true, strategy: 'exact_amount_time' })
        break
      }
    }

    if (results.find((r) => r.id === tx.id)) continue
    results.push({ id: tx.id, matched: false, strategy: 'none' })
  }

  return NextResponse.json({ results, threshold: autoCloseThreshold })
}
