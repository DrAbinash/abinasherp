// Static regression tests — guard against the deployment-breaking regressions
// found in the audit. These run WITHOUT a database (node --test tests/).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => readFileSync(path.join(ROOT, p), 'utf8')

// ---------------------------------------------------------------------------
// PostgreSQL / schema
// ---------------------------------------------------------------------------
test('schema uses the postgresql provider (not sqlite)', () => {
  const schema = read('prisma/schema.prisma')
  assert.match(schema, /provider\s*=\s*"postgresql"/)
  assert.doesNotMatch(schema, /provider\s*=\s*"sqlite"/)
})

test('bucketed counter models use autoincrement (would collide on Postgres otherwise)', () => {
  const schema = read('prisma/schema.prisma')
  // Every counter model that upserts per date/month bucket must NOT pin id default(1).
  for (const model of [
    'ExpenseCounter', 'ExpenseBillCounter', 'FormFCounter', 'PatientReportCounter',
    'AppointmentCounter', 'SampleCounter', 'HomeCollectionCounter', 'CorporateInvoiceCounter',
  ]) {
    const block = schema.slice(schema.indexOf(`model ${model} `))
    const idLine = block.slice(0, block.indexOf('}')).split('\n').find((l) => l.includes('id '))
    assert.ok(idLine.includes('autoincrement()'), `${model}.id must be autoincrement(), got: ${idLine.trim()}`)
  }
})

test('an initial migration exists and is committed', () => {
  assert.ok(existsSync(path.join(ROOT, 'prisma/migrations/0_init/migration.sql')))
  assert.ok(existsSync(path.join(ROOT, 'prisma/migrations/migration_lock.toml')))
  assert.match(read('prisma/migrations/migration_lock.toml'), /postgresql/)
})

test('committed baseline migration matches the schema — no drift (DB-free)', () => {
  // Regenerates the from-empty SQL for the current schema and compares it to the
  // committed baseline. If schema.prisma changed without regenerating the
  // migration, the two diverge. Pure schema->SQL, so it needs no database.
  const fresh = execFileSync('node', [
    'node_modules/prisma/build/index.js', 'migrate', 'diff',
    '--from-empty', '--to-schema-datamodel', 'prisma/schema.prisma', '--script',
  ], { cwd: ROOT, env: { ...process.env, DATABASE_URL: 'postgresql://x:x@localhost:5432/x' } }).toString()
  const committed = read('prisma/migrations/0_init/migration.sql')
  const norm = (s) => s.replace(/\s+/g, ' ').trim()
  assert.equal(norm(fresh), norm(committed),
    'prisma/migrations/0_init/migration.sql is out of date — run: prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script > prisma/migrations/0_init/migration.sql')
})

// ---------------------------------------------------------------------------
// /erp sub-path (basePath)
// ---------------------------------------------------------------------------
test('next.config wires basePath from NEXT_PUBLIC_BASE_PATH and does not hide type errors', () => {
  const cfg = read('next.config.ts')
  assert.match(cfg, /basePath/)
  assert.match(cfg, /NEXT_PUBLIC_BASE_PATH/)
  assert.match(cfg, /ignoreBuildErrors:\s*false/)
})

