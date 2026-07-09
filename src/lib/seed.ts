import { db } from '@/lib/db'
import { hashPin, generateToken, DEFAULT_ROLE_PERMISSIONS } from '@/lib/auth'

// Bootstrap a default super-admin on first run
export async function bootstrapAdminIfNeeded() {
  const userCount = await db.user.count()
  if (userCount > 0) return

  const email = process.env.BOOTSTRAP_ADMIN_EMAIL || 'admin@careerp.local'
  const name = process.env.BOOTSTRAP_ADMIN_NAME || 'System Administrator'
  const pin = process.env.BOOTSTRAP_ADMIN_PIN || 'admin123'
  const role = 'super_admin'

  await db.user.create({
    data: {
      name,
      email,
      role,
      pinHash: await hashPin(pin),
      permissions: JSON.stringify(DEFAULT_ROLE_PERMISSIONS[role] || ['*']),
      mustChangePin: false,
      remoteLoginEnabled: true, // Allow login without USB key for first setup
      isActive: true,
    },
  })

  // Create default clinic
  const clinicCount = await db.clinic.count()
  if (clinicCount === 0) {
    await db.clinic.create({
      data: {
        name: process.env.CLINIC_NAME || 'Care Diagnostic Centre',
        address: process.env.CLINIC_ADDRESS || 'Main Road, City',
        phone: process.env.CLINIC_PHONE || '',
        email: process.env.CLINIC_EMAIL || '',
      },
    })
  }

  // Seed default role permissions
  const rolePerms = [
    { role: 'super_admin', all: true },
    { role: 'admin', all: true },
    { role: 'manager', modules: ['dashboard', 'patients', 'billing', 'payments', 'orders', 'doctors', 'referrals', 'accounting', 'expenses', 'staff', 'banking'], canView: true, canCreate: true, canEdit: true, canDelete: true, canPrint: true, canExport: true },
    { role: 'accountant', modules: ['dashboard', 'accounting', 'billing', 'payments', 'expenses', 'banking'], canView: true, canCreate: true, canEdit: true, canExport: true },
    { role: 'billing', modules: ['dashboard', 'patients', 'billing', 'payments'], canView: true, canCreate: true, canEdit: true, canPrint: true, canReprint: true },
    { role: 'receptionist', modules: ['dashboard', 'patients', 'orders'], canView: true, canCreate: true, canEdit: true },
    { role: 'lab', modules: ['dashboard', 'orders', 'tests'], canView: true, canCreate: true, canEdit: true },
    { role: 'doctor', modules: ['dashboard', 'patients', 'orders'], canView: true },
  ]

  for (const rp of rolePerms) {
    if (rp.all) {
      // Grant all permissions for all modules
      const modules = ['dashboard', 'patients', 'billing', 'payments', 'orders', 'tests', 'doctors', 'commission', 'accounting', 'expenses', 'banking', 'referrals', 'staff', 'settings']
      for (const m of modules) {
        await db.rolePermission.upsert({
          where: { role_module: { role: rp.role, module: m } },
          update: {},
          create: {
            role: rp.role, module: m,
            canView: true, canCreate: true, canEdit: true, canDelete: true,
            canPrint: true, canReprint: true, canRefund: true, canExport: true,
            canApprove: true, canFinalize: true,
          },
        })
      }
    } else if (rp.modules) {
      for (const m of rp.modules) {
        await db.rolePermission.upsert({
          where: { role_module: { role: rp.role, module: m } },
          update: {},
          create: {
            role: rp.role, module: m,
            canView: rp.canView || false,
            canCreate: rp.canCreate || false,
            canEdit: rp.canEdit || false,
            canDelete: rp.canDelete || false,
            canPrint: rp.canPrint || false,
            canReprint: rp.canReprint || false,
            canRefund: rp.canRefund || false,
            canExport: rp.canExport || false,
            canApprove: rp.canApprove || false,
            canFinalize: rp.canFinalize || false,
          },
        })
      }
    }
  }
}

// Seed default accounts (Tally-compatible chart of accounts)
export async function seedDefaultAccounts() {
  const count = await db.account.count()
  if (count > 0) return

  const defaults = [
    { name: 'Cash in Hand', type: 'cash', tallyGroup: 'Cash-in-Hand', openingBalance: 0, openingBalanceType: 'Dr' },
    { name: 'Bank Account', type: 'bank', tallyGroup: 'Bank Accounts', openingBalance: 0, openingBalanceType: 'Dr' },
    { name: 'Diagnostic Services Revenue', type: 'income', tallyGroup: 'Direct Income', openingBalance: 0, openingBalanceType: 'Cr' },
    { name: 'Consultation Revenue', type: 'income', tallyGroup: 'Direct Income', openingBalance: 0, openingBalanceType: 'Cr' },
    { name: 'Staff Salaries', type: 'expense', tallyGroup: 'Indirect Expenses', openingBalance: 0, openingBalanceType: 'Dr' },
    { name: 'Lab Supplies & Reagents', type: 'expense', tallyGroup: 'Indirect Expenses', openingBalance: 0, openingBalanceType: 'Dr' },
    { name: 'Equipment Maintenance', type: 'expense', tallyGroup: 'Indirect Expenses', openingBalance: 0, openingBalanceType: 'Dr' },
    { name: 'Rent', type: 'expense', tallyGroup: 'Indirect Expenses', openingBalance: 0, openingBalanceType: 'Dr' },
    { name: 'Utilities', type: 'expense', tallyGroup: 'Indirect Expenses', openingBalance: 0, openingBalanceType: 'Dr' },
    { name: 'Marketing', type: 'expense', tallyGroup: 'Indirect Expenses', openingBalance: 0, openingBalanceType: 'Dr' },
    { name: 'Sundry Debtors', type: 'asset', tallyGroup: 'Sundry Debtors', openingBalance: 0, openingBalanceType: 'Dr' },
    { name: 'Fixed Assets', type: 'asset', tallyGroup: 'Fixed Assets', openingBalance: 0, openingBalanceType: 'Dr' },
    { name: 'Capital Account', type: 'liability', tallyGroup: 'Capital Account', openingBalance: 0, openingBalanceType: 'Cr' },
    { name: 'Sundry Creditors', type: 'liability', tallyGroup: 'Sundry Creditors', openingBalance: 0, openingBalanceType: 'Cr' },
    { name: 'Duties & Taxes', type: 'liability', tallyGroup: 'Duties & Taxes', openingBalance: 0, openingBalanceType: 'Cr' },
  ]

  for (const a of defaults) {
    await db.account.create({ data: a })
  }
}

