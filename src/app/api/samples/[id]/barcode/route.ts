import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getStaffSession } from '@/lib/session'

// GET /api/samples/:id/barcode — returns barcode as SVG (Code 128 style)
// Renders a simple barcode visual + sample ID + patient info for label printing
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getStaffSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const sample = await db.sample.findUnique({ where: { id } })
  if (!sample) return NextResponse.json({ error: 'Sample not found' }, { status: 404 })

  // Generate a simple SVG barcode (visual bars representing the sample ID)
  // This is a visual representation — for actual scanning, use a barcode library
  const barcodeData = sample.barcodeData
  const bars = generateBarcodeBars(barcodeData)

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="120" viewBox="0 0 300 120">
  <rect width="300" height="120" fill="white"/>
  <!-- Patient name -->
  <text x="10" y="15" font-family="Arial" font-size="11" font-weight="bold">${escapeXml(sample.patientName)}</text>
  <!-- Test name -->
  <text x="10" y="28" font-family="Arial" font-size="9">${escapeXml(sample.testName)}</text>
  <!-- Barcode bars -->
  ${bars}
  <!-- Sample ID text -->
  <text x="150" y="100" font-family="monospace" font-size="12" font-weight="bold" text-anchor="middle">${barcodeData}</text>
  <!-- Bill number -->
  <text x="10" y="115" font-family="Arial" font-size="7" fill="#666">Bill: ${sample.billNumber || '—'}</text>
  <text x="290" y="115" font-family="Arial" font-size="7" fill="#666" text-anchor="end">${new Date(sample.createdAt).toLocaleDateString('en-IN')}</text>
</svg>`

  return new NextResponse(svg, {
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'no-cache',
    },
  })
}

// Generate barcode bars (simplified Code 128 visual)
function generateBarcodeBars(data: string): string {
  let bars = ''
  let x = 10
  // Use character codes to generate bar widths
  for (let i = 0; i < data.length; i++) {
    const code = data.charCodeAt(i)
    // Each character generates 4 bars (2 black, 2 white)
    for (let j = 0; j < 4; j++) {
      const width = ((code + j) % 3) + 1 // 1-3 units
      const isBlack = j % 2 === 0
      if (isBlack) {
        bars += `<rect x="${x}" y="35" width="${width}" height="50" fill="black"/>`
      }
      x += width
    }
  }
  return bars
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
