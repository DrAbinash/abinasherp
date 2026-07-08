import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getStaffSession } from '@/lib/session'
import ZAI from 'z-ai-web-dev-sdk'
import fs from 'fs'
import path from 'path'

// POST /api/banking/statements/upload
// Accepts multipart/form-data with `file` (CSV/PDF) and `bankAccountId`
// Parses transactions and returns them for preview (does NOT auto-create)
export async function POST(req: NextRequest) {
  const session = await getStaffSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const bankAccountId = formData.get('bankAccountId') as string

  if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
  if (!bankAccountId) return NextResponse.json({ error: 'bankAccountId required' }, { status: 400 })

  if (file.size > 15 * 1024 * 1024) {
    return NextResponse.json({ error: 'File too large (max 15MB)' }, { status: 400 })
  }

  const bankAccount = await db.bankAccount.findUnique({ where: { id: bankAccountId } })
  if (!bankAccount) return NextResponse.json({ error: 'Bank account not found' }, { status: 404 })

  const bytes = await file.arrayBuffer()
  const fileBuffer = Buffer.from(bytes)

  let transactions: Array<{
    transactionDate: string
    description: string
    amount: number
    type: string // credit | debit
    utr?: string
    referenceNumber?: string
    balanceAfter?: number
  }> = []

  if (file.type === 'text/csv' || file.name.toLowerCase().endsWith('.csv')) {
    // Parse CSV
    const text = fileBuffer.toString('utf-8')
    transactions = parseCsvStatement(text)
  } else if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
    // Extract text from PDF, then use LLM to parse transactions
    let pdfText = ''
    try {
      const pdfParse = (await import('pdf-parse')).default
      const pdfData = await pdfParse(fileBuffer)
      pdfText = pdfData.text
    } catch (e) {
      console.error('PDF parse failed:', e)
      return NextResponse.json({ error: 'Failed to parse PDF' }, { status: 400 })
    }

    if (!pdfText || pdfText.length < 50) {
      return NextResponse.json({ error: 'No text extracted from PDF. The PDF may be scanned/image-based. Try converting to CSV or taking a screenshot.' }, { status: 400 })
    }

    // Use LLM to extract transactions from PDF text
    const zai = await ZAI.create()
    const response = await zai.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: `You are a precise bank statement parser. Extract all transactions from the bank statement text. Return ONLY a JSON array (no markdown, no explanation) of transactions:
[
  {
    "transactionDate": "YYYY-MM-DD",
    "description": "string, the narration/description",
    "amount": number (positive),
    "type": "credit" | "debit",
    "utr": "string or null (UTR/UPI ref if available)",
    "referenceNumber": "string or null (cheque no / ref no)",
    "balanceAfter": number or null (running balance if shown)
  }
]

Rules:
- For debits (withdrawals/payments), type="debit" and amount is positive
- For credits (deposits/receipts), type="credit" and amount is positive
- Parse dates carefully — Indian bank statements often use DD/MM/YYYY or DD-MM-YYYY
- Skip header rows and balance-summary rows
- Include ALL actual transactions`,
        },
        { role: 'user', content: `Extract transactions from this bank statement:\n\n${pdfText.slice(0, 12000)}` },
      ],
    })

    const content = response.choices[0]?.message?.content || '[]'
    try {
      const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      transactions = JSON.parse(cleaned)
    } catch (e) {
      console.error('Failed to parse LLM response:', content)
      return NextResponse.json({ error: 'Failed to parse transactions from PDF', raw: content.slice(0, 500) }, { status: 500 })
    }
  } else {
    return NextResponse.json({ error: 'Unsupported file type. Use CSV or PDF.' }, { status: 400 })
  }

  // Save the file for audit
  const uploadsDir = path.join(process.cwd(), 'uploads', 'bank-statements')
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true })
  const fileName = `stmt-${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`
  fs.writeFileSync(path.join(uploadsDir, fileName), fileBuffer)

  return NextResponse.json({
    bankAccountId,
    bankAccountName: bankAccount.bankName,
    fileName,
    fileType: file.type,
    transactionCount: transactions.length,
    transactions,
    // Include preview stats
    summary: {
      totalCredits: transactions.filter((t) => t.type === 'credit').reduce((s, t) => s + t.amount, 0),
      totalDebits: transactions.filter((t) => t.type === 'debit').reduce((s, t) => s + t.amount, 0),
      netFlow: transactions.reduce((s, t) => s + (t.type === 'credit' ? t.amount : -t.amount), 0),
    },
  })
}

