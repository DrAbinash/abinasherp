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

---

## 🆕 New Features Added (V3)

### Inventory Management (rebuilt from reference repo)
- **Location**: People → Inventory
- **Schema**: Matches reference repo exactly — `InventoryItem` (name, unit, category, currentStock, minStock, costPrice, preferredVendorId) + `InventoryTransaction` (append-only ledger with stockBefore/stockAfter snapshots, type in/out/adjustment, vendorId, invoiceNumber, invoiceDate, unitCost)
- **Endpoints**:
  - `GET/POST /api/inventory` — list/create items
  - `GET /api/inventory/low-stock` — items where currentStock < minStock
  - `POST /api/inventory/:id/stock-in` — atomic transactional stock-in (with vendor + invoice details)
  - `POST /api/inventory/:id/stock-out` — with insufficient-stock guard (no negative stock)
  - `POST /api/inventory/:id/adjust` — absolute target (delta computed)
  - `GET /api/inventory/:id/history` — append-only ledger with vendor names hydrated
  - `GET/POST /api/inventory/consumption-rules` — map tests to consumed items
  - `PUT/DELETE /api/inventory/consumption-rules/by-test/:testId` — atomic replace or clear
- **UI**: Items tab (summary cards: total value, low stock, out of stock), Low Stock tab, Consumption Rules tab. Each item has Movement dialog (3 modes: in/out/adjust) + History dialog showing full ledger.
- **Low-stock alerts**: Computed on every stock-out — if currentStock ≤ minStock, alert returned in API response.

### Bill Audit + Email Notifications (matches reference repo)
- **Every bill mutation now creates a `BillAudit` row** with changeType, oldValue, newValue, performedByName, reason:
  - `PUT /api/bills/:id/edit` — discount/status changes. Required: `reason` ≥3 chars. Advisory `discount_override_warning` if discount >50% of subtotal.
  - `POST /api/bills/:id/cancel` — changeType `cancelled` + `tests_cancelled_cascade` + `refund` (if autoRefund)
  - `POST /api/bills/:id/refund` — changeType `refund` with old/new paid+refunded amounts
  - `POST /api/bills/:id/reprint-log` — changeType `reprint` with monotonic `reprint #N` sequence
  - `GET /api/bills/:id/audits` — full audit trail
- **Auto-email on every mutation**: Admin → Email & SMTP → toggle `billEditEnabled`. Email fires asynchronously (non-blocking) via nodemailer. Includes HTML table with before/after values, reason, actor, timestamp. Logs every send to `EmailLog` table (status queued/sent/failed, errorMessage, messageId).
- **Email templates**: `bill_edit` (subject `[Bill Edit] <billNumber> — <patientName>`), `bill_reprint` (subject `[Bill Re-print] ...`), `daily_summary`, `test`.

### Public Online Booking Webpage with ICICI Orange Pay
- **URL**: `https://your-domain/booking` (public, no login required)
- **3-step booking flow**:
  1. Select package or individual tests (shows price + fasting warnings)
  2. Patient details + appointment date + time slot (morning/afternoon/evening)
  3. Review → Pay (redirects to ICICI Orange Pay)
- **ICICI Orange Pay integration** (verbatim field names from reference repo — DO NOT modify):
  - `POST /api/public/booking/initiate` — creates `OnlineBooking` record, calls ICICI `initiateSale`, returns `redirectUrl`
  - `GET /api/public/booking/icici-callback` — browser return URL (renders success/failure page)
  - `POST /api/gateway/icici-webhook` — server-to-server webhook with **MANDATORY** HMAC-SHA256 signature verification
  - `GET /api/public/booking/status/:bookingRef` — polling endpoint for booking status
- **Field-name casing preserved exactly** (ICICI spec-mandated):
  - `merchantId`, `aggregatorID`, `merchantTxnNo`, `customerEmailID`, `customerMobileNo`, `customerName`, `returnURL`, `addlParam1`, `addlParam2`, `txnDate`, `secureHash`
- **Hard-coded literals** (must be verbatim):
  - `currencyCode: "356"` (INR ISO-4217)
  - `payType: "0"`
  - `transactionType: "SALE"` / `"STATUS"` / `"REFUND"`
  - `addlParam2: "care-diagnostics"` (tenant tag)
  - Success codes: `R1000` (initiate), `SUC`/`0000`/`000` (status/webhook)
- **Secure hash algorithm**: HMAC-SHA256 over alphabetically-sorted parameter values concatenated with NO separator.
- **Payment Gateway Diagnostics**: Every initiate/callback/webhook attempt logged to `PaymentGatewayDiagnostic` table (append-only) with full request/response, masked secureHash, IP, user-agent, environment, duration — for compliance debugging.
- **If ICICI not configured**: Booking still created with `paymentRequired: false` — patient pays at centre. Useful for testing the flow without ICICI credentials.

### Email & SMTP Settings Page
- **Location**: Admin → Email & SMTP (super-admin only)
- Configure SMTP host/port/user/password/secure, from-name/address, admin email, extra recipients (JSON array)
- Toggles: `billEditEnabled` (email on bill mutations), `dailySummaryEnabled` (daily collection summary)
- "Send Test Email" button
- Email Logs tab — last 50 sends with status, error, message-id

