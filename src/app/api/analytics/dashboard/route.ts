import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getStaffSession } from '@/lib/session'
import { istDateLabel } from '@/lib/auth'

export async function GET() {
  const session = await getStaffSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const now = new Date()
  const thirtyDaysAgo = new Date(now)
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29)
  thirtyDaysAgo.setHours(0, 0, 0, 0)

  const [bills30d, payments30d, allBills, allOrders, payouts, commissionRules] = await Promise.all([
    db.bill.findMany({
      where: { createdAt: { gte: thirtyDaysAgo }, status: { not: 'cancelled' } },
      include: { order: { include: { orderTests: { include: { test: true } }, doctor: true } } },
    }),
    db.payment.findMany({
      where: { createdAt: { gte: thirtyDaysAgo } },
    }),
    db.bill.findMany({
      where: { status: { in: ['pending', 'partial'] } },
      select: { balanceAmount: true, createdAt: true },
    }),
    db.order.findMany({
      where: { createdAt: { gte: thirtyDaysAgo } },
      include: { orderTests: { include: { test: true } }, doctor: true, bills: true },
    }),
    db.doctorPayout.findMany({
      where: { createdAt: { gte: thirtyDaysAgo } },
      select: { doctorId: true, amount: true, doctor: { select: { name: true } } },
    }),
    db.commissionRule.findMany(),
  ])

  const revenueTrend: Array<{ date: string; revenue: number; billed: number; bills: number }> = []
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    const label = istDateLabel(d)
    const s = new Date(label + 'T00:00:00+05:30')
    const e = new Date(label + 'T23:59:59+05:30')
    const dayBills = bills30d.filter((b) => b.createdAt >= s && b.createdAt <= e)
    const dayPayments = payments30d.filter((p) => p.createdAt >= s && p.createdAt <= e)
    revenueTrend.push({
      date: label,
      revenue: dayPayments.filter((p) => p.amount > 0).reduce((sum, p) => sum + p.amount, 0),
      billed: dayBills.reduce((sum, b) => sum + b.totalAmount, 0),
      bills: dayBills.length,
    })
  }

  const testAgg: Record<string, { name: string; code: string; revenue: number; volume: number }> = {}
  for (const order of allOrders) {
    for (const ot of order.orderTests) {
      if (ot.status === 'cancelled') continue
      const key = ot.testId
      if (!testAgg[key]) {
        testAgg[key] = { name: ot.test.name, code: ot.test.code, revenue: 0, volume: 0 }
      }
      testAgg[key].revenue += ot.price
      testAgg[key].volume += 1
    }
  }
  const topTestsByRevenue = Object.values(testAgg)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10)
  const topTestsByVolume = Object.values(testAgg)
    .sort((a, b) => b.volume - a.volume)
    .slice(0, 10)

  const doctorAgg: Record<string, { name: string; specialization: string; revenue: number; patients: Set<string>; commission: number }> = {}
  for (const order of allOrders) {
    if (!order.doctorId) continue
    if (!doctorAgg[order.doctorId]) {
      doctorAgg[order.doctorId] = {
        name: order.doctor?.name || 'Unknown',
        specialization: order.doctor?.specialization || '',
        revenue: 0,
        patients: new Set(),
        commission: 0,
      }
    }
    const orderRevenue = order.bills
      .filter((b) => b.status !== 'cancelled')
      .reduce((s, b) => s + b.paidAmount, 0)
    doctorAgg[order.doctorId].revenue += orderRevenue
    doctorAgg[order.doctorId].patients.add(order.patientId)
  }
  for (const p of payouts) {
    if (!doctorAgg[p.doctorId]) {
      doctorAgg[p.doctorId] = {
        name: p.doctor.name || 'Unknown',
        specialization: '',
        revenue: 0,
        patients: new Set(),
        commission: 0,
      }
    }
    doctorAgg[p.doctorId].commission += p.amount
  }
  const doctorWise = Object.entries(doctorAgg).map(([id, v]) => ({
    doctorId: id,
    name: v.name,
    specialization: v.specialization,
    revenue: v.revenue,
    patients: v.patients.size,
    commission: v.commission,
  }))

  const methodMix: Record<string, number> = {}
  for (const p of payments30d) {
    if (p.amount > 0) {
      methodMix[p.method] = (methodMix[p.method] || 0) + p.amount
    }
  }

  const peakHours: Array<{ hour: number; bills: number }> = []
  for (let h = 0; h < 24; h++) {
    peakHours.push({ hour: h, bills: 0 })
  }
  for (const b of bills30d) {
    const hr = new Date(b.createdAt).toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata', hour12: false, hour: '2-digit' })
    const hourNum = parseInt(hr)
    if (!isNaN(hourNum) && hourNum >= 0 && hourNum < 24) {
      peakHours[hourNum].bills += 1
    }
  }

  const today = new Date()
  const aging = { zero30: 0, thirty60: 0, sixtyPlus: 0 }
  for (const b of allBills) {
    const balance = b.balanceAmount
    if (balance <= 0) continue
    const ageDays = Math.floor((today.getTime() - b.createdAt.getTime()) / (1000 * 60 * 60 * 24))
    if (ageDays <= 30) aging.zero30 += balance
    else if (ageDays <= 60) aging.thirty60 += balance
    else aging.sixtyPlus += balance
  }

  const totalBilled30d = bills30d.reduce((s, b) => s + b.totalAmount, 0)
  const totalCollected30d = payments30d.filter((p) => p.amount > 0).reduce((s, p) => s + p.amount, 0)
  const collectionEfficiency = totalBilled30d > 0 ? (totalCollected30d / totalBilled30d) * 100 : 0

  const totalCommissionRules = commissionRules.length

  return NextResponse.json({
    period: { from: thirtyDaysAgo.toISOString(), to: now.toISOString(), days: 30 },
    revenueTrend,
    topTests: { byRevenue: topTestsByRevenue, byVolume: topTestsByVolume },
    doctorWise,
    paymentMethodMix: methodMix,
    peakHours,
    outstandingDuesAging: aging,
    collectionEfficiency: {
      percentage: collectionEfficiency,
      billed: totalBilled30d,
      collected: totalCollected30d,
    },
    summary: {
      totalBills: bills30d.length,
      totalRevenue: totalCollected30d,
      totalBilled: totalBilled30d,
      totalCommissionRules,
      totalDoctors: Object.keys(doctorAgg).length,
    },
  })
}
