import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getStaffSession } from '@/lib/session'
import { generateExpenseId, istDateLabel, generateVoucherNumber } from '@/lib/auth'
import { autoVoucherForExpense } from '@/lib/seed'

// GET /api/expense-bills — list uploaded bills
export async function GET(req: NextRequest) {
  const session = await getStaffSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status') || ''

  const where: Record<string, unknown> = {}
  if (status) where.status = status

  const bills = await db.expenseBill.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: { supplier: true },
    take: 100,
  })
  return NextResponse.json({ bills })
}

// POST /api/expense-bills — save the OCR-extracted bill for review (status=pending)
export async function POST(req: NextRequest) {
  const session = await getStaffSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const {
    supplierName, supplierGSTIN, supplierPAN, billNumber, billDate, dueDate,
    category, description, lineItems, subtotal, taxAmount, totalAmount,
    paymentMode, ocrConfidence, filePath, fileType, fileName, notes,
  } = body

  if (!supplierName || !totalAmount) {
    return NextResponse.json({ error: 'supplierName and totalAmount required' }, { status: 400 })
  }

  // Generate EB-YYMM-####
  const now = new Date()
  const yy = String(now.getFullYear()).slice(-2)
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const yyMm = `${yy}${mm}`
  const counter = await db.expenseBillCounter.upsert({
    where: { yearMonth: yyMm },
    update: { counter: { increment: 1 } },
    create: { yearMonth: yyMm, counter: 1 },
  })
  const billId = `EB-${yyMm}-${String(counter.counter).padStart(4, '0')}`

  // Try to match supplier by name or GSTIN
  let supplier = await db.supplier.findFirst({
    where: {
      OR: [
        { name: supplierName },
        ...(supplierGSTIN ? [{ gstin: supplierGSTIN }] : []),
      ],
    },
  })

  // Auto-create supplier if GSTIN is present and not found
  if (!supplier && supplierGSTIN) {
    const supplierCount = await db.supplier.count()
    const newSupplierId = `SUP-${String(supplierCount + 1).padStart(4, '0')}`
    let ledger = await db.account.findUnique({ where: { name: supplierName } })
    if (!ledger) {
      ledger = await db.account.create({
        data: {
          name: supplierName,
          type: 'liability',
          tallyGroup: 'Sundry Creditors',
          gstApplicable: true,
          gstNumber: supplierGSTIN,
          pan: supplierPAN,
        },
      })
    }
    supplier = await db.supplier.create({
      data: {
        supplierId: newSupplierId,
        name: supplierName,
        type: 'creditor',
        gstin: supplierGSTIN,
        pan: supplierPAN,
        ledgerAccountId: ledger.id,
      },
    })
  }

  const bill = await db.expenseBill.create({
    data: {
      billId,
      supplierId: supplier?.id || null,
      supplierName,
      supplierGSTIN: supplierGSTIN || null,
      billNumber: billNumber || null,
      billDate: billDate || istDateLabel(),
      dueDate: dueDate || null,
      category: category || 'miscellaneous',
      description: description || null,
      lineItems: lineItems ? JSON.stringify(lineItems) : null,
      subtotal: parseFloat(subtotal || '0'),
      taxAmount: parseFloat(taxAmount || '0'),
      totalAmount: parseFloat(totalAmount || '0'),
      ocrConfidence: parseFloat(ocrConfidence || '0'),
      status: 'pending',
      filePath: filePath || null,
      fileType: fileType || null,
      fileName: fileName || null,
      uploadedById: session.id,
      uploadedByName: session.name,
      notes: notes || null,
    },
    include: { supplier: true },
  })

  return NextResponse.json({ bill })
}
