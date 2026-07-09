import { NextResponse } from 'next/server'

// LIVENESS probe — used by the Docker HEALTHCHECK and compose healthcheck.
//
// Intentionally does NOT touch the database. A Docker HEALTHCHECK is a liveness
// probe: if it fails, Docker marks the container unhealthy and (with a restart
// policy) restarts it. Making liveness depend on the DB means a fresh DB or a
// transient DB hiccup restarts a perfectly-alive app — a crash-loop. DB
// readiness is a separate concern; see /api/health/db.
export function GET() {
  return NextResponse.json({ ok: true, status: 'live', ts: new Date().toISOString() })
}
