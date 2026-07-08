import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { istDateLabel } from '@/lib/auth'

// GET /api/public/booking/packages — public list of available packages
// NO AUTH REQUIRED (public booking page)
export async function GET() {
  const packages = await db.package.findMany({
    where: { isActive: true },
    orderBy: { sellingPrice: 'asc' },
    select: {
      id: true, packageId: true, name: true, description: true, category: true,
      totalTests: true, mrp: true, sellingPrice: true, durationHours: true,
      fastingRequired: true, instructions: true,
    },
  })
  return NextResponse.json({ packages })
}
