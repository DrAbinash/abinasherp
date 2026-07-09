import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getStaffSession } from '@/lib/session'
import fs from 'fs'
import path from 'path'

function getDbPath(): string {
  const url = process.env.DATABASE_URL || ''
  const match = url.replace(/^file:/, '')
  return match
}

export async function GET(req: NextRequest) {
  const session = await getStaffSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const infoOnly = searchParams.get('info') === 'true'

  const dbPath = getDbPath()
  const uploadsDir = path.join(process.cwd(), 'uploads')

  const info = {
    timestamp: new Date().toISOString(),
    requestedBy: session.name,
    database: {
      path: dbPath,
      exists: fs.existsSync(dbPath),
      sizeBytes: fs.existsSync(dbPath) ? fs.statSync(dbPath).size : 0,
    },
    uploads: {
      path: uploadsDir,
      exists: fs.existsSync(uploadsDir),
    },
    instructions:
      'This download streams the live SQLite database file. To restore, POST the .db file to /api/backup/restore (owner-only). In a Docker deployment, this would tar.gz the DB plus uploads directory.',
  }

  if (infoOnly) {
    return NextResponse.json(info)
  }

  if (!fs.existsSync(dbPath)) {
    return NextResponse.json({ ...info, error: 'Database file not found' }, { status: 404 })
  }

  const buffer = fs.readFileSync(dbPath)
  const fileName = `care-erp-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.db`

  return new NextResponse(buffer as unknown as BodyInit, {
    status: 200,
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Content-Length': String(buffer.length),
      'X-Backup-Timestamp': info.timestamp,
      'X-Backup-Db-Path': dbPath,
      'X-Backup-Instructions': 'POST to /api/backup/restore to restore (owner-only)',
    },
  })
}
