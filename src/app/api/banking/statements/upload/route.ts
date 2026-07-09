import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getStaffSession } from '@/lib/session'

// ============================================================
// POST /api/banking/statements/upload  (multipart: file, bankAccountId)
//   Parses a bank statement CSV and returns a preview of transactions.
// PUT  /api/banking/statements/upload   (json: bankAccountId, transactions, runReconciliation)
//   Persists the reviewed transactions (dedup on UTR/ref) and optionally
//   runs a lightweight amount+date reconciliation against recorded payments.
// ============================================================

interface ParsedTxn {
  transactionDate: string // ISO
  description: string
  amount: number
  type: 'credit' | 'debit'
  balanceAfter: number | null
  utr: string
  referenceNumber: string
}

function splitCsvLine(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { cur += '"'; i++ } else inQuotes = !inQuotes
    } else if (ch === ',' && !inQuotes) {
      out.push(cur); cur = ''
    } else {
      cur += ch
    }
  }
  out.push(cur)
  return out.map((s) => s.trim())
}

function findCol(headers: string[], keywords: string[]): number {
  for (let i = 0; i < headers.length; i++) {
    const h = headers[i].toLowerCase()
    if (keywords.some((k) => h.includes(k))) return i
  }
  return -1
}

function parseNumber(s: string): number {
  if (!s) return 0
  const n = parseFloat(s.replace(/[^0-9.-]/g, ''))
  return isNaN(n) ? 0 : n
}

function parseDate(s: string): string | null {
  if (!s) return null
  const t = s.trim()
  // Try DD/MM/YYYY or DD-MM-YYYY
  const m = t.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/)
  if (m) {
    let [, d, mo, y] = m
    if (y.length === 2) y = '20' + y
    const iso = `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`
    const dt = new Date(iso + 'T00:00:00+05:30')
    if (!isNaN(dt.getTime())) return dt.toISOString()
  }
  const dt = new Date(t)
  return isNaN(dt.getTime()) ? null : dt.toISOString()
}

function parseCsv(text: string): ParsedTxn[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0)
  if (lines.length < 2) return []

  // Locate the header row (first line containing a date-like keyword).
  let headerIdx = 0
  for (let i = 0; i < Math.min(lines.length, 25); i++) {
    const low = lines[i].toLowerCase()
    if (low.includes('date') && (low.includes('amount') || low.includes('debit') || low.includes('credit') || low.includes('narration') || low.includes('description') || low.includes('particular'))) {
      headerIdx = i
      break
    }
  }

  const headers = splitCsvLine(lines[headerIdx])
  const dateCol = findCol(headers, ['date', 'txn date', 'value date'])
  const descCol = findCol(headers, ['narration', 'description', 'particular', 'remarks', 'details'])
  const debitCol = findCol(headers, ['debit', 'withdrawal', 'dr'])
  const creditCol = findCol(headers, ['credit', 'deposit', 'cr'])
  const amountCol = findCol(headers, ['amount'])
  const balanceCol = findCol(headers, ['balance'])
  const refCol = findCol(headers, ['ref', 'utr', 'cheque', 'chq', 'transaction id'])

  const txns: ParsedTxn[] = []
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i])
    if (cols.length < 2) continue
    const dateIso = parseDate(dateCol >= 0 ? cols[dateCol] : cols[0])
    if (!dateIso) continue

    let amount = 0
    let type: 'credit' | 'debit' = 'credit'
    if (debitCol >= 0 || creditCol >= 0) {
      const debit = debitCol >= 0 ? parseNumber(cols[debitCol]) : 0
      const credit = creditCol >= 0 ? parseNumber(cols[creditCol]) : 0
      if (credit > 0) { amount = credit; type = 'credit' }
      else if (debit > 0) { amount = debit; type = 'debit' }
      else continue
    } else if (amountCol >= 0) {
      const raw = parseNumber(cols[amountCol])
      amount = Math.abs(raw)
      type = raw < 0 ? 'debit' : 'credit'
    } else {
      continue
    }
    if (amount <= 0) continue

    const ref = refCol >= 0 ? (cols[refCol] || '') : ''
    txns.push({
      transactionDate: dateIso,
      description: descCol >= 0 ? (cols[descCol] || '') : '',
      amount,
      type,
      balanceAfter: balanceCol >= 0 ? parseNumber(cols[balanceCol]) : null,
      utr: ref,
      referenceNumber: ref,
    })
  }
  return txns
}

