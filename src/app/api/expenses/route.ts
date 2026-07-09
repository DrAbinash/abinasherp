import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getStaffSession } from '@/lib/session'
import { generateExpenseId, istDateLabel } from '@/lib/auth'
import { autoVoucherForExpense } from '@/lib/seed'

export async function GET(req: NextRequest) {
  const session = await getStaffSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const category = searchParams.get('category') || ''
  const from = searchParams.get('from') || ''
  const to = searchParams.get('to') || ''
  const limit = parseInt(searchParams.get('limit') || '100')

  const where: Record<string, unknown> = {}
  if (category) where.category = category
  if (from || to) {
    where.expenseDate = {}
    if (from) where.expenseDate.gte = from
    if (to) where.expenseDate.lte = to
  }

  const expenses = await db.expense.findMany({
    where,
    take: limit,
    orderBy: { expenseDate: 'desc' },
  })

  // Summary by category
  const allExpenses = await db.expense.findMany()
  const byCategory: Record<string, number> = {}
  for (const e of allExpenses) {
    byCategory[e.category] = (byCategory[e.category] || 0) + e.amount
  }

  return NextResponse.json({ expenses, summary: byCategory, total: Object.values(byCategory).reduce((s, v) => s + v, 0) })
}

export async function POST(req: NextRequest) {
  const session = await getStaffSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { category, description, amount, expenseDate, paymentMode, paidTo, notes } = body
  if (!category || !description || !amount) {
    return NextResponse.json({ error: 'category, description, amount required' }, { status: 400 })
  }

  // Generate expense ID using YYMM counter
  const now = new Date()
  const yy = String(now.getFullYear()).slice(-2)
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const yyMm = `${yy}${mm}`
  const counter = await db.expenseCounter.upsert({
    where: { yearMonth: yyMm },
    update: { counter: { increment: 1 } },
    create: { yearMonth: yyMm, counter: 1 },
  })
  const expenseId = generateExpenseId(yyMm, counter.counter)

  const expense = await db.expense.create({
    data: {
      expenseId,
      category,
      description,
      amount: parseFloat(amount),
      expenseDate: expenseDate || istDateLabel(),
      paymentMode: paymentMode || 'cash',
      paidTo,
      approvedById: session.id,
      approvedByName: session.name,
      notes,
    },
  })

  // Auto-voucher (debit expense, credit cash/bank)
  try {
    const voucher = await autoVoucherForExpense(expenseId, category, parseFloat(amount), paymentMode || 'cash', session.id, session.name)
    if (voucher) {
      await db.expense.update({ where: { id: expense.id }, data: { voucherId: voucher.id } })
    }
  } catch (e) {
    console.error('Expense auto-voucher failed:', e)
  }

  return NextResponse.json({ expense })
}
