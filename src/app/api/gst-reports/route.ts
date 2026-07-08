import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getStaffSession } from '@/lib/session'

// GET /api/gst-reports?type=gstr1|gstr3b&from=&to=
// GSTR-1: Outward supplies (sales vouchers with GST accounts)
// GSTR-3B: Summary of outward + inward supplies + ITC
export async function GET(req: NextRequest) {
  const session = await getStaffSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type') || 'gstr1'
  const from = searchParams.get('from') || ''
  const to = searchParams.get('to') || ''

  const dateWhere: Record<string, unknown> = {}
  if (from || to) {
    dateWhere.date = {}
    if (from) dateWhere.date.gte = from
    if (to) dateWhere.date.lte = to
  }

  if (type === 'gstr1') {
    // GSTR-1: All sales vouchers
    const salesVouchers = await db.voucher.findMany({
      where: { type: 'sales', ...dateWhere },
      include: { creditAccount: true, debitAccount: true },
      orderBy: { date: 'asc' },
    })

    // Also include receipt vouchers against GST-registered patients (treated as outward supply)
    const receiptVouchers = await db.voucher.findMany({
      where: { type: 'receipt', ...dateWhere },
      include: { creditAccount: true, debitAccount: true },
      orderBy: { date: 'asc' },
    })

    const allOutward = [...salesVouchers, ...receiptVouchers]
    const totalTaxableValue = allOutward.reduce((s, v) => s + v.amount, 0)
    // Assume 18% GST for demo (in production, derive from account.gstApplicable)
    const totalTax = allOutward
      .filter((v) => v.creditAccount.gstApplicable)
      .reduce((s, v) => s + (v.amount * 0.18), 0)

    return NextResponse.json({
      type: 'gstr1',
      period: { from, to },
      outwardSupplies: allOutward.map((v) => ({
        date: v.date,
        voucherNumber: v.voucherNumber,
        partyName: v.debitAccount.name,
        taxableValue: v.amount,
        cgst: v.creditAccount.gstApplicable ? v.amount * 0.09 : 0,
        sgst: v.creditAccount.gstApplicable ? v.amount * 0.09 : 0,
        igst: 0,
        total: v.creditAccount.gstApplicable ? v.amount * 1.18 : v.amount,
      })),
      totals: {
        count: allOutward.length,
        taxableValue: totalTaxableValue,
        cgst: totalTax / 2,
        sgst: totalTax / 2,
        igst: 0,
        totalTax,
        grandTotal: totalTaxableValue + totalTax,
      },
    })
  } else if (type === 'gstr3b') {
    // GSTR-3B: Summary
    const [salesVouchers, purchaseVouchers, receiptVouchers, paymentVouchers] = await Promise.all([
      db.voucher.findMany({ where: { type: 'sales', ...dateWhere } }),
      db.voucher.findMany({ where: { type: 'purchase', ...dateWhere } }),
      db.voucher.findMany({ where: { type: 'receipt', ...dateWhere } }),
      db.voucher.findMany({ where: { type: 'payment', ...dateWhere } }),
    ])

    const outwardSupplies = [...salesVouchers, ...receiptVouchers].reduce((s, v) => s + v.amount, 0)
    const inwardSupplies = [...purchaseVouchers, ...paymentVouchers].reduce((s, v) => s + v.amount, 0)
    const outputTax = outwardSupplies * 0.18
    const inputTax = inwardSupplies * 0.18
    const netTaxPayable = Math.max(0, outputTax - inputTax)

    return NextResponse.json({
      type: 'gstr3b',
      period: { from, to },
      summary: {
        outwardSupplies,
        inwardSupplies,
        outputTax,
        inputTax,
        netTaxPayable,
        itcCarriedForward: inputTax > outputTax ? inputTax - outputTax : 0,
      },
    })
  }

  return NextResponse.json({ error: 'Invalid type. Use gstr1 or gstr3b.' }, { status: 400 })
}
