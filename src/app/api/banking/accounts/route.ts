import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getStaffSession } from '@/lib/session'

export async function GET() {
  const session = await getStaffSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const accounts = await db.bankAccount.findMany({
    include: { _count: { select: { transactions: true, paymentRequests: true } } },
    orderBy: { bankName: 'asc' },
  })
  return NextResponse.json({ accounts })
}

export async function POST(req: NextRequest) {
  const session = await getStaffSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { provider, bankName, maskedAccountNumber, ifsc, branch, environment, currentBalance } = body
  if (!bankName) return NextResponse.json({ error: 'bankName required' }, { status: 400 })

  const account = await db.bankAccount.create({
    data: {
      provider: provider || 'generic',
      bankName,
      maskedAccountNumber,
      ifsc,
      branch,
      environment: environment || 'production',
      currentBalance: parseFloat(currentBalance || '0'),
      status: 'active',
    },
  })

  await db.bankAuditLog.create({
    data: {
      action: 'account_created',
      provider: account.provider,
      bankAccountId: account.id,
      status: 'success',
      performedBy: session.name,
    },
  })

  return NextResponse.json({ account })
}
