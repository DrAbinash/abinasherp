import bcrypt from 'bcryptjs'
import crypto from 'crypto'

// Role normalization — mirrors reference repo logic
export function normalizeRole(role: string | undefined | null): string {
  if (!role) return ''
  const r = role.toLowerCase().trim()
  if (['superadmin', 'super', 'owner', 'super_admin'].includes(r)) return 'super_admin'
  if (r === 'admin') return 'admin'
  return r.replace(/[^a-z0-9]/g, '_')
}

export const FULL_ACCESS_ROLES = new Set(['admin', 'super_admin'])

export const ERP_ROLES = [
  'super_admin',
  'admin',
  'manager',
  'receptionist',
  'billing',
  'accountant',
  'lab',
  'doctor',
] as const

export const PERMISSION_MODULES = [
  'dashboard',
  'patients',
  'billing',
  'payments',
  'orders',
  'tests',
  'doctors',
  'commission',
  'accounting',
  'expenses',
  'banking',
  'referrals',
  'staff',
  'settings',
] as const

// Default permission paths per role — mirrors reference repo
export const DEFAULT_ROLE_PERMISSIONS: Record<string, string[]> = {
  super_admin: ['*'], // wildcard — bypasses all checks
  admin: ['*'],
  manager: [
    '/', '/patients', '/orders', '/billing', '/payments', '/doctors',
    '/reports', '/referrals', '/accounting', '/discounts', '/staff', '/banking',
  ],
  accountant: ['/', '/accounting', '/reports', '/billing', '/payments', '/banking', '/expenses'],
  billing: ['/', '/patients', '/billing', '/payments', '/discounts'],
  lab: ['/', '/orders', '/tests'],
  receptionist: ['/', '/patients', '/orders'],
  doctor: ['/', '/patients', '/orders', '/reports'],
}

export function canAccess(role: string, permissions: string[], path: string): boolean {
  const normalized = normalizeRole(role)
  if (FULL_ACCESS_ROLES.has(normalized)) return true
  if (permissions.includes('*')) return true
  // exact match
  if (permissions.includes(path)) return true
  // prefix match for sub-permissions e.g. /billing:edit
  if (permissions.some((p) => p.startsWith(path + ':'))) return true
  // parent module access covers sub paths
  if (permissions.some((p) => path.startsWith(p + '/'))) return true
  return false
}

export function hasSubPermission(
  role: string,
  permissions: string[],
  modulePath: string,
  action: string,
): boolean {
  const normalized = normalizeRole(role)
  if (FULL_ACCESS_ROLES.has(normalized)) return true
  if (permissions.includes('*')) return true
  if (permissions.includes(modulePath)) return true
  if (permissions.includes(`${modulePath}:${action}`)) return true
  return false
}

export async function hashPin(pin: string): Promise<string> {
  return bcrypt.hash(pin, 12)
}

export async function verifyPin(pin: string, hash: string): Promise<boolean> {
  // Auto-upgrade legacy plaintext
  if (!hash.startsWith('$2')) {
    return pin === hash
  }
  return bcrypt.compare(pin, hash)
}

export function generateToken(bytes = 48): string {
  return crypto.randomBytes(bytes).toString('hex')
}

export function generateBillNumber(seq: number): string {
  const now = new Date()
  const yyyy = now.getFullYear()
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  return `${yyyy}${mm}${String(seq).padStart(4, '0')}`
}

export function generateVoucherNumber(type: string, seq: number): string {
  const now = new Date()
  const yyyy = now.getFullYear()
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const prefix =
    type === 'payment' ? 'PV'
    : type === 'receipt' ? 'RV'
    : type === 'journal' ? 'JV'
    : type === 'bank_transfer' || type === 'contra' ? 'BT'
    : type === 'sales' ? 'SV'
    : type === 'purchase' ? 'PUR'
    : 'JV'
  return `${prefix}-${yyyy}${mm}-${String(seq).padStart(4, '0')}`
}

export function generateExpenseId(yyMm: string, seq: number): string {
  return `EXP-${yyMm}-${String(seq).padStart(4, '0')}`
}

export function generateStaffId(seq: number): string {
  return `EMP-${String(seq).padStart(4, '0')}`
}

export function generateOrderNumber(seq: number): string {
  const now = new Date()
  const yyyy = now.getFullYear()
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  return `ORD-${yyyy}${mm}${dd}-${String(seq).padStart(4, '0')}`
}

export function generatePatientId(seq: number): string {
  return `P-${String(seq).padStart(5, '0')}`
}

// Payment method classifier — mirrors reference repo
const CANONICAL_METHODS = new Set([
  'cash', 'upi', 'card', 'cheque', 'insurance',
])

