import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getStaffSession } from '@/lib/session'
import { generateExpenseId, istDateLabel, generateVoucherNumber } from '@/lib/auth'
import { autoVoucherForExpense } from '@/lib/seed'

// POST /api/expense-bills/:id/post — confirm OCR data and post to ledger
// Creates: Expense + Voucher (debit expense account, credit supplier (Sundry Creditor) if credit, or cash/bank if paid)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getStaffSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json().catch(() => ({}))
  // Body can contain overrides: { category, description, totalAmount, paymentMode, supplierId, billDate }

  const bill = await db.expenseBill.findUnique({
    where: { id },
    include: { supplier: true },
  })
  if (!bill) return NextResponse.json({ error: 'Bill not found' }, { status: 404 })
  if (bill.status === 'posted') {
    return NextResponse.json({ error: 'Bill already posted' }, { status: 400 })
  }

  const category = body.category || bill.category || 'miscellaneous'
  const description = body.description || bill.description || `Bill ${bill.billNumber || bill.billId} — ${bill.supplierName}`
  const totalAmount = parseFloat(body.totalAmount || bill.totalAmount)
  const paymentMode = body.paymentMode || 'credit' // default to credit (supplier)
  const billDate = body.billDate || bill.billDate || istDateLabel()
  const supplierId = body.supplierId || bill.supplierId

  // 1. Create the Expense record
  const now = new Date()
  const yy = String(now.getFullYear()).slice(-2)
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const yyMm = `${yy}${mm}`
  const expenseCounter = await db.expenseCounter.upsert({
    where: { yearMonth: yyMm },
    update: { counter: { increment: 1 } },
    create: { yearMonth: yyMm, counter: 1 },
  })
  const expenseId = generateExpenseId(yyMm, expenseCounter.counter)

  const expense = await db.expense.create({
    data: {
      expenseId,
      category,
      description,
      amount: totalAmount,
      expenseDate: billDate,
      paymentMode: paymentMode === 'credit' ? 'bank-transfer' : paymentMode,
      paidTo: bill.supplierName,
      approvedById: session.id,
      approvedByName: session.name,
      notes: `Auto-posted from bill ${bill.billId}`,
    },
  })

  // 2. Create the Voucher
  // Debit: Expense account (Expenses — <category>)
  // Credit: Supplier ledger (if credit) OR Cash/Bank (if cash/online/cheque)
  const expenseAccountName = `Expenses — ${category}`
  let expenseAccount = await db.account.findUnique({ where: { name: expenseAccountName } })
  if (!expenseAccount) {
    expenseAccount = await db.account.create({
      data: {
        name: expenseAccountName,
        type: 'expense',
        tallyGroup: 'Indirect Expenses',
      },
    })
  }

  let creditAccountId: string
  if (paymentMode === 'credit' && supplierId) {
    // Use supplier's ledger account
    const supplier = await db.supplier.findUnique({ where: { id: supplierId } })
    if (supplier?.ledgerAccountId) {
      creditAccountId = supplier.ledgerAccountId
    } else {
      // Fall back to Sundry Creditors account
      let creditors = await db.account.findUnique({ where: { name: 'Sundry Creditors' } })
      if (!creditors) {
        creditors = await db.account.create({
          data: { name: 'Sundry Creditors', type: 'liability', tallyGroup: 'Sundry Creditors' },
        })
      }
      creditAccountId = creditors.id
    }
  } else {
    // Use cash/bank account based on payment mode
    const modeAccountMap: Record<string, string> = {
      cash: 'Cash in Hand',
      'bank-transfer': 'Bank Account',
      cheque: 'Cheque Collections',
      upi: 'UPI Collections',
      card: 'Card Collections',
    }
    const modeAccountName = modeAccountMap[paymentMode] || 'Bank Account'
    let modeAccount = await db.account.findUnique({ where: { name: modeAccountName } })
    if (!modeAccount) {
      modeAccount = await db.account.create({
        data: { name: modeAccountName, type: 'bank', tallyGroup: 'Bank Accounts' },
      })
    }
    creditAccountId = modeAccount.id
  }

  const voucherCount = await db.voucher.count({ where: { type: 'payment' } })
  const voucherNumber = generateVoucherNumber('payment', voucherCount + 1)

  const voucher = await db.voucher.create({
    data: {
      voucherNumber,
      type: 'payment',
      date: billDate,
      creditAccountId,
      debitAccountId: expenseAccount.id,
      amount: totalAmount,
      particular: `${description} (Bill ${bill.billId})`,
      reference: bill.billId,
      performedBy: session.name,
      createdById: session.id,
    },
  })

  // 3. Update the bill
  const updatedBill = await db.expenseBill.update({
    where: { id },
    data: {
      status: 'posted',
      expenseId: expense.id,
      voucherId: voucher.id,
      confirmedById: session.id,
      confirmedByName: session.name,
      category,
      description,
      totalAmount,
      // Update supplier if changed
      ...(supplierId && supplierId !== bill.supplierId ? { supplierId } : {}),
    },
    include: { supplier: true },
  })

  return NextResponse.json({ bill: updatedBill, expense, voucher })
}

// PATCH /api/expense-bills/:id/confirm — edit OCR-extracted data before posting
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getStaffSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json().catch(() => ({}))

  const update: Record<string, unknown> = {}
  if (body.supplierName !== undefined) update.supplierName = body.supplierName
  if (body.supplierGSTIN !== undefined) update.supplierGSTIN = body.supplierGSTIN
  if (body.billNumber !== undefined) update.billNumber = body.billNumber
  if (body.billDate !== undefined) update.billDate = body.billDate
  if (body.category !== undefined) update.category = body.category
  if (body.description !== undefined) update.description = body.description
  if (body.subtotal !== undefined) update.subtotal = parseFloat(body.subtotal)
  if (body.taxAmount !== undefined) update.taxAmount = parseFloat(body.taxAmount)
  if (body.totalAmount !== undefined) update.totalAmount = parseFloat(body.totalAmount)
  if (body.lineItems !== undefined) update.lineItems = JSON.stringify(body.lineItems)
  if (body.supplierId !== undefined) update.supplierId = body.supplierId
  if (body.notes !== undefined) update.notes = body.notes
  update.status = 'confirmed'

  const bill = await db.expenseBill.update({ where: { id }, data: update, include: { supplier: true } })
  return NextResponse.json({ bill })
}