export async function POST(req: NextRequest) {
  const session = await getStaffSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!session.isOwner) return NextResponse.json({ error: 'Forbidden: owner role required' }, { status: 403 })

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const bankAccountId = String(formData.get('bankAccountId') || '')
  if (!file) return NextResponse.json({ error: 'No file uploaded (field name: file)' }, { status: 400 })
  if (!bankAccountId) return NextResponse.json({ error: 'bankAccountId is required' }, { status: 400 })
  if (file.size > 10 * 1024 * 1024) return NextResponse.json({ error: 'File too large (max 10MB)' }, { status: 400 })

  const name = file.name.toLowerCase()
  if (!name.endsWith('.csv') && !name.endsWith('.txt')) {
    return NextResponse.json({ error: 'Only CSV statements are supported. Export your statement as CSV.' }, { status: 400 })
  }

  const text = await file.text()
  const transactions = parseCsv(text)
  if (transactions.length === 0) {
    return NextResponse.json({ error: 'No transactions could be parsed. Check the CSV format (needs a date column and amount/debit/credit columns).' }, { status: 400 })
  }

  return NextResponse.json({ transactionCount: transactions.length, transactions })
}

export async function PUT(req: NextRequest) {
  const session = await getStaffSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!session.isOwner) return NextResponse.json({ error: 'Forbidden: owner role required' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const bankAccountId = String(body.bankAccountId || '')
  const transactions: ParsedTxn[] = Array.isArray(body.transactions) ? body.transactions : []
  const runReconciliation = !!body.runReconciliation
  if (!bankAccountId) return NextResponse.json({ error: 'bankAccountId is required' }, { status: 400 })
  if (transactions.length === 0) return NextResponse.json({ error: 'No transactions to import' }, { status: 400 })

  const account = await db.bankAccount.findUnique({ where: { id: bankAccountId } })
  if (!account) return NextResponse.json({ error: 'Bank account not found' }, { status: 404 })

  let inserted = 0
  let skipped = 0
  const insertedIds: string[] = []

  for (const t of transactions) {
    const utr = (t.utr || '').trim()
    // Dedup: same account + same UTR/ref already present.
    if (utr) {
      const existing = await db.bankTransaction.findFirst({
        where: { bankAccountId, OR: [{ utr }, { externalTransactionId: utr }] },
        select: { id: true },
      })
      if (existing) { skipped++; continue }
    }
    const row = await db.bankTransaction.create({
      data: {
        bankAccountId,
        transactionDate: new Date(t.transactionDate),
        description: t.description || null,
        amount: t.amount,
        type: t.type === 'debit' ? 'debit' : 'credit',
        balanceAfter: t.balanceAfter ?? null,
        utr: utr || null,
        referenceNumber: t.referenceNumber || null,
        externalTransactionId: utr || null,
      },
    })
    inserted++
    insertedIds.push(row.id)
  }

  let reconciliation: { matched: number; unmatched: number } | undefined
  if (runReconciliation && insertedIds.length > 0) {
    let matched = 0
    const credits = await db.bankTransaction.findMany({
      where: { id: { in: insertedIds }, type: 'credit', reconciliationStatus: 'unreconciled' },
    })
    for (const c of credits) {
      const windowStart = new Date(c.transactionDate.getTime() - 3 * 24 * 3600 * 1000)
      const windowEnd = new Date(c.transactionDate.getTime() + 3 * 24 * 3600 * 1000)
      const payment = await db.payment.findFirst({
        where: {
          amount: { gte: c.amount - 0.5, lte: c.amount + 0.5 },
          createdAt: { gte: windowStart, lte: windowEnd },
        },
      })
      if (payment) {
        await db.bankTransaction.update({
          where: { id: c.id },
          data: { reconciliationStatus: 'matched', paymentId: payment.id },
        })
        matched++
      }
    }
    reconciliation = { matched, unmatched: credits.length - matched }
  }

  return NextResponse.json({ inserted, skipped, reconciliation })
}