export function classifyPaymentMethod(raw: string): { method: string; isSuspense: boolean } {
  if (!raw) return { method: 'cash', isSuspense: false }
  const r = raw.toLowerCase().trim()
  if (CANONICAL_METHODS.has(r)) return { method: r, isSuspense: false }
  if (['bank', 'neft', 'rtgs', 'online'].includes(r)) return { method: r, isSuspense: false }
  if (r.startsWith('online (') || r.startsWith('web booking (')) return { method: 'online', isSuspense: false }
  // Unknown → suspense bucket
  return { method: 'unknown', isSuspense: true }
}

// Method → accounting account name (auto-created if missing)
export const METHOD_TO_ACCOUNT: Record<string, { name: string; type: string; tallyGroup: string }> = {
  cash: { name: 'Cash in Hand', type: 'cash', tallyGroup: 'Cash-in-Hand' },
  upi: { name: 'UPI Collections', type: 'bank', tallyGroup: 'Bank Accounts' },
  card: { name: 'Card Collections', type: 'bank', tallyGroup: 'Bank Accounts' },
  online: { name: 'Online Collections', type: 'bank', tallyGroup: 'Bank Accounts' },
  cheque: { name: 'Cheque Collections', type: 'bank', tallyGroup: 'Bank Accounts' },
  bank: { name: 'Bank Account', type: 'bank', tallyGroup: 'Bank Accounts' },
  neft: { name: 'NEFT/RTGS Collections', type: 'bank', tallyGroup: 'Bank Accounts' },
  rtgs: { name: 'NEFT/RTGS Collections', type: 'bank', tallyGroup: 'Bank Accounts' },
  insurance: { name: 'Insurance Collections', type: 'bank', tallyGroup: 'Bank Accounts' },
  unknown: { name: 'Unclassified Collections (Needs Review)', type: 'bank', tallyGroup: 'Bank Accounts' },
}

export const REVENUE_ACCOUNT = { name: 'Diagnostic Services Revenue', type: 'income', tallyGroup: 'Direct Income' }

// IST date label
export function istDateLabel(d: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(d)
}

export function istDateTime(d: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  }).format(d).replace(/(\d{4})-(\d{2})-(\d{2}), (\d{2}):(\d{2}):(\d{2})/, '$1-$2-$3 $4:$5:$6')
}

// Commission calculation — mirrors reference repo's calcTestCommission
export function calcTestCommission(
  testPrice: number,
  testCategories: string[],
  testId: string,
  rules: Array<{
    type: string
    value: number
    scope: string
    categories?: string | null
    testIds?: string | null
    isExclusive: boolean
    isActive: boolean
  }>,
  doctorDefault: { type: string; value: number },
): number {
  const parseArr = (s?: string | null): string[] => {
    if (!s) return []
    try { return JSON.parse(s) as string[] } catch { return [] }
  }

  // 1. EXCLUSIVE rules first (test-scoped, then category-scoped)
  let matched = rules.find((r) =>
    r.isExclusive && r.isActive && r.scope === 'test' && parseArr(r.testIds).includes(testId),
  )
  if (!matched) {
    matched = rules.find((r) =>
      r.isExclusive && r.isActive && r.scope === 'category' &&
      parseArr(r.categories).some((c) => testCategories.includes(c)),
    )
  }

  // 2. Non-exclusive specific rules (test then category)
  if (!matched) {
    matched = rules.find((r) =>
      !r.isExclusive && r.isActive && r.scope === 'test' && parseArr(r.testIds).includes(testId),
    )
  }
  if (!matched) {
    matched = rules.find((r) =>
      !r.isExclusive && r.isActive && r.scope === 'category' &&
      parseArr(r.categories).some((c) => testCategories.includes(c)),
    )
  }

  // 3. Catch-all rule
  if (!matched) {
    matched = rules.find((r) => r.isActive && r.scope === 'all')
  }

  if (matched) {
    return matched.type === 'percentage'
      ? (testPrice * matched.value) / 100
      : matched.value
  }

  // 4. Fall back to doctor's default
  const defVal = doctorDefault.value
  if (defVal <= 0) return 0
  return doctorDefault.type === 'percentage' ? (testPrice * defVal) / 100 : defVal
}

// Apply discount deduction (clinic-level setting)
export function applyDiscountDeduction(
  rawCommission: number,
  billDiscount: number,
  mode: string, // none | deduct | deduct_rollover
): number {
  if (mode === 'none' || billDiscount <= 0) return rawCommission
  if (mode === 'deduct') return Math.max(0, rawCommission - billDiscount)
  if (mode === 'deduct_rollover') return rawCommission - billDiscount
  return rawCommission
}
