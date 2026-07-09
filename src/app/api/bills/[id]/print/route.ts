import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getStaffSession } from '@/lib/session'

// GET /api/bills/:id/print — return bill data formatted for print (A5 patient/office/duplicate copies)
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getStaffSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const bill = await db.bill.findUnique({
    where: { id },
    include: {
      patient: true,
      order: { include: { doctor: true, orderTests: { include: { test: { include: { category: true } } } } } },
      payments: true,
    },
  })
  if (!bill) return NextResponse.json({ error: 'Bill not found' }, { status: 404 })

  const clinic = await db.clinic.findFirst()

  // Three print copies — patient, office, duplicate
  const copies = ['PATIENT COPY', 'OFFICE COPY', 'DUPLICATE COPY'].map((copyType) => ({
    copyType,
    clinic: {
      name: clinic?.name || 'Care Diagnostic Centre',
      address: clinic?.address || '',
      phone: clinic?.phone || '',
      email: clinic?.email || '',
      gstin: clinic?.gstin || '',
      registrationNo: clinic?.registrationNo || '',
    },
    bill: {
      billNumber: bill.billNumber,
      billDate: bill.createdAt,
      status: bill.status,
      subtotal: bill.subtotal,
      discount: bill.discount,
      discountReason: bill.discountReason,
      taxAmount: bill.taxAmount,
      totalAmount: bill.totalAmount,
      paidAmount: bill.paidAmount,
      balanceAmount: bill.balanceAmount,
      refundAmount: bill.refundAmount,
      dueDate: bill.dueDate,
      createdByName: bill.createdByName,
    },
    patient: {
      name: bill.patient.name,
      patientId: bill.patient.patientId,
      phone: bill.patient.phone,
      age: bill.patient.age,
      gender: bill.patient.gender,
      address: bill.patient.address,
    },
    doctor: bill.order.doctor ? {
      name: bill.order.doctor.name,
      specialization: bill.order.doctor.specialization,
    } : null,
    orderTests: bill.order.orderTests.map((ot) => ({
      name: ot.test.name,
      code: ot.test.code,
      category: ot.test.category?.name || '',
      price: ot.price,
      status: ot.status,
    })),
    payments: bill.payments.map((p) => ({
      amount: p.amount,
      method: p.method,
      referenceNumber: p.referenceNumber,
      date: p.createdAt,
    })),
  }))

  return NextResponse.json({ copies })
}
