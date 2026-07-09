import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getStaffSession } from '@/lib/session'
import { istDateLabel, generateExpenseId } from '@/lib/auth'
import { autoVoucherForExpense } from '@/lib/seed'
import { generateVoucherNumber } from '@/lib/auth'
import ZAI from 'z-ai-web-dev-sdk'
import fs from 'fs'
import path from 'path'

// POST /api/expenses/scan-bill
// Accepts multipart/form-data with `file` field (image or PDF)
// Uses VLM to extract: supplier name, GSTIN, bill #, date, line items, totals
// Returns the extracted data for user review (does NOT auto-post)
export async function POST(req: NextRequest) {
  const session = await getStaffSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })

  if (file.size > 8 * 1024 * 1024) {
    return NextResponse.json({ error: 'File too large (max 8MB)' }, { status: 400 })
  }

  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf']
  if (!allowedTypes.includes(file.type)) {
    return NextResponse.json({ error: `Unsupported file type: ${file.type}. Allowed: JPEG, PNG, WebP, PDF` }, { status: 400 })
  }

  // For PDFs, we need to convert to image first. For now, only support images via VLM.
  // PDF text extraction is handled separately in the bank-statement upload route.
  let imageUrl: string
  let fileBuffer: Buffer
  if (file.type === 'application/pdf') {
    // Use pdf-parse to extract text, then send the text to LLM (not vision)
    const bytes = await file.arrayBuffer()
    fileBuffer = Buffer.from(bytes)
    // Save the PDF for audit
    const uploadsDir = path.join(process.cwd(), 'uploads', 'expense-bills')
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true })
    const fileName = `bill-${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`
    const filePath = path.join(uploadsDir, fileName)
    fs.writeFileSync(filePath, fileBuffer)

    // Extract text from PDF
    let pdfText = ''
    try {
      const pdfParse = (await import('pdf-parse')).default
      const pdfData = await pdfParse(fileBuffer)
      pdfText = pdfData.text
    } catch (e) {
      console.error('PDF parse failed:', e)
      return NextResponse.json({ error: 'Failed to parse PDF. Try uploading an image instead.' }, { status: 400 })
    }

    // Use LLM (not vision) for PDF text
    const zai = await ZAI.create()
    const response = await zai.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: `You are a precise expense bill / invoice extractor. Extract the following fields from the bill text and return as JSON only (no markdown, no explanation).
Fields to extract:
- supplierName (string, the vendor/company name)
- supplierGSTIN (string or null, the GSTIN of the supplier)
- supplierPAN (string or null)
- billNumber (string or null, the invoice/bill number)
- billDate (string YYYY-MM-DD or null)
- dueDate (string YYYY-MM-DD or null)
- category (one of: rent, salaries, utilities, supplies, maintenance, equipment, marketing, travel, miscellaneous — best guess)
- description (string, brief description of what was purchased)
- lineItems (array of {name: string, qty: number, rate: number, amount: number})
- subtotal (number, total before tax)
- taxAmount (number, total tax/GST)
- totalAmount (number, grand total)
- paymentMode (one of: cash, bank-transfer, cheque, upi, card — best guess or null)

Return ONLY valid JSON, no markdown fences.`,
        },
        { role: 'user', content: `Extract from this bill text:\n\n${pdfText.slice(0, 8000)}` },
      ],
    })

    const content = response.choices[0]?.message?.content || '{}'
    let extracted: any = {}
    try {
      // Strip markdown fences if present
      const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      extracted = JSON.parse(cleaned)
    } catch (e) {
      console.error('Failed to parse LLM response:', content)
      return NextResponse.json({ error: 'Failed to extract data from PDF', raw: content }, { status: 500 })
    }

    return NextResponse.json({
      extracted,
      ocrConfidence: 0.8,
      filePath: fileName,
      fileType: file.type,
      fileName: file.name,
      source: 'pdf-text',
    })
  }

  // Image — use VLM
  const bytes = await file.arrayBuffer()
  fileBuffer = Buffer.from(bytes)
  const base64 = fileBuffer.toString('base64')
  imageUrl = `data:${file.type};base64,${base64}`

  // Save the file for audit
  const uploadsDir = path.join(process.cwd(), 'uploads', 'expense-bills')
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true })
  const fileName = `bill-${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`
  const filePath = path.join(uploadsDir, fileName)
  fs.writeFileSync(filePath, fileBuffer)

  const zai = await ZAI.create()
  const response = await zai.chat.completions.createVision({
    messages: [
      {
        role: 'system',
        content: `You are a precise expense bill / invoice extractor. Analyze the uploaded bill image and extract these fields as JSON only (no markdown, no explanation):
{
  "supplierName": "string",
  "supplierGSTIN": "string or null",
  "supplierPAN": "string or null",
  "billNumber": "string or null",
  "billDate": "YYYY-MM-DD or null",
  "dueDate": "YYYY-MM-DD or null",
  "category": "rent|salaries|utilities|supplies|maintenance|equipment|marketing|travel|miscellaneous",
  "description": "string, brief description",
  "lineItems": [{"name": "string", "qty": number, "rate": number, "amount": number}],
  "subtotal": number,
  "taxAmount": number,
  "totalAmount": number,
  "paymentMode": "cash|bank-transfer|cheque|upi|card|null"
}

Return ONLY valid JSON.`,
      },
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Extract all fields from this expense bill image.' },
          { type: 'image_url', image_url: { url: imageUrl } },
        ],
      },
    ],
    thinking: { type: 'disabled' },
  })

  const content = response.choices[0]?.message?.content || '{}'
  let extracted: any = {}
  try {
    const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    extracted = JSON.parse(cleaned)
  } catch (e) {
    console.error('Failed to parse VLM response:', content)
    return NextResponse.json({ error: 'Failed to extract data from image', raw: content }, { status: 500 })
  }

  return NextResponse.json({
    extracted,
    ocrConfidence: 0.85,
    filePath: fileName,
    fileType: file.type,
    fileName: file.name,
    source: 'image-vlm',
  })
}
