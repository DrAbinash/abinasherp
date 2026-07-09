import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { istDateLabel } from '@/lib/auth'
import { getStaffSession } from '@/lib/session'

// GET /api/home-collection — list requests (staff view)
export async function GET(req: NextRequest) {
  const session = await getStaffSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status') || ''
  const date = searchParams.get('date') || ''
  const q = searchParams.get('q') || ''

  const where: any = {}
  if (status) where.status = status
  if (date) where.preferredDate = date
  if (q) {
    where.OR = [
      { patientName: { contains: q, mode: 'insensitive' as const } },
      { patientPhone: { contains: q, mode: 'insensitive' as const } },
      { requestId: { contains: q, mode: 'insensitive' as const } },
    ]
  }

  const requests = await db.homeCollectionRequest.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 100,
  })
  return NextResponse.json({ requests })
}

// POST /api/home-collection — create request (public + staff)
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const {
    patientName, patientPhone, patientEmail, patientAge, patientGender,
    address, city, state, pincode, landmark,
    testIds, packageId, preferredDate, preferredSlot,
    paymentMethod, source,
  } = body

  if (!patientName || !patientPhone || !address || !preferredDate) {
    return NextResponse.json({ error: 'patientName, patientPhone, address, preferredDate required' }, { status: 400 })
  }

  // Compute amount
  let amount = 0
  let packageName: string | null = null
  let testNames: string[] = []
  let resolvedTestIds: string[] = []

  if (packageId) {
    const pkg = await db.package.findUnique({ where: { id: packageId, isActive: true } })
    if (!pkg) return NextResponse.json({ error: 'Package not found' }, { status: 404 })
    amount = pkg.sellingPrice
    packageName = pkg.name
    resolvedTestIds = JSON.parse(pkg.testIds || '[]')
    const tests = await db.test.findMany({ where: { id: { in: resolvedTestIds } }, select: { name: true } })
    testNames = tests.map((t) => t.name)
  } else if (Array.isArray(testIds) && testIds.length > 0) {
    const tests = await db.test.findMany({ where: { id: { in: testIds }, isActive: true } })
    amount = tests.reduce((s, t) => s + t.price, 0)
    resolvedTestIds = testIds
    testNames = tests.map((t) => t.name)
  } else {
    return NextResponse.json({ error: 'packageId or testIds required' }, { status: 400 })
  }

  // Generate request ID
  const today = istDateLabel().replace(/-/g, '')
  const counter = await db.homeCollectionCounter.upsert({
    where: { dateStr: today },
    update: { counter: { increment: 1 } },
    create: { dateStr: today, counter: 1 },
  })
  const requestId = `HC-${today}-${String(counter.counter).padStart(4, '0')}`

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || ''
  const userAgent = req.headers.get('user-agent') || ''

  const request = await db.homeCollectionRequest.create({
    data: {
      requestId,
      patientName,
      patientPhone,
      patientEmail: patientEmail || null,
      patientAge: patientAge ? parseInt(patientAge) : null,
      patientGender: patientGender || null,
      address,
      city,
      state: state || null,
      pincode,
      landmark: landmark || null,
      testIds: JSON.stringify(resolvedTestIds),
      testNames: JSON.stringify(testNames),
      packageId: packageId || null,
      packageName,
      preferredDate,
      preferredSlot: preferredSlot || 'morning',
      amount,
      paymentStatus: paymentMethod === 'cod' ? 'cod' : 'pending',
      paymentMethod: paymentMethod || 'cod',
      status: 'requested',
      source: source || 'online',
      ip,
      userAgent,
    },
  })

  return NextResponse.json({ request })
}