test('client API helper routes fetches through apiPath (base-path aware)', () => {
  const ctx = read('src/lib/auth-context.tsx')
  assert.match(ctx, /from '@\/lib\/base-path'/)
  // useApi methods must prefix the path
  assert.match(ctx, /fetch\(apiPath\(path\)/)
  assert.ok(existsSync(path.join(ROOT, 'src/lib/base-path.ts')))
})

// ---------------------------------------------------------------------------
// Case-insensitive search (Postgres LIKE is case-sensitive by default)
// ---------------------------------------------------------------------------
test('every Prisma `contains` filter sets mode: insensitive', () => {
  const files = execFileSync('grep', ['-rl', 'contains:', 'src/app/api'], { cwd: ROOT }).toString().trim().split('\n')
  const offenders = []
  for (const f of files) {
    read(f).split('\n').forEach((line, i) => {
      if (line.includes('contains:') && !line.includes('mode:')) offenders.push(`${f}:${i + 1}`)
    })
  }
  assert.deepEqual(offenders, [], `contains without mode:insensitive -> case-sensitive search on Postgres:\n${offenders.join('\n')}`)
})

// ---------------------------------------------------------------------------
// Security regressions
// ---------------------------------------------------------------------------
test('backup download & restore require owner role', () => {
  assert.match(read('src/app/api/backup/download/route.ts'), /isOwner/)
  assert.match(read('src/app/api/backup/restore/route.ts'), /isOwner/)
})

test('api-keys creation requires owner role', () => {
  assert.match(read('src/app/api/api-keys/route.ts'), /isOwner/)
})

test('verifyPin has no plaintext fallback', () => {
  const auth = read('src/lib/auth.ts')
  assert.doesNotMatch(auth, /return pin === hash/)
})

test('bootstrap admin fails closed in production without a PIN and forces PIN change', () => {
  const seed = read('src/lib/seed.ts')
  assert.match(seed, /BOOTSTRAP_ADMIN_PIN must be set in production|throw new Error/)
  assert.match(seed, /mustChangePin:\s*true/)
})

// ---------------------------------------------------------------------------
// Routes / pages that were broken
// ---------------------------------------------------------------------------
test('previously-broken API routes now exist', () => {
  for (const p of [
    'src/app/api/doctor-ledger/[doctorId]/route.ts',
    'src/app/api/whatsapp/test/route.ts',
    'src/app/api/banking/statements/upload/route.ts',
    'src/app/api/health/route.ts',
  ]) {
    assert.ok(existsSync(path.join(ROOT, p)), `missing route: ${p}`)
  }
})

test('Payments page component exists and is routed', () => {
  assert.ok(existsSync(path.join(ROOT, 'src/components/pages/payments.tsx')))
  assert.match(read('src/app/page.tsx'), /case 'payments'/)
})

test('sonner Toaster is mounted so toasts are visible', () => {
  assert.match(read('src/app/layout.tsx'), /ui\/sonner/)
})

test('error boundaries exist', () => {
  for (const p of ['src/app/error.tsx', 'src/app/global-error.tsx', 'src/app/not-found.tsx']) {
    assert.ok(existsSync(path.join(ROOT, p)), `missing: ${p}`)
  }
})

// ---------------------------------------------------------------------------
// Docker / Synology deployment
// ---------------------------------------------------------------------------
test('migrations run in a dedicated one-shot service, verified, and gate the app', () => {
  const c = read('docker-compose.yml')
  assert.match(c, /prisma migrate deploy/)
  assert.match(c, /prisma migrate status/) // schema verification
  assert.match(c, /service_completed_successfully/)
  assert.match(read('Dockerfile'), /postgresql-client/)
})

test('compose defines a postgres service with healthcheck-gated app startup and a durable volume', () => {
  const c = read('docker-compose.yml')
  assert.match(c, /postgres:16/)
  assert.match(c, /condition:\s*service_healthy/)
  assert.match(c, /care_erp_pgdata/)
  assert.match(c, /external:\s*true/) // survives `compose down -v`
  assert.match(c, /pg_isready/)
})

test('Docker healthcheck is a liveness probe (no DB) to avoid crash-loops', () => {
  // The route used by the healthcheck must not query the database.
  assert.doesNotMatch(read('src/app/api/health/route.ts'), /\$queryRaw|@\/lib\/db/)
  // DB readiness lives in a separate endpoint.
  assert.ok(existsSync(path.join(ROOT, 'src/app/api/health/db/route.ts')))
})

test('secret env files are excluded from the Docker image', () => {
  const di = read('.dockerignore')
  assert.match(di, /^\.env$/m)
  assert.match(di, /^env$/m)
})

test('compose fails fast when required secrets are missing', () => {
  const c = read('docker-compose.yml')
  assert.match(c, /DB_PASSWORD:\?/)
  assert.match(c, /BOOTSTRAP_ADMIN_PIN:\?/)
})

test('list endpoints clamp the limit param', () => {
  for (const f of ['src/app/api/bills/route.ts', 'src/app/api/orders/route.ts', 'src/app/api/patients/route.ts', 'src/app/api/payments/route.ts']) {
    assert.match(read(f), /Math\.min\(Math\.max\(parseInt/, `${f} does not clamp limit`)
  }
})
