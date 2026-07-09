import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getStaffSession } from '@/lib/session'
import { generateStaffId } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const session = await getStaffSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q') || ''
  const role = searchParams.get('role') || ''
  const isActive = searchParams.get('isActive')

  const where: any = {}
  if (q) {
    where.OR = [
      { firstName: { contains: q, mode: 'insensitive' as const } },
      { lastName: { contains: q, mode: 'insensitive' as const } },
      { staffId: { contains: q, mode: 'insensitive' as const } },
      { phone: { contains: q, mode: 'insensitive' as const } },
    ]
  }
  if (role) where.role = role
  if (isActive !== null && isActive !== undefined) where.isActive = isActive === 'true'

  const staff = await db.staff.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      _count: { select: { advances: true, salaryPayments: true, attendance: true } },
    },
  })
  return NextResponse.json({ staff })
}

export async function POST(req: NextRequest) {
  const session = await getStaffSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { firstName, lastName, phone, email, role, department, joiningDate, baseSalary, address, emergencyContact, bankAccount, ifsc, notes } = body
  if (!firstName) return NextResponse.json({ error: 'firstName required' }, { status: 400 })

  // Generate staffId via StaffCounter
  const counter = await db.staffCounter.upsert({
    where: { id: 1 },
    update: { counter: { increment: 1 } },
    create: { id: 1, counter: 1 },
  })
  const staffId = generateStaffId(counter.counter)

  const staff = await db.staff.create({
    data: {
      staffId,
      firstName,
      lastName,
      phone,
      email,
      role: role || 'other',
      department,
      joiningDate,
      baseSalary: parseFloat(baseSalary || '0'),
      address,
      emergencyContact,
      bankAccount,
      ifsc,
      notes,
    },
  })
  return NextResponse.json({ staff })
}
