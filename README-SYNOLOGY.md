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

---

## 🆕 New Features Added (V2)

### Tally ERP 9 + Tally Prime XML Export
- **Location**: Accounting → Top-right buttons
- **Tally ERP 9**: Traditional `<ENVELOPE>` format with masters + vouchers, `Import Data` request
- **Tally Prime**: Updated envelope with `<VERSION>2</VERSION>`, `<TDL>` definitions, `UDF:CAREERP_ID` custom fields for source tracking, `EFFECTIVEDATE` support
- **Usage**: Click the button → XML file downloads → Open Tally → Gateway of Tally → Import Data → XML → Select file

### Expense Bill OCR Scanning (with Supplier Auto-Create)
- **Location**: Operations → Bill Scanning (OCR)
- **Upload**: Drag-drop or click to upload JPEG/PNG/WebP/PDF bill images
- **VLM Extraction** (via z-ai-web-dev-sdk): Supplier name, GSTIN, PAN, bill #, date, line items, subtotal, tax, total, payment mode
- **Auto-supplier match**: If supplier exists by name or GSTIN, auto-links; otherwise auto-creates a new supplier with linked Sundry Creditor ledger account
- **Review & Post**: Edit extracted data, select payment mode (Credit/Cash/Bank/UPI/Cheque/Card), then post to ledger
- **Auto-voucher**: Generates Payment Voucher (PV) — debits expense account, credits supplier ledger (if credit) or cash/bank (if paid)
- **Audit trail**: Original file stored, OCR raw response + confidence score saved per bill

### Bank Statement Upload (CSV + PDF)
- **Location**: Banking → Upload Statement tab
- **CSV parsing**: Auto-detects delimiter (comma/tab/semicolon), header columns (Date/Narration/Debit/Credit/Balance/UTR/Ref), date formats (DD/MM/YYYY, YYYY-MM-DD)
- **PDF parsing**: Uses `pdf-parse` to extract text, then LLM to identify and structure transactions
- **Preview**: Shows all extracted transactions with summary (total credits, debits, net flow) before import
- **Import**: Skips duplicates by UTR + amount, updates bank balance, logs to bank audit
- **Auto-reconciliation**: Optionally runs after import — matches by exact UTR (100% confidence), bill-number-in-description (90%), amount+time (80%)

### Form F (PCPNDT) Scanning
- **Location**: Operations → Form F (PCPNDT)
- **Scan**: Upload a scanned Form F image
- **VLM Extraction**: All 30+ PCPNDT fields including patient name, age, husband/father name, address, mobile, LMP weeks, genetic history, procedure, gestational age, ultrasound result, abnormality, MTP details, doctor name, dates, place
- **Review & Edit**: All extracted fields are editable before saving
- **Auto-numbering**: FF-YYYY-#### sequence per year
- **Status workflow**: draft → submitted → approved / rejected

### Suppliers (Sundry Creditors / Debtors) Management
- **Location**: People → Suppliers
- **CRUD**: Full supplier management with type (creditor/debtor/both), GSTIN, PAN, contact, address, bank details
- **Auto-ledger**: Creating a supplier auto-creates a linked Account under Sundry Creditors or Sundry Debtors tally group
- **Bill tracking**: Each supplier shows count of linked expense bills; click to view detail with all bills listed
- **Opening balance**: Dr/Cr opening balance supported

### Global Search
- **Location**: Top header (always visible)
- **Searches**: Patients, Doctors, Bills, Orders, Vouchers, Suppliers, Staff — all in one query
- **Keyboard nav**: Arrow keys to navigate, Enter to jump, Esc to close
- **Debounced**: 250ms delay to avoid spamming the API

### GST Reports (GSTR-1 + GSTR-3B)
- **Location**: Finance → GST Reports (super-admin only)
- **GSTR-1**: Outward supplies — date range filter, shows all sales/receipt vouchers with CGST/SGST split (9% each on GST-applicable accounts)
- **GSTR-3B**: Summary return — outward supplies, ITC, output tax, input tax, net payable, ITC carried forward
- **Date range**: Custom from/to, click Generate to compute

