import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getStaffSession } from '@/lib/session'

// GET /api/corporates/invoices/:id — invoice detail
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getStaffSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const invoice = await db.corporateInvoice.findUnique({ where: { id } })
  if (!invoice) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Hydrate bill IDs to actual bills
  const billIds = JSON.parse(invoice.billIds || '[]') as string[]
  const bills = await db.bill.findMany({
    where: { id: { in: billIds } },
    include: { patient: true, order: { include: { doctor: true } } },
  })

  return NextResponse.json({ invoice, bills })
}

// PATCH /api/corporates/invoices/:id — mark as paid
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getStaffSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!session.isOwner) return NextResponse.json({ error: 'Admin only' }, { status: 403 })

  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const { status, paidAmount } = body

  const invoice = await db.corporateInvoice.findUnique({ where: { id } })
  if (!invoice) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const update: Record<string, unknown> = {}
  if (status) update.status = status
  if (paidAmount !== undefined) update.paidAmount = parseFloat(paidAmount)
  if (status === 'paid') {
    update.paidAt = new Date()
    update.paidAmount = invoice.totalAmount
  }

  const updated = await db.corporateInvoice.update({ where: { id }, data: update })

  // Update corporate outstanding balance
  if (status === 'paid') {
    await db.corporate.update({
      where: { id: invoice.corporateId },
      data: { outstandingBalance: { decrement: invoice.totalAmount - invoice.paidAmount } },
    })
  }

  return NextResponse.json({ invoice: updated })
}
