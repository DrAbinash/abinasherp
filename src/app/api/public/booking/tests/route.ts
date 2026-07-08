import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/public/booking/tests — public list of available tests
// NO AUTH REQUIRED
export async function GET() {
  const tests = await db.test.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
    select: {
      id: true, code: true, name: true, price: true, unit: true,
      category: { select: { name: true } },
    },
  })
  return NextResponse.json({
    tests: tests.map((t) => ({
      ...t,
      categoryName: t.category?.name || null,
    })),
  })
}