// Also support PUT for confirming import (after user reviews the preview)
export async function PUT(req: NextRequest) {
  const session = await getStaffSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { bankAccountId, transactions, runReconciliation } = body as {
    bankAccountId: string
    transactions: Array<{
      transactionDate: string
      description: string
      amount: number
      type: string
      utr?: string
      referenceNumber?: string
    }>
    runReconciliation?: boolean
  }

  if (!bankAccountId || !Array.isArray(transactions)) {
    return NextResponse.json({ error: 'bankAccountId and transactions required' }, { status: 400 })
  }

  const bankAccount = await db.bankAccount.findUnique({ where: { id: bankAccountId } })
  if (!bankAccount) return NextResponse.json({ error: 'Bank account not found' }, { status: 404 })

  // Insert transactions (skip duplicates by externalTransactionId if present)
  let inserted = 0
  let skipped = 0
  let newBalance = bankAccount.currentBalance

  for (const t of transactions) {
    // Check for duplicate by UTR + amount
    if (t.utr) {
      const existing = await db.bankTransaction.findFirst({
        where: { utr: t.utr, amount: t.amount },
      })
      if (existing) { skipped++; continue }
    }

    const signedAmount = t.type === 'debit' ? -Math.abs(t.amount) : Math.abs(t.amount)
    newBalance += signedAmount

    await db.bankTransaction.create({
      data: {
        bankAccountId,
        transactionDate: new Date(t.transactionDate),
        description: t.description,
        amount: Math.abs(t.amount),
        type: t.type,
        balanceAfter: newBalance,
        utr: t.utr || null,
        referenceNumber: t.referenceNumber || null,
        reconciliationStatus: 'unreconciled',
      },
    })
    inserted++
  }

  // Update bank account balance
  await db.bankAccount.update({
    where: { id: bankAccountId },
    data: { currentBalance: newBalance },
  })

  await db.bankAuditLog.create({
    data: {
      action: 'statement_imported',
      provider: bankAccount.provider,
      bankAccountId,
      status: 'success',
      details: JSON.stringify({ inserted, skipped, total: transactions.length, runReconciliation }),
      performedBy: session.name,
    },
  })

  // Optionally run auto-reconciliation
  let reconciliationResult: { matched: number; unmatched: number } | null = null
  if (runReconciliation) {
    const unreconciled = await db.bankTransaction.findMany({
      where: { bankAccountId, reconciliationStatus: 'unreconciled', type: 'credit' },
    })

    let matched = 0
    let unmatched = 0
    for (const tx of unreconciled) {
      let didMatch = false
      // Try exact UTR match
      if (tx.utr) {
        const payment = await db.payment.findFirst({
          where: { referenceNumber: tx.utr, amount: tx.amount },
        })
        if (payment) {
          await db.reconciliationLog.create({
            data: {
              bankTransactionId: tx.id,
              billId: payment.billId,
              paymentId: payment.id,
              confidenceScore: 100,
              matchStrategy: 'exact_utr',
              status: 'auto_matched',
              autoClosed: true,
              autoClosedAmount: tx.amount,
              resolvedById: session.id,
              resolvedByName: session.name,
              resolvedAt: new Date(),
            },
          })
          await db.bankTransaction.update({
            where: { id: tx.id },
            data: { reconciliationStatus: 'matched', billId: payment.billId, paymentId: payment.id },
          })
          matched++; didMatch = true; continue
        }
      }
      // Try bill-number-in-description
      if (tx.description) {
        const m = tx.description.match(/(?:BILL|INV|ORD)[\s-]*([A-Z0-9-]+)/i)
        if (m) {
          const bill = await db.bill.findFirst({ where: { billNumber: { contains: m[1] } } })
          if (bill) {
            await db.reconciliationLog.create({
              data: {
                bankTransactionId: tx.id,
                billId: bill.id,
                confidenceScore: 90,
                matchStrategy: 'exact_invoice_ref',
                status: 'auto_matched',
                autoClosed: true,
                autoClosedAmount: tx.amount,
                resolvedById: session.id,
                resolvedByName: session.name,
                resolvedAt: new Date(),
              },
            })
            await db.bankTransaction.update({
              where: { id: tx.id },
              data: { reconciliationStatus: 'matched', billId: bill.id },
            })
            matched++; didMatch = true; continue
          }
        }
      }
      if (!didMatch) unmatched++
    }
    reconciliationResult = { matched, unmatched }
  }

  return NextResponse.json({
    inserted,
    skipped,
    newBalance,
    reconciliation: reconciliationResult,
  })
}

