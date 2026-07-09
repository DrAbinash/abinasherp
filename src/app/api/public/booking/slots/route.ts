import { NextResponse } from 'next/server'

// GET /api/public/booking/slots — available time slots
// Returns predefined slots (in production these would come from branch config)
export async function GET() {
  // Standard diagnostic centre slots
  const morningSlots = ['07:00', '07:30', '08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30']
  const afternoonSlots = ['12:00', '12:30', '13:00', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30']
  const eveningSlots = ['17:00', '17:30', '18:00', '18:30', '19:00', '19:30', '20:00']

  return NextResponse.json({
    slots: {
      morning: morningSlots,
      afternoon: afternoonSlots,
      evening: eveningSlots,
    },
    note: 'Fasting tests (lipid profile, blood sugar) recommended for morning slots. Please arrive 10 minutes early.',
  })
}
