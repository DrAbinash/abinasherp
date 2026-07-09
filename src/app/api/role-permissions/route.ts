import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getStaffSession } from '@/lib/session'
import { ERP_ROLES, PERMISSION_MODULES } from '@/lib/auth'

export async function GET() {
  const session = await getStaffSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const perms = await db.rolePermission.findMany()
  return NextResponse.json({
    perms,
    roles: ERP_ROLES,
    modules: PERMISSION_MODULES,
  })
}

export async function PUT(req: NextRequest) {
  const session = await getStaffSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!session.isOwner) {
    return NextResponse.json({ error: 'Only admin/owner can edit role permissions' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const { role, module: mod, ...flags } = body
  if (!role || !mod) return NextResponse.json({ error: 'role and module required' }, { status: 400 })

  const perm = await db.rolePermission.upsert({
    where: { role_module: { role, module: mod } },
    update: flags,
    create: { role, module: mod, ...flags },
  })
  return NextResponse.json({ perm })
}

export async function POST(req: NextRequest) {
  const session = await getStaffSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!session.isOwner) {
    return NextResponse.json({ error: 'Only admin/owner can seed role permissions' }, { status: 403 })
  }

  // Seed defaults
  const defaults: Record<string, Record<string, Partial<{canView: boolean; canCreate: boolean; canEdit: boolean; canDelete: boolean; canPrint: boolean; canReprint: boolean; canRefund: boolean; canExport: boolean; canApprove: boolean; canFinalize: boolean}>>> = {
    super_admin: Object.fromEntries(PERMISSION_MODULES.map((m) => [m, { canView: true, canCreate: true, canEdit: true, canDelete: true, canPrint: true, canReprint: true, canRefund: true, canExport: true, canApprove: true, canFinalize: true }])),
    admin: Object.fromEntries(PERMISSION_MODULES.map((m) => [m, { canView: true, canCreate: true, canEdit: true, canDelete: true, canPrint: true, canReprint: true, canRefund: true, canExport: true, canApprove: true, canFinalize: true }])),
    manager: Object.fromEntries(['dashboard', 'patients', 'billing', 'payments', 'orders', 'doctors', 'referrals', 'accounting', 'expenses', 'staff', 'banking'].map((m) => [m, { canView: true, canCreate: true, canEdit: true, canDelete: true, canPrint: true, canExport: true }])),
    accountant: Object.fromEntries(['dashboard', 'accounting', 'billing', 'payments', 'expenses', 'banking'].map((m) => [m, { canView: true, canCreate: true, canEdit: true, canExport: true }])),
    billing: Object.fromEntries(['dashboard', 'patients', 'billing', 'payments'].map((m) => [m, { canView: true, canCreate: true, canEdit: true, canPrint: true, canReprint: true }])),
    receptionist: Object.fromEntries(['dashboard', 'patients', 'orders'].map((m) => [m, { canView: true, canCreate: true, canEdit: true }])),
    lab: Object.fromEntries(['dashboard', 'orders', 'tests'].map((m) => [m, { canView: true, canCreate: true, canEdit: true }])),
    doctor: Object.fromEntries(['dashboard', 'patients', 'orders'].map((m) => [m, { canView: true }])),
  }

  let count = 0
  for (const [role, modules] of Object.entries(defaults)) {
    for (const [mod, flags] of Object.entries(modules)) {
      await db.rolePermission.upsert({
        where: { role_module: { role, module: mod } },
        update: {},
        create: { role, module: mod, ...flags },
      })
      count++
    }
  }

  return NextResponse.json({ ok: true, seeded: count })
}
