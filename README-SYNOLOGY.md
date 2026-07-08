# Care ERP — Synology NAS Deployment Guide

A complete enterprise management system for diagnostic centres: **billing, accounting, banking, referral doctors, commission, staff, role-based users, and super-admin** with USB-key gating.

Built with Next.js 16, Prisma (SQLite), and TypeScript. Container-ready for Synology NAS.

---

## ✨ Features

### Billing Module
- Create bills with idempotency keys (prevents double-billing)
- Inline payments (cash, UPI, card, cheque, bank, online)
- Discount validation with per-user max-discount cap
- Auto-cascade: cancelling a bill cancels its order_tests (stops commission accrual)
- Refunds: total amount NEVER mutated; refundAmount accumulates; balance recomputed
- Dues tracking with status-aware filtering
- Auto-voucher generation (RV receipt / PV refund) wired to accounting

### Accounting Module
- Tally-compatible chart of accounts (Cash-in-Hand, Bank Accounts, Sundry Debtors, etc.)
- Voucher types: Receipt (RV), Payment (PV), Contra (BT), Journal (JV), Sales (SV), Purchase (PUR)
- Race-safe voucher numbering with prefix-per-type sequence
- Per-account ledger with running balance (Dr/Cr nature-aware)
- Trial Balance, Profit & Loss, Balance Sheet — all auto-generated
- Default accounts seeding (one click)

### Banking Module
- Multiple bank accounts (HDFC, ICICI, SBI, generic, etc.)
- Transactions (credit/debit) with UTR tracking
- Auto-reconciliation engine with confidence scores:
  - `exact_utr` (100) → `exact_invoice_ref` (90) → `exact_amount_time` (80) → manual (100)
- Refund requests: requested → approved → processing → completed
- Fraud alerts with severity levels (critical/high/medium/low)

### Referral Doctors
- Full CRUD with specialization, registration #, contact info
- Default commission (percentage or fixed)
- CSV-ready data structure

### Commission Module (Super-Admin only)
- Per-doctor, per-test, per-category commission rules
- Exclusive rules override non-exclusive ones
- Catch-all fallback to doctor's default
- VIP order de-markup support
- Clinic-level discount deduction modes: `none` / `deduct` (floor 0) / `deduct_rollover` (can go negative)
- Detailed test-level report with grouping by test/category/order

### Doctor Ledger (Super-Admin only)
- Earned vs paid running balance per doctor
- Payout recording (cash/bank/UPI/cheque/card)
- Outstanding summary across all doctors

