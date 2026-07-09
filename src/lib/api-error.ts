import { NextResponse } from 'next/server'

export function handleApiError(e: unknown) {
  console.error('[api]', e)
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
}

export function errorStatus(e: any): number {
  return e?.status || e?.statusCode || 500
}
