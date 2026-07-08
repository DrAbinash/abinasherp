import { NextResponse } from 'next/server'
import { isUsbGateEnforced } from '@/lib/session'

export async function GET() {
  return NextResponse.json({ enforced: isUsbGateEnforced() })
}
