import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getStaffSession } from '@/lib/session'
import { generateVoucherNumber, istDateLabel } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const session = await getStaffSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type') || ''
  const from = searchParams.get('from') || ''
  const to = searchParams.get('to') || ''
  const q = searchParams.get('q') || ''
  const limit = parseInt(searchParams.get('limit') || '200')

  const where: Record<string, unknown> = {}
  if (type) where.type = type
  if (q) {
    where.OR = [
      { voucherNumber: { contains: q } },
      { particular: { contains: q } },
      { remark: { contains: q } },
      { reference: { contains: q } },
    ]
  }
  if (from || to) {
    where.date = {}
    if (from) where.date.gte = from
    if (to) where.date.lte = to
  }

  const vouchers = await db.voucher.findMany({
    where,
    take: limit,
    orderBy: { date: 'desc' },
    include: {
      creditAccount: true,
      debitAccount: true,
    },
  })
  return NextResponse.json({ vouchers })
}

export async function POST(req: NextRequest) {
  const session = await getStaffSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { type, date, creditAccountId, debitAccountId, amount, particular, remark, reference, narration, billId } = body

  if (!type || !creditAccountId || !debitAccountId || !amount) {
    return NextResponse.json({ error: 'type, creditAccountId, debitAccountId, amount required' }, { status: 400 })
  }
  if (creditAccountId === debitAccountId) {
    return NextResponse.json({ error: 'Credit and debit accounts must differ' }, { status: 400 })
  }

  // Race-safe voucher number
  const count = await db.voucher.count({ where: { type } })
  const voucherNumber = generateVoucherNumber(type, count + 1)

  const voucher = await db.voucher.create({
    data: {
      voucherNumber,
      type,
      date: date || istDateLabel(),
      creditAccountId,
      debitAccountId,
      amount: parseFloat(amount),
      particular,
      remark,
      reference,
      narration,
      billId: billId || null,
      performedBy: session.name,
      createdById: session.id,
    },
    include: { creditAccount: true, debitAccount: true },
  })

  return NextResponse.json({ voucher })
}
