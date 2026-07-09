import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getStaffSession } from '@/lib/session'

// GET /api/search?q=
// Searches across: patients, doctors, bills, orders, vouchers, suppliers, staff
export async function GET(req: NextRequest) {
  const session = await getStaffSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q') || ''
  if (!q || q.length < 1) return NextResponse.json({ results: {} })

  const filter = { contains: q }

  const [patients, doctors, bills, orders, vouchers, suppliers, staff] = await Promise.all([
    db.patient.findMany({ where: { OR: [{ name: filter }, { phone: filter }, { patientId: filter }] }, take: 5 }),
    db.doctor.findMany({ where: { OR: [{ name: filter }, { specialization: filter }, { phone: filter }] }, take: 5 }),
    db.bill.findMany({ where: { OR: [{ billNumber: filter }] }, take: 5, include: { patient: true } }),
    db.order.findMany({ where: { OR: [{ orderNumber: filter }] }, take: 5, include: { patient: true } }),
    db.voucher.findMany({ where: { OR: [{ voucherNumber: filter }, { particular: filter }, { reference: filter }] }, take: 5, include: { creditAccount: true, debitAccount: true } }),
    db.supplier.findMany({ where: { OR: [{ name: filter }, { supplierId: filter }, { gstin: filter }] }, take: 5 }),
    db.staff.findMany({ where: { OR: [{ firstName: filter }, { lastName: filter }, { staffId: filter }, { phone: filter }] }, take: 5 }),
  ])

  return NextResponse.json({
    results: {
      patients,
      doctors,
      bills: bills.map((b) => ({ id: b.id, billNumber: b.billNumber, patientName: b.patient.name, totalAmount: b.totalAmount, status: b.status })),
      orders: orders.map((o) => ({ id: o.id, orderNumber: o.orderNumber, patientName: o.patient.name, status: o.status })),
      vouchers: vouchers.map((v) => ({ id: v.id, voucherNumber: v.voucherNumber, type: v.type, amount: v.amount, date: v.date, particular: v.particular })),
      suppliers,
      staff: staff.map((s) => ({ id: s.id, staffId: s.staffId, name: `${s.firstName} ${s.lastName || ''}`, role: s.role })),
    },
    totalResults: patients.length + doctors.length + bills.length + orders.length + vouchers.length + suppliers.length + staff.length,
  })
}
