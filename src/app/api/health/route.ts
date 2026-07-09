import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// Lightweight liveness/readiness probe used by the Docker healthcheck.
// Confirms the process is up and the database connection is reachable.
export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`
    return NextResponse.json({ status: 'ok', db: 'up' })
  } catch {
    return NextResponse.json({ status: 'degraded', db: 'down' }, { status: 503 })
  }
}