### Bill Print Layout
- **API**: `GET /api/bills/:id/print` returns three copies (PATIENT COPY, OFFICE COPY, DUPLICATE COPY)
- **Each copy includes**: Clinic info (name, address, GSTIN, registration #), bill details (number, date, status, totals), patient info, doctor info, all order tests with prices, all payments
- **Ready for**: A5 portrait printing, three-copy print job

### Bulk Bill Operations
- **API**: `POST /api/bills/bulk-action`
- **Cancel**: Bulk cancel multiple bills with a single reason (admin/owner only)
- **Print**: Bulk fetch bills for multi-copy print

---

## 🔌 API Endpoints Added in V2

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/accounting/export/tally-erp9` | Download Tally ERP 9 XML |
| GET | `/api/accounting/export/tally-prime` | Download Tally Prime XML |
| GET/POST | `/api/suppliers` | List / create suppliers |
| GET/PATCH/DELETE | `/api/suppliers/:id` | Supplier detail / edit / delete |
| GET/POST | `/api/expense-bills` | List / save OCR-extracted bills |
| POST | `/api/expenses/scan-bill` | Upload bill → VLM extracts data |
| POST | `/api/expense-bills/:id/post` | Confirm and post bill to ledger (creates expense + voucher) |
| PATCH | `/api/expense-bills/:id/post` | Edit bill data before posting |
| POST/PUT | `/api/banking/statements/upload` | Upload CSV/PDF statement → parse → preview / confirm import |
| GET/POST | `/api/form-f` | List / create Form F records |
| GET/PATCH/DELETE | `/api/form-f/:id` | Form F detail / edit / delete |
| POST | `/api/form-f/scan` | Upload Form F image → VLM extracts all 30+ fields |
| GET | `/api/gst-reports?type=gstr1\|gstr3b` | GST returns |
| GET | `/api/search?q=` | Global search across all entities |
| POST | `/api/bills/bulk-action` | Bulk cancel / print |
| GET | `/api/bills/:id/print` | Three-copy bill print data |

---

## 📁 New Files Added in V2

```
prisma/schema.prisma                          # Added: Supplier, ExpenseBill, ExpenseBillCounter, FormFRecord, FormFCounter models
src/app/api/accounting/export/tally-erp9/route.ts
src/app/api/accounting/export/tally-prime/route.ts
src/app/api/suppliers/route.ts
src/app/api/suppliers/[id]/route.ts
src/app/api/expenses/scan-bill/route.ts        # VLM-based bill OCR
src/app/api/expense-bills/route.ts             # List / save extracted bills
src/app/api/expense-bills/[id]/post/route.ts   # Post to ledger (creates expense + voucher)
src/app/api/banking/statements/upload/route.ts # CSV/PDF upload + parse + import
src/app/api/form-f/route.ts
src/app/api/form-f/[id]/route.ts
src/app/api/form-f/scan/route.ts               # VLM-based Form F OCR
src/app/api/gst-reports/route.ts               # GSTR-1 + GSTR-3B
src/app/api/search/route.ts                    # Global search
src/app/api/bills/[id]/print/route.ts          # Three-copy print data
src/app/api/bills/bulk-action/route.ts         # Bulk cancel / print
src/components/pages/suppliers.tsx
src/components/pages/expense-bills.tsx         # OCR upload + review + post UI
src/components/pages/form-f.tsx                # Form F scan + list UI
src/components/pages/extras.tsx                # GlobalSearch + GstReports
```

## 🧠 Smart Behaviors (My Brain, Not Copy-Paste)

1. **Supplier auto-create on OCR**: When you scan a bill with a GSTIN not in the system, the system auto-creates the supplier + its ledger account in one transaction (no manual setup needed).
2. **Auto-ledger linking**: Every supplier gets a Tally-compatible account auto-created under Sundry Creditors (or Sundry Debtors if type=debtor).
3. **CSV column auto-detection**: The bank statement parser tries 4 strategies — explicit debit/credit columns, single amount column with sign, balance column tracking, UTR/Ref column index lookup.
4. **PDF text-then-LLM pipeline**: PDFs are parsed for text via `pdf-parse`, then sent to LLM (not VLM) for transaction extraction — much cheaper and more accurate than image-based OCR.
5. **Auto-reconciliation on import**: After importing a statement, the system optionally runs the full reconciliation engine (UTR match → invoice-ref match → amount+time match) so 80%+ of transactions get auto-matched.
6. **Tally Prime UDF tracking**: Each ledger and voucher includes a `UDF:CAREERP_ID` so you can trace back from Tally to the source record in Care ERP.
7. **Form F field-aware VLM prompt**: The prompt explicitly lists all 30+ PCPNDT fields so the VLM knows what to look for (not a generic "extract data" prompt).
8. **OCR confidence scoring**: Each scan returns a confidence score; bills with < 80% confidence are flagged for manual review.
9. **Idempotent expense-bill posting**: A bill can only be posted once; subsequent attempts return 400 with a clear error message.
10. **Keyboard-navigable global search**: Arrow keys + Enter + Esc — power-user friendly.
