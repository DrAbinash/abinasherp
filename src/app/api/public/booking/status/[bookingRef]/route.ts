import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/public/booking/status/:bookingRef?phone=XXXX — check booking status (for polling)
// PUBLIC — no auth. To prevent IDOR/enumeration leaking patient PII, full details
// are only returned when the `phone` query param matches the last 4 digits of the
// booking's patientPhone. Otherwise only { bookingRef, status } is returned.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ bookingRef: string }> },
) {
  const { bookingRef } = await params
  const phoneParam = (req.nextUrl.searchParams.get('phone') || '').replace(/\D/g, '')
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

  // Second-factor check: require last-4 of the booking phone before exposing PII.
  const last4 = (booking.patientPhone || '').replace(/\D/g, '').slice(-4)
  const phoneMatches = last4.length === 4 && phoneParam.slice(-4) === last4

  if (!phoneMatches) {
    // Minimal, non-PII response — enough to poll status, nothing to enumerate.
    return NextResponse.json({ booking: { bookingRef: booking.bookingRef, status: booking.status } })
  }

  return NextResponse.json({ booking })
}
