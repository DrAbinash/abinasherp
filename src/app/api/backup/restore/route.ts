import { NextRequest, NextResponse } from 'next/server'
import { getStaffSession } from '@/lib/session'
import { spawn } from 'child_process'
import { writeFileSync, unlinkSync } from 'fs'
import { tmpdir } from 'os'
import path from 'path'

// POST /api/backup/restore — owner-only restore of a PostgreSQL plain-SQL dump
// produced by /api/backup/download. Streams the uploaded .sql into psql.
// Requires the `psql` binary (postgresql-client) in the runtime image.
export async function POST(req: NextRequest) {
  const session = await getStaffSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!session.isOwner) {
    return NextResponse.json({ error: 'Forbidden: owner role required' }, { status: 403 })
  }

  const dbUrl = process.env.DATABASE_URL || ''
  if (!dbUrl.startsWith('postgres')) {
    return NextResponse.json({ error: 'Restore requires a PostgreSQL DATABASE_URL' }, { status: 500 })
  }

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file uploaded (field name: file)' }, { status: 400 })
  if (file.size > 500 * 1024 * 1024) {
    return NextResponse.json({ error: 'File too large (max 500MB)' }, { status: 400 })
  }

  const text = await file.text()
  // Sanity-check it looks like a pg_dump plain-SQL file.
  if (!/CREATE TABLE|COPY |INSERT INTO|pg_dump/i.test(text.slice(0, 5000))) {
    return NextResponse.json({ error: 'File does not look like a PostgreSQL SQL dump' }, { status: 400 })
  }

  const tmpFile = path.join(tmpdir(), `care-erp-restore-${Date.now()}.sql`)
  try {
    writeFileSync(tmpFile, text)
    await new Promise<void>((resolve, reject) => {
      const child = spawn('psql', [dbUrl, '-v', 'ON_ERROR_STOP=1', '-f', tmpFile], { env: process.env })
      let stderr = ''
      child.stderr.on('data', (d) => { stderr += d.toString() })
      child.on('error', reject)
      child.on('close', (code) => {
        if (code === 0) resolve()
        else reject(new Error(stderr || `psql exited with code ${code}`))
      })
    })

    return NextResponse.json({
      ok: true,
      message: 'Database restored successfully. Restart the application if data looks stale.',
      restoredFrom: file.name,
      sizeBytes: text.length,
    })
  } catch (e: unknown) {
    console.error('[backup/restore] psql failed:', e)
    return NextResponse.json({ error: 'Restore failed. The dump may be incompatible or the database unreachable.' }, { status: 500 })
  } finally {
    try { unlinkSync(tmpFile) } catch { /* ignore */ }
  }
}