### Online Bookings Admin Page
- **Location**: Admin → Online Bookings (super-admin only)
- Shows public booking URL (copy-to-clipboard)
- Shows ICICI env var configuration guide
- Shows webhook URL to register in ICICI merchant dashboard
- Lists recent online bookings (when populated)

## 🔌 New API Endpoints in V3

| Method | Path | Purpose |
|---|---|---|
| GET/POST | `/api/inventory` | List / create items |
| GET | `/api/inventory/low-stock` | Items below min stock |
| POST | `/api/inventory/:id/stock-in` | Atomic stock-in (with vendor + invoice) |
| POST | `/api/inventory/:id/stock-out` | Stock-out (insufficient guard) |
| POST | `/api/inventory/:id/adjust` | Absolute-target adjustment |
| GET | `/api/inventory/:id/history` | Append-only stock ledger |
| GET/POST | `/api/inventory/consumption-rules` | List / add consumption rules |
| PUT/DELETE | `/api/inventory/consumption-rules/by-test/:testId` | Atomic replace or clear |
| DELETE | `/api/inventory/consumption-rules/:id` | Single delete |
| PUT | `/api/bills/:id/edit` | Edit bill (audit + email) |
| POST | `/api/bills/:id/reprint-log` | Log reprint (audit + email) |
| GET | `/api/bills/:id/audits` | Full audit trail |
| POST | `/api/public/booking/initiate` | Create booking + ICICI initiateSale |
| GET | `/api/public/booking/icici-callback` | Browser return URL |
| POST | `/api/gateway/icici-webhook` | Server webhook (HMAC verified) |
| GET | `/api/public/booking/status/:bookingRef` | Booking status (polling) |
| GET | `/api/public/booking/packages` | Public package list |
| GET | `/api/public/booking/tests` | Public test list |
| GET | `/api/public/booking/slots` | Available time slots |
| GET/PUT | `/api/email-settings` | SMTP config |
| GET | `/api/email-logs` | Email send log |

## 🔒 ICICI Orange Pay Compliance Checklist

Before going live with online payments:

1. **Register your domain** in ICICI merchant dashboard:
   - `returnURL` whitelist: add `https://your-domain.com/api/public/booking/icici-callback`
   - Webhook URL: add `https://your-domain.com/api/gateway/icici-webhook`
2. **Set env vars** in your `env` file:
   ```
   ICICI_MERCHANT_ID=your-merchant-id
   ICICI_AGGREGATOR_ID=your-aggregator-id
   ICICI_SECRET_KEY=your-hmac-secret
   PUBLIC_BASE_URL=https://your-domain.com
   ```
3. **Test in UAT first**: Leave `ICICI_BASE_URL` unset — defaults to `https://pgpayuat.icicibank.com`. Test with ICICI-provided test cards.
4. **Verify webhook signature**: The webhook endpoint MANDATORY-verifies HMAC. If `ICICI_SECRET_KEY` is missing or signature mismatches, the webhook is rejected. Do NOT make verification conditional (was a forge-payment CVE in the reference repo).
5. **Switch to production**: Once UAT passes, set `NODE_ENV=production` (which auto-switches base URL to `https://pgpay.icicibank.com`).
6. **Monitor diagnostics**: Check Admin → Online Bookings → (diagnostics table) for any failed initiate/callback attempts. The `PaymentGatewayDiagnostic` table is append-only — safe to prune old rows.

## 📁 New Files in V3

```
prisma/schema.prisma                          # Added: InventoryTransaction (with stockBefore/After), InventoryConsumptionRule, EmailSettings, EmailLog, OnlineBooking, PaymentGatewayDiagnostic
src/lib/email.ts                              # Nodemailer transport + sendBillEditEmail + sendBillReprintEmail + sendDailySummaryEmail
src/lib/icici.ts                              # ICICI provider: initiateSale, checkStatus, refundPayment, verifyIciciWebhookSignature (HMAC-SHA256), isIciciWebhookSuccess
src/app/api/inventory/route.ts                # List + create items
src/app/api/inventory/low-stock/route.ts
src/app/api/inventory/[id]/{stock-in,stock-out,adjust,history}/route.ts
src/app/api/inventory/consumption-rules/route.ts
src/app/api/inventory/consumption-rules/[id]/route.ts
src/app/api/inventory/consumption-rules/by-test/[testId]/route.ts
src/app/api/bills/[id]/{edit,reprint-log,audits}/route.ts
src/app/api/public/booking/{initiate,icici-callback}/route.ts
src/app/api/public/booking/status/[bookingRef]/route.ts
src/app/api/public/booking/{packages,tests,slots}/route.ts
src/app/api/gateway/icici-webhook/route.ts    # S2S webhook (HMAC mandatory)
src/app/api/email-settings/route.ts
src/app/api/email-logs/route.ts
src/app/(public)/booking/{page,layout,booking-app}.tsx  # Public booking webpage
src/components/pages/inventory.tsx            # Inventory UI (items, low-stock, consumption rules, movement dialog, history dialog)
src/components/pages/admin-pages.tsx          # EmailSettingsPage + OnlineBookingsPage
```
