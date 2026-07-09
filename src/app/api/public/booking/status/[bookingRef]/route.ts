import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/public/booking/status/:bookingRef — check booking status (for polling)
// PUBLIC — no auth (patient checks their own booking status)
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ bookingRef: string }> },
) {
  const { bookingRef } = await params
  const booking = await db.onlineBooking.findUnique({
    where: { bookingRef },
    select: {
      bookingRef: true,
      patientName: true,
      patientPhone: true,
      packageName: true,
      testNames: true,
      appointmentDate: true,
      timeSlot: true,
      amount: true,
      status: true,
      paymentMethod: true,
      iciciTransactionId: true,
      paymentCompletedAt: true,
      createdAt: true,
    },
  })

  if (!booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 })

  return NextResponse.json({ booking })
}
