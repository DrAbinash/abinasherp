import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getStaffSession } from '@/lib/session'
import { generateBillNumber, classifyPaymentMethod, istDateLabel } from '@/lib/auth'
import { autoVoucherForPayment } from '@/lib/seed'

// GET /api/bills — list bills with filters
export async function GET(req: NextRequest) {
  const session = await getStaffSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q') || ''
  const status = searchParams.get('status') || ''
  const from = searchParams.get('from') || ''
  const to = searchParams.get('to') || ''
  const limit = parseInt(searchParams.get('limit') || '50')

  const where: Record<string, unknown> = {}
  if (status) where.status = status
  if (q) {
    where.OR = [
      { billNumber: { contains: q } },
      { patient: { name: { contains: q } } },
      { patient: { phone: { contains: q } } },
      { patient: { patientId: { contains: q } } },
    ]
  }
  if (from || to) {
    where.createdAt = {}
    if (from) where.createdAt.gte = new Date(from + 'T00:00:00+05:30')
    if (to) where.createdAt.lte = new Date(to + 'T23:59:59+05:30')
  }

  const bills = await db.bill.findMany({
    where,
    take: limit,
    orderBy: { createdAt: 'desc' },
    include: {
      patient: true,
      order: { include: { doctor: true, orderTests: { include: { test: true } } } },
      _count: { select: { payments: true } },
    },
  })
  return NextResponse.json({ bills })
}

// POST /api/bills — create bill (with idempotency, double-billing guards, inline payments)
export async function POST(req: NextRequest) {
  const session = await getStaffSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { orderId, discount, discountReason, discountReasonNote, payments, dueDate, clientRef } = body

  if (!orderId) return NextResponse.json({ error: 'orderId required' }, { status: 400 })

  // Idempotency check
  if (clientRef) {
    const existing = await db.bill.findFirst({
      where: { clientRef, status: { not: 'cancelled' } },
    })
    if (existing) {
      return NextResponse.json({ bill: existing, _idempotent: true })
    }
  }

  // Load order with tests
  const order = await db.order.findUnique({
    where: { id: orderId },
    include: {
      patient: true,
      doctor: true,
      orderTests: { include: { test: true } },
    },
  })
  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

  // Double-billing guard
  const existingBill = await db.bill.findFirst({
    where: { orderId, status: { not: 'cancelled' } },
  })
  if (existingBill) {
    return NextResponse.json({ error: 'Order already has an active bill', bill: existingBill }, { status: 409 })
  }

  const subtotal = order.totalAmount
  const discountAmt = parseFloat(discount || '0')

  // Discount validation
  if (discountAmt > 0) {
    if (!discountReason) {
      return NextResponse.json({ error: 'Discount reason required' }, { status: 400 })
    }
    if (discountAmt > subtotal) {
      return NextResponse.json({ error: 'Discount cannot exceed subtotal' }, { status: 400 })
    }
    // Non-admin discount cap
    if (!session.isOwner && session.maxDiscount > 0) {
      const maxAllowed = (subtotal * session.maxDiscount) / 100
      if (discountAmt > maxAllowed) {
        return NextResponse.json({ error: `Discount exceeds your max (${session.maxDiscount}%)` }, { status: 403 })
      }
    }
  }

  const taxAmount = 0
  const totalAmount = subtotal - discountAmt + taxAmount

  // Inline payments
  const inlinePayments: Array<{ amount: number; method: string; reference?: string; notes?: string }> = payments || []
  const paidAmountInline = inlinePayments
    .filter((p) => p.method !== 'online')
    .reduce((s, p) => s + p.amount, 0)
  const balanceAmountInline = Math.max(0, totalAmount - paidAmountInline)

  let status: string
  if (paidAmountInline >= totalAmount) status = 'paid'
  else if (paidAmountInline > 0) status = 'partial'
  else status = 'pending'

  // Generate bill number (global MAX+1 within YYYYMM bucket)
  const now = new Date()
  const yyyy = now.getFullYear()
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const prefix = `${yyyy}${mm}`
  const recentBills = await db.bill.findMany({
    where: { billNumber: { startsWith: prefix } },
    select: { billNumber: true },
  })
  let maxSeq = 0
  for (const b of recentBills) {
    const seq = parseInt(b.billNumber.slice(prefix.length), 10)
    if (!isNaN(seq) && seq > maxSeq) maxSeq = seq
  }
  const billNumber = generateBillNumber(maxSeq + 1)

  // Resolve ledger: order → doctor → walk-in
  let ledgerId = order.ledgerId || order.doctor?.ledgerId || null

  const bill = await db.bill.create({
    data: {
      billNumber,
      orderId: order.id,
      patientId: order.patientId,
      subtotal,
      discount: discountAmt,
      discountReason: discountReason || null,
      discountReasonNote: discountReasonNote || null,
      taxAmount,
      totalAmount,
      paidAmount: paidAmountInline,
      balanceAmount: balanceAmountInline,
      status,
      ledgerId,
      dueDate: dueDate || null,
      createdById: session.id,
      createdByName: session.name,
      clientRef: clientRef || null,
      originalTotal: totalAmount,
    },
    include: {
      patient: true,
      order: { include: { doctor: true, orderTests: { include: { test: true } } } },
    },
  })

  // Insert payment rows + auto-vouchers
  for (const p of inlinePayments) {
    const classified = classifyPaymentMethod(p.method)
    const payment = await db.payment.create({
      data: {
        billId: bill.id,
        amount: p.amount,
        method: classified.method,
        referenceNumber: p.reference || null,
        notes: p.notes || null,
        recordedById: session.id,
        recordedByName: session.name,
      },
    })
    // Fire-and-forget auto-voucher (non-blocking best-effort)
    try {
      const voucher = await autoVoucherForPayment(bill.id, p.amount, classified.method, session.id, session.name)
      if (voucher) {
        await db.payment.update({ where: { id: payment.id }, data: { voucherId: voucher.id } })
      }
    } catch (e) {
      console.error('Auto-voucher failed:', e)
    }
  }

  // Mark order as completed
  await db.order.update({
    where: { id: order.id },
    data: { status: 'completed' },
  })

  // Auto-deduct inventory (fire-and-forget — never blocks billing)
  let inventoryDeduction: { deducted: any[]; errors: string[] } | null = null
  try {
    const { autoDeductInventoryForBill } = await import('@/lib/inventory-auto-deduct')
    inventoryDeduction = await autoDeductInventoryForBill(
      bill.id,
      bill.billNumber,
      order.orderTests.map((ot) => ({ testId: ot.testId, testName: ot.test.name })),
      session.name,
    )
    if (inventoryDeduction.errors.length > 0) {
      console.warn('Inventory deduction errors:', inventoryDeduction.errors)
    }
  } catch (e) {
    console.error('Auto-deduct inventory failed:', e)
  }

  return NextResponse.json({ bill, inventoryDeduction })
}