// Parse CSV bank statement (handles common Indian bank formats)
function parseCsvStatement(text: string): Array<{
  transactionDate: string
  description: string
  amount: number
  type: string
  utr?: string
  referenceNumber?: string
  balanceAfter?: number
}> {
  const lines = text.split(/\r?\n/).filter((l) => l.trim())
  if (lines.length === 0) return []

  // Detect delimiter (comma or tab or semicolon)
  const firstLine = lines[0]
  const delimiter = firstLine.includes('\t') ? '\t' : firstLine.includes(';') ? ';' : ','

  // Detect header
  const headerLine = firstLine.toLowerCase()
  const hasHeader = /date|narration|description|amount|debit|credit|balance|utr|ref/i.test(headerLine)

  const dataLines = hasHeader ? lines.slice(1) : lines
  const transactions: Array<any> = []

  for (const line of dataLines) {
    const cols = parseCsvLine(line, delimiter)
    if (cols.length < 3) continue

    // Try to identify columns
    let dateStr = ''
    let description = ''
    let amount = 0
    let type = 'credit'
    let utr: string | undefined
    let referenceNumber: string | undefined
    let balanceAfter: number | undefined

    // Heuristic: find date column (matches DD/MM/YYYY or YYYY-MM-DD)
    for (const col of cols) {
      const trimmed = col.trim()
      // DD/MM/YYYY or DD-MM-YYYY
      const ddmmyyyy = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/)
      const yyyymmdd = trimmed.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/)
      if ((ddmmyyyy || yyyymmdd) && !dateStr) {
        if (ddmmyyyy) {
          const [, dd, mm, yyyy] = ddmmyyyy
          const year = yyyy.length === 2 ? `20${yyyy}` : yyyy
          dateStr = `${year}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`
        } else if (yyyymmdd) {
          const [, yyyy, mm, dd] = yyyymmdd
          dateStr = `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`
        }
      }
    }

    if (!dateStr) continue // Skip rows without a date

    // Find amount — try to find numeric columns
    const numericCols = cols.map((c, i) => ({ val: c.trim(), idx: i })).filter((c) => {
      const v = c.val.replace(/,/g, '').replace(/₹/g, '').trim()
      return v && !isNaN(parseFloat(v)) && parseFloat(v) !== 0
    })

    // Find description (longest non-numeric, non-date column)
    const descCandidate = cols
      .map((c) => c.trim())
      .filter((c) => c && !c.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/) && !c.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/) && isNaN(parseFloat(c.replace(/,/g, '').replace(/₹/g, '').trim())))
      .sort((a, b) => b.length - a.length)[0]
    description = descCandidate || ''

    // Try to find separate debit/credit columns
    if (hasHeader) {
      const headers = parseCsvLine(lines[0], delimiter).map((h) => h.toLowerCase().trim())
      const debitIdx = headers.findIndex((h) => h.includes('debit') || h.includes('withdrawal') || h.includes('dr'))
      const creditIdx = headers.findIndex((h) => h.includes('credit') || h.includes('deposit') || h.includes('cr'))
      const balIdx = headers.findIndex((h) => h.includes('balance') || h.includes('closing'))
      const utrIdx = headers.findIndex((h) => h.includes('utr') || h.includes('ref') || h.includes('chq'))

      if (debitIdx >= 0 && creditIdx >= 0) {
        const dr = parseFloat(cols[debitIdx]?.replace(/,/g, '').replace(/₹/g, '').trim() || '0') || 0
        const cr = parseFloat(cols[creditIdx]?.replace(/,/g, '').replace(/₹/g, '').trim() || '0') || 0
        if (dr > 0) { amount = dr; type = 'debit' }
        else if (cr > 0) { amount = cr; type = 'credit' }
        else continue
      } else if (numericCols.length > 0) {
        amount = parseFloat(numericCols[0].val.replace(/,/g, '').replace(/₹/g, '').trim())
        type = amount < 0 ? 'debit' : 'credit'
        amount = Math.abs(amount)
      }

      if (balIdx >= 0) {
        const bal = parseFloat(cols[balIdx]?.replace(/,/g, '').replace(/₹/g, '').trim() || '')
        if (!isNaN(bal)) balanceAfter = bal
      }
      if (utrIdx >= 0) {
        const ref = cols[utrIdx]?.trim()
        if (ref && ref.match(/\d{6,}/)) {
          if (headers[utrIdx].includes('utr')) utr = ref
          else referenceNumber = ref
        }
      }
    } else {
      if (numericCols.length > 0) {
        amount = parseFloat(numericCols[0].val.replace(/,/g, '').replace(/₹/g, '').trim())
        type = amount < 0 ? 'debit' : 'credit'
        amount = Math.abs(amount)
      }
    }

    if (amount > 0) {
      transactions.push({
        transactionDate: dateStr,
        description,
        amount,
        type,
        utr,
        referenceNumber,
        balanceAfter,
      })
    }
  }

  return transactions
}

// Parse a single CSV line handling quoted values
function parseCsvLine(line: string, delimiter: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++ }
      else inQuotes = !inQuotes
    } else if (c === delimiter && !inQuotes) {
      result.push(current)
      current = ''
    } else {
      current += c
    }
  }
  result.push(current)
  return result
}