### Staff Module
- Employee records (EMP-#### auto-numbered)
- Salary structure with FIFO advance recovery
- Attendance (punch in/out with unique constraint)
- Advances tracking (outstanding/cleared)

### Role-Based Users
- Roles: `super_admin`, `admin`, `manager`, `receptionist`, `billing`, `accountant`, `lab`, `doctor`
- Granular per-module permissions matrix (canView / canCreate / canEdit / canDelete / canPrint / canReprint / canRefund / canExport / canApprove / canFinalize)
- Per-user `maxDiscount` cap (percentage)
- Account lockout after 5 failed attempts (15-min cooldown)
- `mustChangePin` flag for admin-created users

### Super-Admin (USB-Key Gated)
- Separate `/api/super-admin/login` endpoint with 8-hour token expiry
- Optional USB-key gating (`SUPER_ADMIN_USB_KEY` env var)
  - When set, super-admin routes require both `X-SA-Token` AND `X-SA-USB-Key` headers
  - `remoteLoginEnabled` flag on user allows bypass for owner
- Token verification polling every 30 seconds
- Constant-time comparison via `crypto.timingSafeEqual`

### Day Close
- Two-level reconciliation: clinic-wide + per-user drawer
- Cash expenses reduce drawer (digital expenses are informational only)
- Unrecognized payment methods → suspense bucket (never silently treated as cash)
- Variance tracking with denomination capture
- Reopen requires super-admin role

### Audit Logs
- System-wide audit trail (user actions, module, entity, IP, timestamp)
- Bill-specific audits (reprint, cancelled, refund, test_swapped, etc.)

---

## 🚀 Synology NAS Deployment

### Prerequisites
- Synology NAS running DSM 7.0 or later
- **Container Manager** package installed (formerly Docker)
- ~512MB free RAM for the container

### Option A: Via Container Manager GUI

1. **Create project directory** on your NAS:
   ```
   /volume1/docker/care-erp/
   ```

2. **Copy these files** into that directory:
   - `Dockerfile`
   - `docker-compose.yml`
   - `env.example` → rename to `env`
   - All source files (or clone the repo there)

3. **Edit the `env` file**:
   - Change `BOOTSTRAP_ADMIN_PIN` to a strong password
   - Change `BOOTSTRAP_ADMIN_EMAIL` to your email
   - Change `NEXTAUTH_SECRET` to a random 32-character string
   - Set `NEXTAUTH_URL` to `http://<your-nas-ip>:3000`

4. **Open Container Manager** → **Project** → **Create**
   - Project name: `care-erp`
   - Path: `/volume1/docker/care-erp/`
   - Click **Next** → Container Manager detects `docker-compose.yml` automatically
   - Click **Done** to build and start

5. **Wait for build** (~5-10 minutes on first run). The container will:
   - Install dependencies
   - Build the Next.js standalone bundle
   - Run `prisma db push` to create tables
   - Bootstrap a super-admin from env vars
   - Start the server on port 3000

6. **Access** at `http://<your-nas-ip>:3000`

### Option B: Via SSH (advanced)

```bash
ssh admin@your-nas-ip
sudo -i
mkdir -p /volume1/docker/care-erp
cd /volume1/docker/care-erp
# Copy project files here (scp, git clone, etc.)
cp env.example env
vi env  # edit values
docker compose up -d --build
docker compose logs -f  # watch startup
```

### Reverse Proxy with HTTPS (recommended)

In Synology **Control Panel** → **Login Portal** → **Advanced** → **Reverse Proxy**:

| Setting | Value |
|---|---|
| Source | HTTPS, port 8443 (or your choice) |
| Destination | HTTP, localhost:3000 |
| Enable HSTS | ✅ |

Now access via `https://<your-nas-ip>:8443` with a self-signed or Let's Encrypt cert.

---

## 🔒 Security Hardening

### Enable USB-Key Gating for Super-Admin (Recommended for Production)

1. Generate a strong random key:
   ```bash
   openssl rand -hex 32 > superadmin.key
   ```

2. Copy `superadmin.key` to a USB drive. Plug the drive into any workstation that needs super-admin access.

3. Add to your `env` file:
   ```
   SUPER_ADMIN_USB_KEY=<contents-of-superadmin.key>
   ```

4. Restart the container: `docker compose restart care-erp`

5. The super-admin portal (or your script) must read `superadmin.key` from the USB drive and send it as the `X-SA-USB-Key` header on every super-admin request. If the drive is unplugged, super-admin routes are blocked.

### Backup the Database

The SQLite database lives at `/app/data/care-erp.db` inside the container, mapped to a Docker volume. To back up:

```bash
# On the NAS
docker exec care-erp cat /app/data/care-erp.db > /volume1/backup/care-erp-$(date +%F).db

# Or via Synology Hyper Backup — include the volume path
```

Schedule this via **Task Scheduler** (Control Panel → Task Scheduler → Create → Scheduled Task → User-defined script).

### Change Default Admin PIN

After first login:
1. Login with `admin@yourclinic.com` / `ChangeMe123!`
2. Click your avatar → **Change PIN**
3. Set a strong PIN (≥8 chars recommended)

---

## 🛠️ Development

### Local Development
```bash
bun install
bun run db:push      # Create SQLite schema
bun run dev          # Start dev server at localhost:3000
```

### Default Admin (dev)
- Email: `admin@careerp.local`
- PIN: `admin123`
- (Auto-created on first run via `bootstrapAdminIfNeeded`)

### Build for Production
```bash
bun run build        # Creates .next/standalone/
bun run start        # Start production server
```

---

## 📦 Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack) |
| Language | TypeScript 5 (strict) |
| UI | Tailwind CSS 4 + shadcn/ui (New York) + Lucide icons |
| Charts | Recharts |
| Database | SQLite via Prisma ORM |
| Auth | Custom credentials provider with bcrypt-hashed PINs |
| Container | Docker (Node 22 Alpine) + dumb-init |
| Deployment | Docker Compose on Synology NAS |

---

## 📁 Project Structure

```
src/
├── app/
│   ├── api/                      # API routes (App Router)
│   │   ├── auth/                 # Login, me, change-pin
│   │   ├── super-admin/          # SA login/verify/logout + USB status
│   │   ├── dashboard/            # Aggregate stats
│   │   ├── patients/  doctors/  tests/  test-categories/  orders/
│   │   ├── bills/                # + [id]/cancel + [id]/refund
│   │   ├── payments/
│   │   ├── accounting/           # accounts, vouchers, ledger, trial-balance, profit-loss, balance-sheet
│   │   ├── expenses/
│   │   ├── banking/              # accounts, transactions, reconciliation, refunds, fraud
│   │   ├── commission/           # rules, report, report-detailed
│   │   ├── doctor-ledger/        # + [doctorId]/payouts
│   │   ├── day-close/            # + my-close
│   │   ├── staff/                # + [id]/{advances,salary,attendance}
│   │   ├── users/                # + [id]
│   │   ├── role-permissions/
│   │   ├── clinic/  audit-logs/  seed-demo/
│   ├── globals.css               # Bright, colorful enterprise theme
│   ├── layout.tsx
│   └── page.tsx                  # Main shell — auth gate + page router
├── components/
│   ├── login-screen.tsx
│   ├── sidebar.tsx               # Collapsible nav with role-based filtering
│   ├── pages/
│   │   ├── dashboard.tsx         # Stat cards + revenue chart + method pie
│   │   ├── billing.tsx           # Bills list, create wizard, dues, payments
│   │   ├── accounting.tsx        # Vouchers, accounts, ledger, TB, P&L, BS, expenses
│   │   ├── banking.tsx           # Accounts, transactions, reconciliation, refunds, fraud
│   │   └── management.tsx        # Referrals, commission, doctor-ledger, staff, users, roles, clinic, audit, day-close
│   └── ui/                       # shadcn/ui components
├── lib/
│   ├── auth.ts                   # Roles, permissions, PIN hashing, commission calc
│   ├── auth-context.tsx          # React context + useApi hook
│   ├── session.ts                # Server-side session/super-admin verification
│   ├── seed.ts                   # Bootstrap admin + default accounts + auto-vouchers
│   ├── format.ts                 # Currency/date formatters (IST-aware)
│   └── db.ts                     # Prisma client singleton
└── prisma/
    └── schema.prisma             # 30+ models: Clinic, User, Patient, Doctor, Test, Order, Bill, Payment, Account, Voucher, Expense, BankAccount, BankTransaction, ReconciliationLog, FraudAlert, RefundRequest, CommissionRule, DoctorPayout, DayClosure, UserDayClosure, Staff, StaffAdvance, StaffSalaryPayment, StaffAttendance, RolePermission, AuditLog, etc.
```

---

## 🎨 Design Philosophy

- **Bright, colorful enterprise palette**: emerald primary, amber accent, multi-color charts
- **Glass-morphism touches** on stat cards
- **Sidebar gradient header** with brand identity
- **Hover-lift stat cards** with subtle shadows
- **Status-aware badges** (paid=emerald, partial=amber, cancelled=rose, pending=slate)
- **Mobile-responsive** with collapsible sidebar
- **Sticky header** with seed-demo shortcut
- **Page transitions** with fade-in animations

---

## 📝 Business Logic Invariants (from reference repo)

These rules are preserved verbatim from the battle-tested reference implementation:

1. **Bill `totalAmount` is NEVER mutated by refunds** — preserves historical revenue
2. **`balanceAmount = totalAmount − paidAmount − refundAmount`** (true net owed)
3. **Cancelled bills have `balanceAmount = 0`** (excluded from Dues filter)
4. **Expected Physical Cash = Cash In − Cash Refunded − Cash Expenses**
5. **Only `payment_mode="cash"` expenses reduce drawer**; digital/bank expenses are informational
6. **Unrecognized payment methods → suspense bucket**, never silently cash/digital
7. **Bill cancellation cascades to `order_tests`** (stops commission accrual)
8. **PINs stored as bcrypt** (legacy plaintext auto-upgraded on first login)
9. **Super-admin bill mutations require both `X-SA-Token` AND `X-SA-USB-Key`** (defense in depth)
10. **Refunds against closed periods are NEVER blocked** — carry forward to next open window
11. **Re-open closed day requires super-admin role**
12. **`admin`/`super_admin` bypass all per-module permission checks**
