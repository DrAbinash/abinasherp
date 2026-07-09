import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getStaffSession } from '@/lib/session'

// GET /api/samples/by-barcode/:sampleId — scan barcode to get sample info
// Used by phlebotomist/lab staff mobile scanning
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ sampleId: string }> },
) {
  const session = await getStaffSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { sampleId } = await params
  const sample = await db.sample.findFirst({
    where: {
      OR: [
        { sampleId },
        { barcodeData: sampleId },
      ],
    },
  })
  if (!sample) return NextResponse.json({ error: 'Sample not found' }, { status: 404 })
  return NextResponse.json({ sample })
}
