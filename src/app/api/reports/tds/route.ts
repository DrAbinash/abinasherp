import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getStaffSession } from '@/lib/session'

// GET /api/reports/tds?from=&to=
// Indian TDS compliance for professional fees paid to doctors
// Section 194J: TDS @ 10% on professional fees > ₹30,000 per financial year per payee
// (Threshold was ₹30,000, increased to ₹50,000 for non-audit individuals from FY 2025-26)
export async function GET(req: NextRequest) {
  const session = await getStaffSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from') || ''
  const to = searchParams.get('to') || ''
  const threshold = 50000 // FY 2025-26 threshold for individuals (non-audit)
  const tdsRate = 0.10 // 10% under Section 194J

  // Get all doctor payouts in the period
  const dateWhere: any = {}
  if (from) dateWhere.paymentDate = { gte: from }
  if (to) {
    if (!dateWhere.paymentDate) dateWhere.paymentDate = {}
    dateWhere.paymentDate.lte = to
  }

  const payouts = await db.doctorPayout.findMany({
    where: dateWhere,
    include: { doctor: true },
    orderBy: { paymentDate: 'asc' },
  })

  // Also include staff salary payments (TDS on salary is per-section 192, calculated at slab rate)
  const salaries = await db.staffSalaryPayment.findMany({
    where: dateWhere,
    include: { staff: true },
    orderBy: { paymentDate: 'asc' },
  })

  // Aggregate doctor payouts per doctor
  const doctorAgg: Record<string, { doctor: any; totalPaid: number; tdsDeductible: number; payouts: any[] }> = {}
  for (const p of payouts) {
    if (!doctorAgg[p.doctorId]) {
      doctorAgg[p.doctorId] = { doctor: p.doctor, totalPaid: 0, tdsDeductible: 0, payouts: [] }
    }
    doctorAgg[p.doctorId].totalPaid += p.amount
    doctorAgg[p.doctorId].payouts.push(p)
  }

  // Compute TDS for doctors (Section 194J — professional fees)
  const doctorRows = Object.values(doctorAgg).map((d) => {
    const tdsDeductible = d.totalPaid > threshold ? (d.totalPaid - threshold) * tdsRate : 0
    return {
      type: 'Doctor (Section 194J)',
      name: d.doctor.name,
      pan: d.doctor.name, // Replace with actual PAN if available
      specialization: d.doctor.specialization,
      paymentCount: d.payouts.length,
      totalPaid: d.totalPaid,
      threshold,
      tdsRate: `${tdsRate * 100}%`,
      tdsDeductible,
      netPayable: d.totalPaid - tdsDeductible,
    }
  })

  // Aggregate salaries per staff (Section 192 — calculated as per tax slab, simplified here as 0% if below taxable)
  const staffAgg: Record<string, { staff: any; totalGross: number; totalNet: number; payments: any[] }> = {}
  for (const s of salaries) {
    if (!staffAgg[s.staffId]) {
      staffAgg[s.staffId] = { staff: s.staff, totalGross: 0, totalNet: 0, payments: [] }
    }
    staffAgg[s.staffId].totalGross += s.baseAmount + s.bonus
    staffAgg[s.staffId].totalNet += s.netAmount
    staffAgg[s.staffId].payments.push(s)
  }

  // Simplified TDS on salary — basic exemption ₹2,50,000 per FY (old regime)
  // For demo: project annual = monthly gross × 12
  const basicExemption = 250000
  const staffRows = Object.values(staffAgg).map((s) => {
    const annualGross = s.totalGross * 12
    const taxableIncome = Math.max(0, annualGross - basicExemption)
    // Simplified 5% slab for ₹2.5L-5L
    const estimatedAnnualTax = taxableIncome <= 250000 ? taxableIncome * 0.05 : 12500 + (taxableIncome - 250000) * 0.2
    const tdsDeductible = (estimatedAnnualTax / 12) * s.payments.length // pro-rata
    return {
      type: 'Staff Salary (Section 192)',
      name: `${s.staff.firstName} ${s.staff.lastName || ''}`,
      pan: s.staff.firstName,
      role: s.staff.role,
      paymentCount: s.payments.length,
      totalPaid: s.totalGross,
      threshold: basicExemption,
      tdsRate: 'As per slab',
      tdsDeductible,
      netPayable: s.totalNet,
    }
  })

  const allRows = [...doctorRows, ...staffRows]
  const grandTotal = {
    totalPaid: allRows.reduce((s, r) => s + r.totalPaid, 0),
    tdsDeductible: allRows.reduce((s, r) => s + r.tdsDeductible, 0),
    netPayable: allRows.reduce((s, r) => s + r.netPayable, 0),
  }

  return NextResponse.json({
    period: { from, to },
    rows: allRows,
    totals: grandTotal,
    notes: [
      'Section 194J: TDS @ 10% on professional fees paid to doctors. Threshold ₹50,000 per FY (FY 2025-26).',
      'Section 192: TDS on salary calculated at employee\'s income tax slab rate. Basic exemption ₹2,50,000 (old regime).',
      'PAN is mandatory for TDS deduction at lower rate; otherwise 20% (higher rate) applies.',
      'TDS must be deposited by 7th of next month. TDS return (Form 26Q) filed quarterly.',
      'This is a simplified calculation. Consult your CA for actual TDS deduction.',
    ],
  })
}
