import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getStaffSession } from '@/lib/session'
import fs from 'fs'
import path from 'path'

function getDbPath(): string {
  return (process.env.DATABASE_URL || '').replace(/^file:/, '')
}

const SQLITE_HEADER = Buffer.from('SQLite format 3\0')

export async function POST(req: NextRequest) {
  const session = await getStaffSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!session.isOwner) {
    return NextResponse.json({ error: 'Forbidden: owner role required' }, { status: 403 })
  }

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file uploaded (field name: file)' }, { status: 400 })

  if (file.size > 200 * 1024 * 1024) {
    return NextResponse.json({ error: 'File too large (max 200MB)' }, { status: 400 })
  }

  const bytes = await file.arrayBuffer()
  const buf = Buffer.from(bytes)

  if (buf.length < 16 || buf.subarray(0, 16).toString('binary') !== SQLITE_HEADER.toString('binary')) {
    return NextResponse.json({ error: 'Invalid SQLite file: missing SQLite header' }, { status: 400 })
  }

  const dbPath = getDbPath()
  if (!dbPath || !fs.existsSync(dbPath)) {
    return NextResponse.json({ error: 'Current database file not found' }, { status: 500 })
  }

  const backupPath = `${dbPath}.bak-${Date.now()}`
  fs.copyFileSync(dbPath, backupPath)

  try {
    await db.$disconnect()
  } catch {
    // ignore disconnect errors
  }

  fs.writeFileSync(dbPath, buf)

  return NextResponse.json({
    ok: true,
    message: 'Database restored successfully. Please restart the application to apply changes.',
    restoredFrom: file.name,
    sizeBytes: buf.length,
    backupPath,
    warning: 'A backup of the previous database was saved. The application should be restarted.',
  })
}
