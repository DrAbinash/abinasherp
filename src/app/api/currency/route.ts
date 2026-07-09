import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getStaffSession } from '@/lib/session'

const SUPPORTED_CURRENCIES = [
  { code: 'INR', symbol: '₹', name: 'Indian Rupee', exchangeRate: 1 },
  { code: 'USD', symbol: '$', name: 'US Dollar', exchangeRate: 0.012 },
  { code: 'EUR', symbol: '€', name: 'Euro', exchangeRate: 0.011 },
  { code: 'NPR', symbol: 'रू', name: 'Nepalese Rupee', exchangeRate: 1.6 },
  { code: 'BDT', symbol: '৳', name: 'Bangladeshi Taka', exchangeRate: 1.32 },
  { code: 'LKR', symbol: 'Rs', name: 'Sri Lankan Rupee', exchangeRate: 3.6 },
]

export async function GET() {
  const session = await getStaffSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const clinic = await db.clinic.findFirst()
  const current = clinic?.currency || 'INR'

  return NextResponse.json({
    current,
    currencies: SUPPORTED_CURRENCIES,
    baseCurrency: 'INR',
    note: 'Exchange rates are static for demo purposes. Base currency is INR.',
  })
}

export async function POST(req: NextRequest) {
  const session = await getStaffSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!session.isOwner) {
    return NextResponse.json({ error: 'Only owner can change currency' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const { currency } = body

  const valid = SUPPORTED_CURRENCIES.find((c) => c.code === currency)
  if (!valid) {
    return NextResponse.json({ error: 'Unsupported currency code' }, { status: 400 })
  }

  const existing = await db.clinic.findFirst()
  if (!existing) {
    const clinic = await db.clinic.create({
      data: { name: 'Care Diagnostic Centre', currency: valid.code },
    })
    return NextResponse.json({ clinic, currency: valid })
  }

  const clinic = await db.clinic.update({
    where: { id: existing.id },
    data: { currency: valid.code },
  })

  return NextResponse.json({ clinic, currency: valid })
}
