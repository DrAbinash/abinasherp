import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// READINESS probe — confirms the database connection is reachable.
// Use this for deploy gating / manual checks, NOT as the Docker liveness probe
// (see /api/health). Returns 503 when the DB is unreachable so callers can wait.
export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`
    return NextResponse.json({ ok: true, status: 'ready', db: 'up' })
  } catch {
    return NextResponse.json({ ok: false, status: 'degraded', db: 'down' }, { status: 503 })
  }
}