// Auto-voucher helper — fires after a payment is recorded
export async function autoVoucherForPayment(
  billId: string,
  amount: number,
  method: string,
  performedBy: string,
  performedByName: string,
) {
  // amount > 0 → Receipt Voucher: Debit method-account, Credit revenue
  // amount < 0 → Payment Voucher (refund): Debit revenue, Credit method-account
  const isRefund = amount < 0
  const absAmount = Math.abs(amount)

  const methodAccountInfo = METHOD_TO_ACCOUNT[method] || METHOD_TO_ACCOUNT.unknown
  let methodAccount = await db.account.findUnique({ where: { name: methodAccountInfo.name } })
  if (!methodAccount) {
    methodAccount = await db.account.create({
      data: {
        name: methodAccountInfo.name,
        type: methodAccountInfo.type,
        tallyGroup: methodAccountInfo.tallyGroup,
      },
    })
  }

  let revenueAccount = await db.account.findUnique({ where: { name: REVENUE_ACCOUNT.name } })
  if (!revenueAccount) {
    revenueAccount = await db.account.create({
      data: {
        name: REVENUE_ACCOUNT.name,
        type: REVENUE_ACCOUNT.type,
        tallyGroup: REVENUE_ACCOUNT.tallyGroup,
      },
    })
  }

  const type = isRefund ? 'payment' : 'receipt'
  const count = await db.voucher.count({ where: { type } })
  const voucherNumber = generateVoucherNumber(type, count + 1)

  const creditAccountId = isRefund ? methodAccount.id : revenueAccount.id
  const debitAccountId = isRefund ? revenueAccount.id : methodAccount.id

  const voucher = await db.voucher.create({
    data: {
      voucherNumber,
      type,
      date: istDateLabel(),
      creditAccountId,
      debitAccountId,
      amount: absAmount,
      particular: `${isRefund ? 'Refund' : 'Receipt'} for Bill ${billId.slice(-8)}`,
      reference: billId,
      performedBy: performedByName,
      billId,
      createdById: performedBy,
    },
  })
  return voucher
}

// Auto-voucher for expense
export async function autoVoucherForExpense(
  expenseId: string,
  category: string,
  amount: number,
  paymentMode: string,
  performedBy: string,
  performedByName: string,
) {
  const expenseAccountName = `Expenses — ${category}`
  let expenseAccount = await db.account.findUnique({ where: { name: expenseAccountName } })
  if (!expenseAccount) {
    expenseAccount = await db.account.create({
      data: {
        name: expenseAccountName,
        type: 'expense',
        tallyGroup: 'Indirect Expenses',
      },
    })
  }

  // paymentMode: cash | bank-transfer | cheque | upi | card
  const modeAccountMap: Record<string, string> = {
    cash: 'Cash in Hand',
    'bank-transfer': 'Bank Account',
    cheque: 'Cheque Collections',
    upi: 'UPI Collections',
    card: 'Card Collections',
  }
  const modeAccountName = modeAccountMap[paymentMode] || 'Bank Account'
  let modeAccount = await db.account.findUnique({ where: { name: modeAccountName } })
  if (!modeAccount) {
    modeAccount = await db.account.create({
      data: { name: modeAccountName, type: 'bank', tallyGroup: 'Bank Accounts' },
    })
  }

  const count = await db.voucher.count({ where: { type: 'payment' } })
  const voucherNumber = generateVoucherNumber('payment', count + 1)

  const voucher = await db.voucher.create({
    data: {
      voucherNumber,
      type: 'payment',
      date: istDateLabel(),
      creditAccountId: modeAccount.id, // credit cash/bank
      debitAccountId: expenseAccount.id, // debit expense
      amount,
      particular: `Expense: ${category} (${expenseId})`,
      reference: expenseId,
      performedBy: performedByName,
      createdById: performedBy,
    },
  })
  return voucher
}

import { METHOD_TO_ACCOUNT, REVENUE_ACCOUNT, generateVoucherNumber, istDateLabel } from '@/lib/auth'
