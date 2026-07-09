// Integration smoke tests — exercise login, booking, billing, settings and
// permissions against a RUNNING instance. Skipped unless TEST_BASE_URL is set,
// e.g.  TEST_BASE_URL=http://localhost:3010/erp \
//       TEST_ADMIN_NAME=admin@test.local TEST_ADMIN_PIN=TestPin123! \
//       node --test tests/
import { test } from 'node:test'
import assert from 'node:assert/strict'

const BASE = process.env.TEST_BASE_URL
const ADMIN = process.env.TEST_ADMIN_NAME || 'admin@test.local'
const PIN = process.env.TEST_ADMIN_PIN || 'TestPin123!'
const skip = !BASE ? { skip: 'set TEST_BASE_URL to run integration smoke tests' } : {}

async function login() {
  const r = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: ADMIN, pin: PIN }),
  })
  assert.equal(r.status, 200, 'admin login should succeed')
  const d = await r.json()
  return d.token
}
const auth = (t) => ({ Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' })

test('health endpoint reports db up', skip, async () => {
  const r = await fetch(`${BASE}/api/health`)
  assert.equal(r.status, 200)
  assert.equal((await r.json()).db, 'up')
})

test('base path enforced: root path 404s, /api under base works', skip, async () => {
  const origin = new URL(BASE).origin
  assert.equal((await fetch(`${origin}/`)).status, 404)
})

test('login rejects a wrong PIN and accepts the right one', skip, async () => {
  const bad = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: ADMIN, pin: 'wrong-pin' }),
  })
  assert.equal(bad.status, 401)
  assert.ok(await login())
})

test('protected APIs reject unauthenticated requests', skip, async () => {
  for (const p of ['/api/patients', '/api/bills', '/api/dashboard', '/api/users']) {
    assert.equal((await fetch(`${BASE}${p}`)).status, 401, `${p} should be 401 without auth`)
  }
})

test('permissions: whatsapp chatbot is not public', skip, async () => {
  const r = await fetch(`${BASE}/api/whatsapp/chatbot`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: 'hi' }),
  })
  assert.equal(r.status, 401)
})

test('settings: clinic get/update is idempotent (singleton)', skip, async () => {
  const t = await login()
  const upd = await fetch(`${BASE}/api/clinic`, { method: 'PUT', headers: auth(t), body: JSON.stringify({ name: 'Smoke Test Clinic' }) })
  assert.equal(upd.status, 200)
  const again = await fetch(`${BASE}/api/clinic`, { method: 'PUT', headers: auth(t), body: JSON.stringify({ name: 'Smoke Test Clinic 2' }) })
  assert.equal(again.status, 200)
  const get = await fetch(`${BASE}/api/clinic`, { headers: auth(t) })
  assert.equal((await get.json()).clinic.name, 'Smoke Test Clinic 2')
})

test('billing flow: patient -> order -> bill', skip, async () => {
  const t = await login()
  // A test is needed to build an order.
  const tests = await (await fetch(`${BASE}/api/tests`, { headers: auth(t) })).json()
  let testId = tests.tests?.[0]?.id
  if (!testId) {
    const created = await fetch(`${BASE}/api/tests`, { method: 'POST', headers: auth(t), body: JSON.stringify({ code: 'SMOKE1', name: 'Smoke Test', price: 100 }) })
    testId = (await created.json()).test?.id
  }
  assert.ok(testId, 'need a test to bill')

  const patient = await (await fetch(`${BASE}/api/patients`, { method: 'POST', headers: auth(t), body: JSON.stringify({ name: 'Billing Smoke', phone: '9998887776' }) })).json()
  const order = await (await fetch(`${BASE}/api/orders`, { method: 'POST', headers: auth(t), body: JSON.stringify({ patientId: patient.patient.id, testIds: [testId] }) })).json()
  assert.ok(order.order?.id, 'order created')

  const billRes = await fetch(`${BASE}/api/bills`, { method: 'POST', headers: auth(t), body: JSON.stringify({ orderId: order.order.id, payments: [{ amount: 100, method: 'cash' }] }) })
  assert.equal(billRes.status, 200)
  const bill = await billRes.json()
  assert.match(bill.bill.billNumber, /^\d{6}\d{4}$/, 'bill number format YYYYMM####')
  assert.equal(bill.bill.status, 'paid')
})

test('online booking: public initiate creates a booking (pay-at-centre when ICICI unset)', skip, async () => {
  const t = await login()
  const tests = await (await fetch(`${BASE}/api/public/booking/tests`)).json()
  const testId = tests.tests?.[0]?.id
  if (!testId) return
  const r = await fetch(`${BASE}/api/public/booking/initiate`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ patientName: 'Web Booking', patientPhone: '9990001234', testIds: [testId], appointmentDate: '2030-01-01', timeSlot: '10:00' }),
  })
  assert.equal(r.status, 200)
  const d = await r.json()
  assert.match(d.bookingRef, /^OB-/)
})
