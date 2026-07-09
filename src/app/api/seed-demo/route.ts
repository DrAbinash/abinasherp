import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getStaffSession } from '@/lib/session'
import { hashPin } from '@/lib/auth'
import { bootstrapAdminIfNeeded, seedDefaultAccounts } from '@/lib/seed'

// Seed demo data — callable once to populate everything
export async function POST() {
  const session = await getStaffSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!session.isOwner) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Demo seeding disabled in production' }, { status: 403 })
  }

  await bootstrapAdminIfNeeded()
  await seedDefaultAccounts()

  // Create demo clinic if missing
  const clinicCount = await db.clinic.count()
  if (clinicCount === 0) {
    await db.clinic.create({
      data: {
        name: 'Care Diagnostic Centre',
        address: 'Main Road, City',
        phone: '+91-9876543210',
        email: 'info@carediagnostic.example',
        currency: 'INR',
      },
    })
  }

  // Demo staff user (receptionist)
  const receptionist = await db.user.findUnique({ where: { email: 'reception@careerp.local' } })
  if (!receptionist) {
    await db.user.create({
      data: {
        name: 'Reception Demo',
        email: 'reception@careerp.local',
        role: 'receptionist',
        pinHash: await hashPin('demo123'),
        permissions: JSON.stringify(['/', '/patients', '/orders']),
        isActive: true,
      },
    })
  }

  // Demo test categories + tests
  const catNames = ['Hematology', 'Biochemistry', 'Microbiology', 'Pathology', 'Cardiology', 'Radiology']
  const cats: Record<string, string> = {}
  for (const name of catNames) {
    let c = await db.testCategory.findUnique({ where: { name } })
    if (!c) c = await db.testCategory.create({ data: { name, description: `${name} tests` } })
    cats[name] = c.id
  }

  const testsData = [
    { code: 'CBC', name: 'Complete Blood Count', category: 'Hematology', price: 350 },
    { code: 'LFT', name: 'Liver Function Test', category: 'Biochemistry', price: 800 },
    { code: 'KFT', name: 'Kidney Function Test', category: 'Biochemistry', price: 700 },
    { code: 'LIPID', name: 'Lipid Profile', category: 'Biochemistry', price: 600 },
    { code: 'TSH', name: 'Thyroid Stimulating Hormone', category: 'Biochemistry', price: 450 },
    { code: 'URINE', name: 'Urine Routine', category: 'Pathology', price: 150 },
    { code: 'STOOL', name: 'Stool Routine', category: 'Pathology', price: 200 },
    { code: 'WIDAL', name: 'Widal Test', category: 'Microbiology', price: 400 },
    { code: 'ECG', name: 'Electrocardiogram', category: 'Cardiology', price: 250 },
    { code: '2DECHO', name: '2D Echocardiography', category: 'Cardiology', price: 1200 },
  ]
  for (const t of testsData) {
    const existing = await db.test.findUnique({ where: { code: t.code } })
    if (!existing) {
      await db.test.create({
        data: {
          code: t.code, name: t.name, categoryId: cats[t.category], price: t.price,
        },
      })
    }
  }

  // Demo doctors
  const doctorsData = [
    { name: 'Dr. Rajesh Kumar', specialization: 'General Medicine', phone: '9876543211', defaultCommission: 10, defaultCommissionType: 'percentage', registrationNumber: 'REG-001' },
    { name: 'Dr. Sunita Patel', specialization: 'Cardiology', phone: '9876543212', defaultCommission: 15, defaultCommissionType: 'percentage', registrationNumber: 'REG-002' },
    { name: 'Dr. Amit Sharma', specialization: 'Orthopedics', phone: '9876543213', defaultCommission: 12, defaultCommissionType: 'percentage', registrationNumber: 'REG-003' },
    { name: 'Dr. Priya Reddy', specialization: 'Gynecology', phone: '9876543214', defaultCommission: 0, defaultCommissionType: 'percentage', registrationNumber: 'REG-004' },
  ]
  for (const d of doctorsData) {
    const existing = await db.doctor.findFirst({ where: { name: d.name } })
    if (!existing) {
      await db.doctor.create({ data: d })
    }
  }

  // Demo patients
  const patientsData = [
    { name: 'John Doe', phone: '9123456789', age: 34, gender: 'male' },
    { name: 'Jane Smith', phone: '9123456790', age: 28, gender: 'female' },
    { name: 'Ravi Verma', phone: '9123456791', age: 45, gender: 'male' },
    { name: 'Anita Singh', phone: '9123456792', age: 31, gender: 'female' },
    { name: 'Mohammed Ali', phone: '9123456793', age: 52, gender: 'male' },
  ]
  let patientCount = await db.patient.count()
  for (const p of patientsData) {
    patientCount++
    await db.patient.create({
      data: { patientId: `P-${String(patientCount).padStart(5, '0')}`, ...p },
    })
  }

  // Demo bank account
  const bankCount = await db.bankAccount.count()
  if (bankCount === 0) {
    await db.bankAccount.create({
      data: {
        provider: 'generic',
        bankName: 'HDFC Bank — Current',
        maskedAccountNumber: 'XXXXXX1234',
        ifsc: 'HDFC0001234',
        branch: 'Main Branch',
        currentBalance: 250000,
        status: 'active',
      },
    })
  }

  // Demo staff
  const staffCount = await db.staff.count()
  if (staffCount === 0) {
    const counter = await db.staffCounter.upsert({
      where: { id: 1 },
      update: { counter: { increment: 2 } },
      create: { id: 1, counter: 2 },
    })
    await db.staff.create({
      data: {
        staffId: `EMP-${String(counter.counter - 1).padStart(4, '0')}`,
        firstName: 'Ashok', lastName: 'Kumar', phone: '9988776655', role: 'lab-technician', department: 'Lab', baseSalary: 18000,
      },
    })
    await db.staff.create({
      data: {
        staffId: `EMP-${String(counter.counter).padStart(4, '0')}`,
        firstName: 'Meena', lastName: 'Devi', phone: '9988776656', role: 'receptionist', department: 'Front Desk', baseSalary: 15000,
      },
    })
  }

  return NextResponse.json({ ok: true, message: 'Demo data seeded' })
}
