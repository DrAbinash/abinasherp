import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getStaffSession } from '@/lib/session'
import ZAI from 'z-ai-web-dev-sdk'

// POST /api/form-f/scan
// Accepts multipart/form-data with `file` (image of scanned Form F)
// Uses VLM to extract patient and bill data from the Form F
export async function POST(req: NextRequest) {
  const session = await getStaffSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })

  if (file.size > 8 * 1024 * 1024) {
    return NextResponse.json({ error: 'File too large (max 8MB)' }, { status: 400 })
  }

  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
  if (!allowedTypes.includes(file.type)) {
    return NextResponse.json({ error: 'Only JPEG/PNG/WebP images supported for Form F scan' }, { status: 400 })
  }

  const bytes = await file.arrayBuffer()
  const base64 = Buffer.from(bytes).toString('base64')
  const imageUrl = `data:${file.type};base64,${base64}`

  const zai = await ZAI.create()
  const response = await (zai.chat.completions.createVision as any)({
    messages: [
      {
        role: 'system',
        content: `You are a precise Form F (PCPNDT compliance form) extractor used in Indian diagnostic centres. Analyze the scanned Form F image and extract ALL visible fields as JSON only (no markdown, no explanation):
{
  "patientName": "string or null",
  "age": "number or null",
  "husbandFatherName": "string or null",
  "address": "string or null",
  "mobile": "string or null",
  "childrenDetails": "string (e.g. '1M 0F') or null",
  "referredBy": "string (doctor name) or 'Self'",
  "lmpWeeks": "string or null",
  "geneticHistory": "string or null",
  "basisDiagnosis": "string or null",
  "previousChildIssue": "string or null",
  "indicationOther": "string or null",
  "doctorName": "string or null",
  "procedure": "string or null (e.g. USG, Amniocentesis)",
  "procedurePurpose": "string or null",
  "invasiveProcedure": "string or null",
  "complication": "string or null",
  "labTests": "string or null",
  "prenatalResult": "string or null",
  "gestationalAgeWeeks": "number or null",
  "gestationalAgeDays": "number or null",
  "ultrasoundResult": "string or null",
  "abnormality": "string or null",
  "procedureDate": "YYYY-MM-DD or null",
  "consentDate": "YYYY-MM-DD or null",
  "resultConveyed": "string or null",
  "mtpAdvised": "Yes/No/null",
  "mtpDate": "YYYY-MM-DD or null",
  "date": "YYYY-MM-DD or null",
  "place": "string or null"
}

If a field is not visible or unclear, use null. Return ONLY valid JSON.`,
      },
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Extract all fields from this Form F scan.' },
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
    return NextResponse.json({ error: 'Failed to extract data', raw: content.slice(0, 500) }, { status: 500 })
  }

  return NextResponse.json({
    extracted,
    ocrConfidence: 0.85,
    fileName: file.name,
    source: 'image-vlm',
  })
}
