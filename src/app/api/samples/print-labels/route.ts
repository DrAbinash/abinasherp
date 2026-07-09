import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getStaffSession } from '@/lib/session'

// GET /api/samples/print-labels?billId=... — returns printable HTML page with all sample labels for a bill
export async function GET(req: NextRequest) {
  const session = await getStaffSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const billId = searchParams.get('billId')
  if (!billId) return NextResponse.json({ error: 'billId required' }, { status: 400 })

  const samples = await db.sample.findMany({ where: { billId } })
  if (samples.length === 0) {
    return NextResponse.json({ error: 'No samples found for this bill' }, { status: 404 })
  }

  // Generate printable HTML with all labels (A6 size, 4 per A4 page)
  const labels = samples.map((s) => `
<div class="label">
  <div class="patient">${escapeHtml(s.patientName)}</div>
  <div class="test">${escapeHtml(s.testName)} <span class="code">(${s.testCode || ''})</span></div>
  <div class="barcode">
    ${generateBarcodeBars(s.barcodeData)}
  </div>
  <div class="sample-id">${s.sampleId}</div>
  <div class="footer">
    <span>Bill: ${s.billNumber || '—'}</span>
    <span>${new Date(s.createdAt).toLocaleDateString('en-IN')}</span>
  </div>
</div>`).join('')

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Sample Labels — Bill ${samples[0].billNumber}</title>
<style>
  @page { size: A6; margin: 5mm; }
  body { font-family: Arial, sans-serif; margin: 0; padding: 10px; }
  .label { width: 95mm; height: 130mm; border: 2px solid #000; padding: 8px; margin: 0 auto 10mm; page-break-after: always; box-sizing: border-box; }
  .label:last-child { page-break-after: avoid; }
  .patient { font-size: 14px; font-weight: bold; }
  .test { font-size: 11px; margin-top: 4px; }
  .code { color: #666; font-size: 10px; }
  .barcode { margin: 15px 0; text-align: center; }
  .barcode svg { width: 100%; height: 60px; }
  .sample-id { font-family: monospace; font-size: 16px; font-weight: bold; text-align: center; margin: 10px 0; letter-spacing: 1px; }
  .footer { display: flex; justify-content: space-between; font-size: 8px; color: #666; margin-top: 10px; border-top: 1px solid #ccc; padding-top: 4px; }
  @media print { body { padding: 0; } }
</style></head>
<body>
${labels}
<script>window.print()</script>
</body></html>`

  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}

function generateBarcodeBars(data: string): string {
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 50">`
  let x = 5
  for (let i = 0; i < data.length; i++) {
    const code = data.charCodeAt(i)
    for (let j = 0; j < 4; j++) {
      const width = ((code + j) % 3) + 1
      const isBlack = j % 2 === 0
      if (isBlack) {
        svg += `<rect x="${x}" y="0" width="${width}" height="50" fill="black"/>`
      }
      x += width
    }
  }
  svg += `</svg>`
  return svg
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
