import { NextRequest, NextResponse } from 'next/server'
import ZAI from 'z-ai-web-dev-sdk'

const SYSTEM_PROMPT = `You are a helpful assistant for Care Diagnostic Centre. Answer questions about: test prices, timings, appointments, report status, fasting requirements, home collection. Be concise. If asked about specific patient data, say 'Please call the centre.'`

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const { phone, message } = body

  if (!phone || !message) {
    return NextResponse.json({ error: 'phone and message required' }, { status: 400 })
  }

  try {
    const zai = await ZAI.create()
    const response = await zai.chat.completions.create({
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: message },
      ],
    })

    const reply = response.choices?.[0]?.message?.content || 'Sorry, I could not process that. Please call the centre.'

    return NextResponse.json({ response: reply, phone })
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json(
      { error: 'Failed to generate response', details: errMsg },
      { status: 500 },
    )
  }
}
