import { NextRequest, NextResponse } from 'next/server'
import { getStaffSession } from '@/lib/session'
import { spawn } from 'child_process'

// GET /api/backup/download — owner-only PostgreSQL logical backup (pg_dump).
// Streams a plain-SQL dump of the database that can be restored via
// POST /api/backup/restore. Requires the `pg_dump` binary (postgresql-client)
// to be present in the runtime image.
export async function GET(req: NextRequest) {
  const session = await getStaffSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  // Full database export contains every patient record, PIN hashes and secrets —
  // restrict to owners/super-admins only.
  if (!session.isOwner) {
    return NextResponse.json({ error: 'Forbidden: owner role required' }, { status: 403 })
  }

  const dbUrl = process.env.DATABASE_URL || ''
  if (!dbUrl.startsWith('postgres')) {
    return NextResponse.json({ error: 'Backup requires a PostgreSQL DATABASE_URL' }, { status: 500 })
  }

  const { searchParams } = new URL(req.url)
  if (searchParams.get('info') === 'true') {
    return NextResponse.json({
      timestamp: new Date().toISOString(),
      requestedBy: session.name,
      format: 'pg_dump plain SQL',
      instructions: 'POST this .sql file to /api/backup/restore (owner-only) to restore.',
    })
  }

  try {
    const buffer: Buffer = await new Promise((resolve, reject) => {
      const chunks: Buffer[] = []
      const child = spawn('pg_dump', [dbUrl, '--no-owner', '--no-privileges', '--clean', '--if-exists'], {
        env: process.env,
      })
      let stderr = ''
      child.stdout.on('data', (d) => chunks.push(Buffer.from(d)))
      child.stderr.on('data', (d) => { stderr += d.toString() })
      child.on('error', reject)
      child.on('close', (code) => {
        if (code === 0) resolve(Buffer.concat(chunks))
        else reject(new Error(stderr || `pg_dump exited with code ${code}`))
      })
    })

    const fileName = `care-erp-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.sql`
    return new NextResponse(buffer as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/sql',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Content-Length': String(buffer.length),
        'X-Backup-Timestamp': new Date().toISOString(),
      },
    })
  } catch (e: unknown) {
    console.error('[backup/download] pg_dump failed:', e)
    return NextResponse.json({ error: 'Backup failed. Ensure pg_dump is available and the database is reachable.' }, { status: 500 })
  }
}
