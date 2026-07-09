-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "Clinic" (
    "id" TEXT NOT NULL,
    "singleton" TEXT NOT NULL DEFAULT 'clinic',
    "name" TEXT NOT NULL,
    "address" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "gstin" TEXT,
    "registrationNo" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "walkInLedgerId" TEXT,
    "commissionDiscountMode" TEXT NOT NULL DEFAULT 'none',
    "vipPercentage" DOUBLE PRECISION NOT NULL DEFAULT 50.0,
    "sessionIdleTimeoutMinutes" INTEGER NOT NULL DEFAULT 30,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Clinic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "username" TEXT,
    "role" TEXT NOT NULL DEFAULT 'receptionist',
    "permissions" TEXT NOT NULL DEFAULT '[]',
    "pinHash" TEXT NOT NULL,
    "photoDataUrl" TEXT,
    "sidebarTheme" TEXT,
    "defaultStartPage" TEXT,
    "mustChangePin" BOOLEAN NOT NULL DEFAULT false,
    "remoteLoginEnabled" BOOLEAN NOT NULL DEFAULT false,
    "maxConcurrentSessions" INTEGER NOT NULL DEFAULT 0,
    "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "maxDiscount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SuperAdminSession" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SuperAdminSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RolePermission" (
    "id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "canView" BOOLEAN NOT NULL DEFAULT false,
    "canCreate" BOOLEAN NOT NULL DEFAULT false,
    "canEdit" BOOLEAN NOT NULL DEFAULT false,
    "canDelete" BOOLEAN NOT NULL DEFAULT false,
    "canPrint" BOOLEAN NOT NULL DEFAULT false,
    "canReprint" BOOLEAN NOT NULL DEFAULT false,
    "canRefund" BOOLEAN NOT NULL DEFAULT false,
    "canExport" BOOLEAN NOT NULL DEFAULT false,
    "canApprove" BOOLEAN NOT NULL DEFAULT false,
    "canFinalize" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "userName" TEXT,
    "action" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "entityId" TEXT,
    "details" TEXT,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Patient" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "age" INTEGER,
    "gender" TEXT,
    "address" TEXT,
    "ledgerId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Patient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Doctor" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "specialization" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "hospitalAffiliation" TEXT,
    "address" TEXT,
    "area" TEXT,
    "registrationNumber" TEXT,
    "defaultCommissionType" TEXT NOT NULL DEFAULT 'percentage',
    "defaultCommission" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ledgerId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Doctor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TestCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TestCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Test" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "categoryId" TEXT,
    "price" DOUBLE PRECISION NOT NULL,
    "cost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "unit" TEXT,
    "referenceRange" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Test_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "doctorId" TEXT,
    "ledgerId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "totalAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "notes" TEXT,
    "isVip" BOOLEAN NOT NULL DEFAULT false,
    "createdByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderTest" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "testId" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "cancelledByName" TEXT,
    "cancellationReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderTest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bill" (
    "id" TEXT NOT NULL,
    "billNumber" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "subtotal" DOUBLE PRECISION NOT NULL,
    "discount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "discountReason" TEXT,
    "discountReasonNote" TEXT,
    "taxAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "paidAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "balanceAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "refundAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "ledgerId" TEXT,
    "dueDate" TEXT,
    "createdById" TEXT NOT NULL,
    "createdByName" TEXT NOT NULL,
    "cancelledAt" TIMESTAMP(3),
    "cancelledByName" TEXT,
    "cancellationReason" TEXT,
    "clientRef" TEXT,
    "originalTotal" DOUBLE PRECISION,
    "qrScanCount" INTEGER NOT NULL DEFAULT 0,
    "receiptVerificationCount" INTEGER NOT NULL DEFAULT 0,
    "pdfDownloadCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Bill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "billId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "method" TEXT NOT NULL,
    "referenceNumber" TEXT,
    "notes" TEXT,
    "recordedById" TEXT NOT NULL,
    "recordedByName" TEXT NOT NULL,
    "voucherId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillAudit" (
    "id" TEXT NOT NULL,
    "billId" TEXT NOT NULL,
    "changeType" TEXT NOT NULL,
    "oldValue" TEXT,
    "newValue" TEXT,
    "performedByName" TEXT,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BillAudit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiscountReason" (
    "id" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DiscountReason_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "code" TEXT,
    "bankName" TEXT,
    "accountNumber" TEXT,
    "ifscCode" TEXT,
    "branch" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "tallyGroup" TEXT,
    "openingBalance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "openingBalanceType" TEXT NOT NULL DEFAULT 'Dr',
    "gstApplicable" BOOLEAN NOT NULL DEFAULT false,
    "gstNumber" TEXT,
    "pan" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Voucher" (
    "id" TEXT NOT NULL,
    "voucherNumber" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "creditAccountId" TEXT NOT NULL,
    "debitAccountId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "particular" TEXT,
    "remark" TEXT,
    "performedBy" TEXT,
    "reference" TEXT,
    "narration" TEXT,
    "billId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Voucher_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VoucherAudit" (
    "id" TEXT NOT NULL,
    "voucherId" TEXT NOT NULL,
    "changeType" TEXT NOT NULL,
    "oldValue" TEXT,
    "newValue" TEXT,
    "editedBy" TEXT,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VoucherAudit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Expense" (
    "id" TEXT NOT NULL,
    "expenseId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "expenseDate" TEXT NOT NULL,
    "paymentMode" TEXT NOT NULL DEFAULT 'cash',
    "paidTo" TEXT,
    "voucherId" TEXT,
    "approvedById" TEXT,
    "approvedByName" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpenseCounter" (
    "id" SERIAL NOT NULL,
    "yearMonth" TEXT NOT NULL,
    "counter" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ExpenseCounter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Supplier" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'creditor',
    "phone" TEXT,
    "email" TEXT,
    "contactPerson" TEXT,
    "gstin" TEXT,
    "pan" TEXT,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "pincode" TEXT,
    "bankAccount" TEXT,
    "ifsc" TEXT,
    "branch" TEXT,
    "ledgerAccountId" TEXT,
    "openingBalance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "openingBalanceType" TEXT NOT NULL DEFAULT 'Cr',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpenseBill" (
    "id" TEXT NOT NULL,
    "billId" TEXT NOT NULL,
    "supplierId" TEXT,
    "supplierName" TEXT NOT NULL,
    "supplierGSTIN" TEXT,
    "billNumber" TEXT,
    "billDate" TEXT,
    "dueDate" TEXT,
    "category" TEXT,
    "description" TEXT,
    "subtotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "taxAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lineItems" TEXT,
    "ocrRawResponse" TEXT,
    "ocrConfidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "expenseId" TEXT,
    "voucherId" TEXT,
    "filePath" TEXT,
    "fileType" TEXT,
    "fileName" TEXT,
    "uploadedById" TEXT,
    "uploadedByName" TEXT,
    "confirmedById" TEXT,
    "confirmedByName" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExpenseBill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpenseBillCounter" (
    "id" SERIAL NOT NULL,
    "yearMonth" TEXT NOT NULL,
    "counter" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ExpenseBillCounter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormFRecord" (
    "id" TEXT NOT NULL,
    "formFId" TEXT NOT NULL,
    "billId" TEXT,
    "billNumber" TEXT,
    "patientId" TEXT,
    "patientName" TEXT,
    "age" INTEGER,
    "childrenDetails" TEXT,
    "husbandFatherName" TEXT,
    "address" TEXT,
    "mobile" TEXT,
    "referredBy" TEXT NOT NULL DEFAULT 'Self',
    "lmpWeeks" TEXT,
    "geneticHistory" TEXT,
    "basisDiagnosis" TEXT,
    "previousChildIssue" TEXT,
    "indicationOther" TEXT,
    "doctorName" TEXT,
    "procedure" TEXT,
    "procedurePurpose" TEXT,
    "invasiveProcedure" TEXT,
    "complication" TEXT,
    "labTests" TEXT,
    "prenatalResult" TEXT,
    "gestationalAgeWeeks" INTEGER,
    "gestationalAgeDays" INTEGER,
    "ultrasoundResult" TEXT,
    "abnormality" TEXT,
    "procedureDate" TEXT,
    "consentDate" TEXT,
    "resultConveyed" TEXT,
    "mtpAdvised" TEXT,
    "mtpDate" TEXT,
    "date" TEXT,
    "place" TEXT,
    "idCardImageUrl" TEXT,
    "idCardFrontUrl" TEXT,
    "idCardBackUrl" TEXT,
    "idCardExtractedName" TEXT,
    "idCardExtractedAddress" TEXT,
    "idCardVerified" BOOLEAN NOT NULL DEFAULT false,
    "ocrRawResponse" TEXT,
    "ocrConfidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdById" TEXT,
    "createdByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FormFRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormFCounter" (
    "id" SERIAL NOT NULL,
    "year" TEXT NOT NULL,
    "counter" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "FormFCounter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankAccount" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'mock',
    "bankName" TEXT NOT NULL,
    "maskedAccountNumber" TEXT,
    "ifsc" TEXT,
    "branch" TEXT,
    "environment" TEXT NOT NULL DEFAULT 'production',
    "status" TEXT NOT NULL DEFAULT 'active',
    "credentialKey" TEXT,
    "ledgerAccountId" TEXT,
    "providerConfig" TEXT,
    "currentBalance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BankAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankTransaction" (
    "id" TEXT NOT NULL,
    "bankAccountId" TEXT NOT NULL,
    "provider" TEXT,
    "externalTransactionId" TEXT,
    "transactionDate" TIMESTAMP(3) NOT NULL,
    "description" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "type" TEXT NOT NULL,
    "balanceAfter" DOUBLE PRECISION,
    "utr" TEXT,
    "referenceNumber" TEXT,
    "rawPayload" TEXT,
    "reconciliationStatus" TEXT NOT NULL DEFAULT 'unreconciled',
    "voucherId" TEXT,
    "paymentId" TEXT,
    "billId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BankTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentRequest" (
    "id" TEXT NOT NULL,
    "bankAccountId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "beneficiaryName" TEXT NOT NULL,
    "beneficiaryAccount" TEXT,
    "beneficiaryIfsc" TEXT,
    "purpose" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "externalRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReconciliationLog" (
    "id" TEXT NOT NULL,
    "bankTransactionId" TEXT NOT NULL,
    "billId" TEXT,
    "paymentId" TEXT,
    "voucherId" TEXT,
    "confidenceScore" INTEGER NOT NULL DEFAULT 0,
    "matchStrategy" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "autoClosed" BOOLEAN NOT NULL DEFAULT false,
    "autoClosedAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "resolvedById" TEXT,
    "resolvedByName" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "matchMetadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReconciliationLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookLog" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "eventType" TEXT,
    "payload" TEXT,
    "rawBody" TEXT,
    "signatureValid" BOOLEAN NOT NULL DEFAULT false,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "processingError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankAuditLog" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "provider" TEXT,
    "bankAccountId" TEXT,
    "externalId" TEXT,
    "amount" DOUBLE PRECISION,
    "status" TEXT NOT NULL,
    "details" TEXT,
    "performedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BankAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FraudAlert" (
    "id" TEXT NOT NULL,
    "alertType" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'medium',
    "status" TEXT NOT NULL DEFAULT 'open',
    "billId" TEXT,
    "paymentId" TEXT,
    "bankTransactionId" TEXT,
    "userId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "affectedAmount" DOUBLE PRECISION,
    "evidence" TEXT,
    "resolutionAction" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FraudAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefundRequest" (
    "id" TEXT NOT NULL,
    "billId" TEXT,
    "paymentId" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "reason" TEXT,
    "requestedById" TEXT,
    "requestedByName" TEXT,
    "status" TEXT NOT NULL DEFAULT 'requested',
    "approvedById" TEXT,
    "approvedByName" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectedById" TEXT,
    "rejectedByName" TEXT,
    "rejectedAt" TIMESTAMP(3),
    "gatewayRefundId" TEXT,
    "gatewayRefundStatus" TEXT,
    "completedAt" TIMESTAMP(3),
    "completedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RefundRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShiftClosure" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userName" TEXT NOT NULL,
    "shiftLabel" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "expectedCash" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "expectedUpi" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "expectedCard" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "expectedCheque" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "expectedOther" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "actualCash" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "actualUpi" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "actualCard" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "actualCheque" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "actualOther" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "variance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "denominations" TEXT,
    "denominationTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "bankDepositAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "bankDepositRef" TEXT,
    "supervisorId" TEXT,
    "supervisorName" TEXT,
    "approvedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'open',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShiftClosure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommissionRule" (
    "id" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'percentage',
    "value" DOUBLE PRECISION NOT NULL,
    "scope" TEXT NOT NULL DEFAULT 'all',
    "categories" TEXT,
    "testIds" TEXT,
    "isExclusive" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommissionRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DoctorPayout" (
    "id" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "paymentDate" TEXT NOT NULL,
    "paymentMethod" TEXT NOT NULL DEFAULT 'cash',
    "reference" TEXT,
    "periodFrom" TEXT,
    "periodTo" TEXT,
    "notes" TEXT,
    "voucherId" TEXT,
    "performedById" TEXT NOT NULL,
    "performedByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DoctorPayout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DayClosure" (
    "id" TEXT NOT NULL,
    "closureDate" TEXT NOT NULL,
    "closedAt" TIMESTAMP(3) NOT NULL,
    "closedById" TEXT NOT NULL,
    "closedByName" TEXT,
    "coveredFromTs" TIMESTAMP(3) NOT NULL,
    "coveredToTs" TIMESTAMP(3) NOT NULL,
    "expectedCash" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "expectedUpi" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "expectedCard" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "expectedCheque" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "expectedOther" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "actualCash" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "actualUpi" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "actualCard" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "actualCheque" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "actualOther" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "variance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "varianceNote" TEXT,
    "billsCount" INTEGER NOT NULL DEFAULT 0,
    "paymentsCount" INTEGER NOT NULL DEFAULT 0,
    "totalExpected" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalActual" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalBilled" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalRefunds" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalExpenses" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalDue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "staffBreakdown" TEXT,
    "testSummary" TEXT,
    "expenseDetails" TEXT,
    "refundDetails" TEXT,
    "status" TEXT NOT NULL DEFAULT 'closed',
    "reopenedAt" TIMESTAMP(3),
    "reopenedById" TEXT,
    "reopenedByName" TEXT,
    "reopenReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DayClosure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserDayClosure" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userName" TEXT NOT NULL,
    "closureDate" TEXT NOT NULL,
    "closedAt" TIMESTAMP(3) NOT NULL,
    "coveredFromTs" TIMESTAMP(3) NOT NULL,
    "coveredToTs" TIMESTAMP(3) NOT NULL,
    "expectedCash" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "expectedUpi" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "expectedCard" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "expectedCheque" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "expectedOther" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "actualCash" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "actualUpi" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "actualCard" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "actualCheque" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "actualOther" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "variance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "varianceNote" TEXT,
    "denominations" TEXT,
    "denominationTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "drawerStatus" TEXT NOT NULL DEFAULT 'open',
    "approvedByName" TEXT,
    "approvedAt" TIMESTAMP(3),
    "approvalNote" TEXT,
    "reopenedByName" TEXT,
    "reopenedAt" TIMESTAMP(3),
    "reopenReason" TEXT,
    "notes" TEXT,
    "billsCount" INTEGER NOT NULL DEFAULT 0,
    "paymentsCount" INTEGER NOT NULL DEFAULT 0,
    "totalExpected" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalActual" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserDayClosure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DrawerAuditLog" (
    "id" TEXT NOT NULL,
    "userDayClosureId" TEXT,
    "userId" TEXT,
    "userName" TEXT,
    "action" TEXT NOT NULL,
    "details" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DrawerAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Staff" (
    "id" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "role" TEXT NOT NULL DEFAULT 'other',
    "department" TEXT,
    "joiningDate" TEXT,
    "baseSalary" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "address" TEXT,
    "emergencyContact" TEXT,
    "bankAccount" TEXT,
    "ifsc" TEXT,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Staff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffAdvance" (
    "id" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "advanceDate" TEXT NOT NULL,
    "paymentMode" TEXT NOT NULL DEFAULT 'cash',
    "reason" TEXT,
    "recoveredAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'outstanding',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffAdvance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffSalaryPayment" (
    "id" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "monthYear" TEXT NOT NULL,
    "baseAmount" DOUBLE PRECISION NOT NULL,
    "bonus" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "deductions" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "advanceDeducted" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "daysPresent" INTEGER,
    "daysAbsent" INTEGER,
    "netAmount" DOUBLE PRECISION NOT NULL,
    "paymentDate" TEXT NOT NULL,
    "paymentMode" TEXT NOT NULL DEFAULT 'cash',
    "reference" TEXT,
    "paidById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffSalaryPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffAttendance" (
    "id" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "attendanceDate" TEXT NOT NULL,
    "punchIn" TIMESTAMP(3),
    "punchOut" TIMESTAMP(3),
    "source" TEXT NOT NULL DEFAULT 'manual',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffAttendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffCounter" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "counter" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "StaffCounter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "testId" TEXT,
    "testName" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'general',
    "template" TEXT NOT NULL,
    "defaultValues" TEXT,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReportTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PatientReport" (
    "id" TEXT NOT NULL,
    "reportNumber" TEXT NOT NULL,
    "billId" TEXT,
    "billNumber" TEXT,
    "patientId" TEXT,
    "patientName" TEXT NOT NULL,
    "patientAge" INTEGER,
    "patientGender" TEXT,
    "patientPhone" TEXT,
    "doctorName" TEXT,
    "testId" TEXT,
    "testName" TEXT NOT NULL,
    "templateId" TEXT,
    "values" TEXT NOT NULL,
    "notes" TEXT,
    "impression" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "reportedById" TEXT,
    "reportedByName" TEXT,
    "approvedById" TEXT,
    "approvedByName" TEXT,
    "approvedAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "deliveryMethod" TEXT,
    "deliveryRef" TEXT,
    "pdfPath" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PatientReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PatientReportCounter" (
    "id" SERIAL NOT NULL,
    "yearMonth" TEXT NOT NULL,
    "counter" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PatientReportCounter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Package" (
    "id" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL DEFAULT 'general',
    "totalTests" INTEGER NOT NULL DEFAULT 0,
    "testIds" TEXT NOT NULL,
    "mrp" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sellingPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "durationHours" INTEGER NOT NULL DEFAULT 2,
    "fastingRequired" BOOLEAN NOT NULL DEFAULT false,
    "instructions" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Package_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PackageCounter" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "counter" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PackageCounter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryItem" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'unit',
    "category" TEXT NOT NULL DEFAULT 'consumable',
    "currentStock" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "minStock" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "costPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "preferredVendorId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastUpdatedById" TEXT,
    "lastUpdatedByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryTransaction" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "stockBefore" DOUBLE PRECISION NOT NULL,
    "stockAfter" DOUBLE PRECISION NOT NULL,
    "reason" TEXT,
    "reference" TEXT,
    "performedBy" TEXT,
    "vendorId" TEXT,
    "invoiceNumber" TEXT,
    "invoiceDate" TEXT,
    "unitCost" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryConsumptionRule" (
    "id" TEXT NOT NULL,
    "testId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryConsumptionRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryCounter" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "counter" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "InventoryCounter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailSettings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "smtpHost" TEXT NOT NULL DEFAULT '',
    "smtpPort" TEXT NOT NULL DEFAULT '587',
    "smtpUser" TEXT NOT NULL DEFAULT '',
    "smtpPassword" TEXT NOT NULL DEFAULT '',
    "smtpSecure" BOOLEAN NOT NULL DEFAULT false,
    "fromAddress" TEXT NOT NULL DEFAULT '',
    "fromName" TEXT NOT NULL DEFAULT 'Care Diagnostics ERP',
    "adminEmail" TEXT NOT NULL DEFAULT '',
    "extraRecipients" TEXT NOT NULL DEFAULT '[]',
    "billEditEnabled" BOOLEAN NOT NULL DEFAULT true,
    "dailySummaryEnabled" BOOLEAN NOT NULL DEFAULT true,
    "dailySummaryTime" TEXT NOT NULL DEFAULT '17:00',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailLog" (
    "id" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "templateName" TEXT NOT NULL,
    "billId" TEXT,
    "reportId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "errorMessage" TEXT,
    "messageId" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "sentById" TEXT,
    "sentByName" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OnlineBooking" (
    "id" TEXT NOT NULL,
    "bookingRef" TEXT NOT NULL,
    "patientName" TEXT NOT NULL,
    "patientPhone" TEXT NOT NULL,
    "patientEmail" TEXT,
    "patientAge" INTEGER,
    "patientGender" TEXT,
    "packageId" TEXT,
    "packageName" TEXT,
    "testIds" TEXT,
    "testNames" TEXT,
    "appointmentDate" TEXT NOT NULL,
    "timeSlot" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "paymentMethod" TEXT,
    "iciciTransactionId" TEXT,
    "iciciMerchantTxnNo" TEXT,
    "iciciResponseCode" TEXT,
    "iciciResponseMsg" TEXT,
    "paymentInitiatedAt" TIMESTAMP(3),
    "paymentCompletedAt" TIMESTAMP(3),
    "confirmedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "billId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OnlineBooking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentGatewayDiagnostic" (
    "id" TEXT NOT NULL,
    "gateway" TEXT NOT NULL DEFAULT 'icici',
    "stage" TEXT NOT NULL,
    "merchantTxnNo" TEXT,
    "bookingRef" TEXT,
    "success" BOOLEAN NOT NULL DEFAULT false,
    "httpStatus" INTEGER,
    "responseCode" TEXT,
    "responseMessage" TEXT,
    "requestUrl" TEXT,
    "requestPayload" TEXT,
    "responseBody" TEXT,
    "redirectUri" TEXT,
    "tranCtx" TEXT,
    "secureHashMasked" TEXT,
    "amount" DOUBLE PRECISION,
    "currency" TEXT,
    "merchantId" TEXT,
    "aggregatorId" TEXT,
    "returnUrl" TEXT,
    "callbackUrl" TEXT,
    "publicBaseUrl" TEXT,
    "clientIp" TEXT,
    "forwardedFor" TEXT,
    "userAgent" TEXT,
    "referer" TEXT,
    "origin" TEXT,
    "environment" TEXT,
    "durationMs" INTEGER,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentGatewayDiagnostic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Appointment" (
    "id" TEXT NOT NULL,
    "appointmentId" TEXT NOT NULL,
    "patientId" TEXT,
    "patientName" TEXT NOT NULL,
    "patientPhone" TEXT,
    "packageId" TEXT,
    "packageName" TEXT,
    "testIds" TEXT,
    "appointmentDate" TEXT NOT NULL,
    "timeSlot" TEXT NOT NULL,
    "durationMin" INTEGER NOT NULL DEFAULT 30,
    "status" TEXT NOT NULL DEFAULT 'booked',
    "notes" TEXT,
    "source" TEXT NOT NULL DEFAULT 'walk-in',
    "isFasting" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Appointment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppointmentCounter" (
    "id" SERIAL NOT NULL,
    "dateStr" TEXT NOT NULL,
    "counter" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "AppointmentCounter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "recipientPhone" TEXT,
    "recipientEmail" TEXT,
    "recipientName" TEXT,
    "templateName" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "externalId" TEXT,
    "errorMessage" TEXT,
    "billId" TEXT,
    "reportId" TEXT,
    "appointmentId" TEXT,
    "sentById" TEXT,
    "sentByName" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "scheduledAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Branch" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "address" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "gstin" TEXT,
    "isHeadOffice" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Branch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsAppSettings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "provider" TEXT NOT NULL DEFAULT 'gupshup',
    "apiKey" TEXT NOT NULL DEFAULT '',
    "apiSecret" TEXT NOT NULL DEFAULT '',
    "phoneNumber" TEXT NOT NULL DEFAULT '',
    "templateNamespace" TEXT NOT NULL DEFAULT '',
    "isEnabled" BOOLEAN NOT NULL DEFAULT false,
    "sendOnReportReady" BOOLEAN NOT NULL DEFAULT true,
    "sendOnBillCreated" BOOLEAN NOT NULL DEFAULT false,
    "sendOnAppointmentReminder" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsAppSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailySummaryLog" (
    "id" TEXT NOT NULL,
    "summaryDate" TEXT NOT NULL,
    "emailSent" BOOLEAN NOT NULL DEFAULT false,
    "emailLogId" TEXT,
    "whatsappSent" BOOLEAN NOT NULL DEFAULT false,
    "whatsappLogId" TEXT,
    "totalCollected" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalBilled" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalExpenses" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "billsCount" INTEGER NOT NULL DEFAULT 0,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailySummaryLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PatientOtp" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "purpose" TEXT NOT NULL DEFAULT 'login',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PatientOtp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PatientPortalSession" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "patientName" TEXT NOT NULL,
    "patientPhone" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PatientPortalSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sample" (
    "id" TEXT NOT NULL,
    "sampleId" TEXT NOT NULL,
    "billId" TEXT,
    "billNumber" TEXT,
    "orderId" TEXT,
    "orderTestId" TEXT,
    "patientId" TEXT,
    "patientName" TEXT NOT NULL,
    "patientPhone" TEXT,
    "testName" TEXT NOT NULL,
    "testCode" TEXT,
    "barcodeData" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "collectedAt" TIMESTAMP(3),
    "collectedByName" TEXT,
    "dispatchedAt" TIMESTAMP(3),
    "dispatchedByName" TEXT,
    "receivedAtLabAt" TIMESTAMP(3),
    "receivedByName" TEXT,
    "processingStartedAt" TIMESTAMP(3),
    "processingStartedByName" TEXT,
    "completedAt" TIMESTAMP(3),
    "discardedAt" TIMESTAMP(3),
    "discardReason" TEXT,
    "rejectedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "notes" TEXT,
    "containerType" TEXT,
    "priority" TEXT NOT NULL DEFAULT 'normal',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Sample_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SampleCounter" (
    "id" SERIAL NOT NULL,
    "dateStr" TEXT NOT NULL,
    "counter" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "SampleCounter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HomeCollectionRequest" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "patientName" TEXT NOT NULL,
    "patientPhone" TEXT NOT NULL,
    "patientEmail" TEXT,
    "patientAge" INTEGER,
    "patientGender" TEXT,
    "address" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT,
    "pincode" TEXT NOT NULL,
    "landmark" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "testIds" TEXT NOT NULL,
    "testNames" TEXT NOT NULL,
    "packageId" TEXT,
    "packageName" TEXT,
    "preferredDate" TEXT NOT NULL,
    "preferredSlot" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "paymentStatus" TEXT NOT NULL DEFAULT 'pending',
    "paymentMethod" TEXT,
    "status" TEXT NOT NULL DEFAULT 'requested',
    "assignedPhlebotomistId" TEXT,
    "assignedPhlebotomistName" TEXT,
    "assignedAt" TIMESTAMP(3),
    "phlebotomistEnRouteAt" TIMESTAMP(3),
    "phlebotomistCollectedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "phlebotomistNotes" TEXT,
    "billId" TEXT,
    "sampleIds" TEXT,
    "source" TEXT NOT NULL DEFAULT 'online',
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HomeCollectionRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HomeCollectionCounter" (
    "id" SERIAL NOT NULL,
    "dateStr" TEXT NOT NULL,
    "counter" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "HomeCollectionCounter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Corporate" (
    "id" TEXT NOT NULL,
    "corporateId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'corporate',
    "contactPerson" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "gstin" TEXT,
    "pan" TEXT,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "pincode" TEXT,
    "creditTermsDays" INTEGER NOT NULL DEFAULT 30,
    "creditLimit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "outstandingBalance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Corporate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CorporateRateCard" (
    "id" TEXT NOT NULL,
    "corporateId" TEXT NOT NULL,
    "testId" TEXT NOT NULL,
    "negotiatedPrice" DOUBLE PRECISION NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CorporateRateCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CorporatePatient" (
    "id" TEXT NOT NULL,
    "corporateId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "employeeId" TEXT,
    "relation" TEXT NOT NULL DEFAULT 'self',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CorporatePatient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CorporateInvoice" (
    "id" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "corporateId" TEXT NOT NULL,
    "corporateName" TEXT NOT NULL,
    "periodFrom" TEXT NOT NULL,
    "periodTo" TEXT NOT NULL,
    "totalAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "paidAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "billCount" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'raised',
    "dueDate" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidAt" TIMESTAMP(3),
    "notes" TEXT,
    "billIds" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CorporateInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CorporateInvoiceCounter" (
    "id" SERIAL NOT NULL,
    "yearMonth" TEXT NOT NULL,
    "counter" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CorporateInvoiceCounter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Equipment" (
    "id" TEXT NOT NULL,
    "equipmentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "model" TEXT,
    "manufacturer" TEXT,
    "serialNumber" TEXT,
    "category" TEXT NOT NULL DEFAULT 'general',
    "location" TEXT,
    "purchaseDate" TEXT,
    "purchaseCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "amcVendor" TEXT,
    "amcStartDate" TEXT,
    "amcEndDate" TEXT,
    "amcContractNo" TEXT,
    "lastServiceDate" TEXT,
    "nextServiceDate" TEXT,
    "calibrationDate" TEXT,
    "nextCalibrationDate" TEXT,
    "status" TEXT NOT NULL DEFAULT 'operational',
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Equipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EquipmentMaintenance" (
    "id" TEXT NOT NULL,
    "equipmentId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "serviceDate" TEXT NOT NULL,
    "performedBy" TEXT,
    "vendorName" TEXT,
    "description" TEXT NOT NULL,
    "cost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "partsReplaced" TEXT,
    "downtimeHours" INTEGER NOT NULL DEFAULT 0,
    "nextServiceDate" TEXT,
    "status" TEXT NOT NULL DEFAULT 'completed',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EquipmentMaintenance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoyaltyPoint" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "patientName" TEXT NOT NULL,
    "patientPhone" TEXT,
    "points" INTEGER NOT NULL DEFAULT 0,
    "totalEarned" INTEGER NOT NULL DEFAULT 0,
    "totalRedeemed" INTEGER NOT NULL DEFAULT 0,
    "tier" TEXT NOT NULL DEFAULT 'bronze',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoyaltyPoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoyaltyTransaction" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "reason" TEXT,
    "billId" TEXT,
    "billNumber" TEXT,
    "redemptionValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "performedById" TEXT,
    "performedByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoyaltyTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiscountApproval" (
    "id" TEXT NOT NULL,
    "billId" TEXT,
    "billNumber" TEXT,
    "patientName" TEXT,
    "requestedDiscount" DOUBLE PRECISION NOT NULL,
    "requestedDiscountPercent" DOUBLE PRECISION NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "requestedById" TEXT NOT NULL,
    "requestedByName" TEXT NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedById" TEXT,
    "reviewedByName" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiscountApproval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiKey" (
    "id" TEXT NOT NULL,
    "keyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "permissions" TEXT NOT NULL DEFAULT '[]',
    "rateLimitPerMin" INTEGER NOT NULL DEFAULT 60,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastUsedAt" TIMESTAMP(3),
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiAccessLog" (
    "id" TEXT NOT NULL,
    "apiKeyId" TEXT,
    "keyId" TEXT,
    "endpoint" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "statusCode" INTEGER NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "durationMs" INTEGER,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApiAccessLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NablChecklist" (
    "id" TEXT NOT NULL,
    "checklistId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "auditDate" TEXT NOT NULL,
    "auditorName" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "findings" TEXT,
    "totalFindings" INTEGER NOT NULL DEFAULT 0,
    "closedFindings" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NablChecklist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NablCorrectiveAction" (
    "id" TEXT NOT NULL,
    "checklistId" TEXT NOT NULL,
    "finding" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'minor',
    "rootCause" TEXT,
    "correctiveAction" TEXT,
    "preventiveAction" TEXT,
    "assignedTo" TEXT,
    "dueDate" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "verifiedBy" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NablCorrectiveAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Translation" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "enValue" TEXT NOT NULL,
    "hiValue" TEXT,
    "bnValue" TEXT,
    "taValue" TEXT,
    "teValue" TEXT,
    "mrValue" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Translation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Clinic_singleton_key" ON "Clinic"("singleton");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "Session_token_key" ON "Session"("token");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "SuperAdminSession_token_key" ON "SuperAdminSession"("token");

-- CreateIndex
CREATE INDEX "SuperAdminSession_userId_idx" ON "SuperAdminSession"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "RolePermission_role_module_key" ON "RolePermission"("role", "module");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_module_idx" ON "AuditLog"("module");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Patient_patientId_key" ON "Patient"("patientId");

-- CreateIndex
CREATE UNIQUE INDEX "TestCategory_name_key" ON "TestCategory"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Test_code_key" ON "Test"("code");

-- CreateIndex
CREATE INDEX "Test_categoryId_idx" ON "Test"("categoryId");

-- CreateIndex
CREATE INDEX "Test_isActive_idx" ON "Test"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Order_orderNumber_key" ON "Order"("orderNumber");

-- CreateIndex
CREATE INDEX "Order_patientId_idx" ON "Order"("patientId");

-- CreateIndex
CREATE INDEX "Order_doctorId_idx" ON "Order"("doctorId");

-- CreateIndex
CREATE INDEX "Order_status_idx" ON "Order"("status");

-- CreateIndex
CREATE INDEX "Order_createdAt_idx" ON "Order"("createdAt");

-- CreateIndex
CREATE INDEX "OrderTest_orderId_idx" ON "OrderTest"("orderId");

-- CreateIndex
CREATE INDEX "OrderTest_testId_idx" ON "OrderTest"("testId");

-- CreateIndex
CREATE UNIQUE INDEX "Bill_billNumber_key" ON "Bill"("billNumber");

-- CreateIndex
CREATE INDEX "Bill_orderId_idx" ON "Bill"("orderId");

-- CreateIndex
CREATE INDEX "Bill_patientId_idx" ON "Bill"("patientId");

-- CreateIndex
CREATE INDEX "Bill_status_idx" ON "Bill"("status");

-- CreateIndex
CREATE INDEX "Bill_createdAt_idx" ON "Bill"("createdAt");

-- CreateIndex
CREATE INDEX "Payment_billId_idx" ON "Payment"("billId");

-- CreateIndex
CREATE INDEX "Payment_method_idx" ON "Payment"("method");

-- CreateIndex
CREATE INDEX "Payment_createdAt_idx" ON "Payment"("createdAt");

-- CreateIndex
CREATE INDEX "BillAudit_billId_idx" ON "BillAudit"("billId");

-- CreateIndex
CREATE UNIQUE INDEX "DiscountReason_reason_key" ON "DiscountReason"("reason");

-- CreateIndex
CREATE UNIQUE INDEX "Account_name_key" ON "Account"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Account_code_key" ON "Account"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Voucher_voucherNumber_key" ON "Voucher"("voucherNumber");

-- CreateIndex
CREATE INDEX "Voucher_type_idx" ON "Voucher"("type");

-- CreateIndex
CREATE INDEX "Voucher_date_idx" ON "Voucher"("date");

-- CreateIndex
CREATE INDEX "Voucher_creditAccountId_idx" ON "Voucher"("creditAccountId");

-- CreateIndex
CREATE INDEX "Voucher_debitAccountId_idx" ON "Voucher"("debitAccountId");

-- CreateIndex
CREATE INDEX "VoucherAudit_voucherId_idx" ON "VoucherAudit"("voucherId");

-- CreateIndex
CREATE UNIQUE INDEX "Expense_expenseId_key" ON "Expense"("expenseId");

-- CreateIndex
CREATE INDEX "Expense_category_idx" ON "Expense"("category");

-- CreateIndex
CREATE INDEX "Expense_expenseDate_idx" ON "Expense"("expenseDate");

-- CreateIndex
CREATE UNIQUE INDEX "ExpenseCounter_yearMonth_key" ON "ExpenseCounter"("yearMonth");

-- CreateIndex
CREATE UNIQUE INDEX "Supplier_supplierId_key" ON "Supplier"("supplierId");

-- CreateIndex
CREATE INDEX "Supplier_name_idx" ON "Supplier"("name");

-- CreateIndex
CREATE INDEX "Supplier_gstin_idx" ON "Supplier"("gstin");

-- CreateIndex
CREATE UNIQUE INDEX "ExpenseBill_billId_key" ON "ExpenseBill"("billId");

-- CreateIndex
CREATE INDEX "ExpenseBill_supplierId_idx" ON "ExpenseBill"("supplierId");

-- CreateIndex
CREATE INDEX "ExpenseBill_status_idx" ON "ExpenseBill"("status");

-- CreateIndex
CREATE INDEX "ExpenseBill_billDate_idx" ON "ExpenseBill"("billDate");

-- CreateIndex
CREATE UNIQUE INDEX "ExpenseBillCounter_yearMonth_key" ON "ExpenseBillCounter"("yearMonth");

-- CreateIndex
CREATE UNIQUE INDEX "FormFRecord_formFId_key" ON "FormFRecord"("formFId");

-- CreateIndex
CREATE INDEX "FormFRecord_billId_idx" ON "FormFRecord"("billId");

-- CreateIndex
CREATE INDEX "FormFRecord_patientId_idx" ON "FormFRecord"("patientId");

-- CreateIndex
CREATE INDEX "FormFRecord_status_idx" ON "FormFRecord"("status");

-- CreateIndex
CREATE UNIQUE INDEX "FormFCounter_year_key" ON "FormFCounter"("year");

-- CreateIndex
CREATE INDEX "BankTransaction_bankAccountId_idx" ON "BankTransaction"("bankAccountId");

-- CreateIndex
CREATE INDEX "BankTransaction_reconciliationStatus_idx" ON "BankTransaction"("reconciliationStatus");

-- CreateIndex
CREATE INDEX "BankTransaction_transactionDate_idx" ON "BankTransaction"("transactionDate");

-- CreateIndex
CREATE UNIQUE INDEX "ReconciliationLog_bankTransactionId_key" ON "ReconciliationLog"("bankTransactionId");

-- CreateIndex
CREATE INDEX "CommissionRule_doctorId_idx" ON "CommissionRule"("doctorId");

-- CreateIndex
CREATE INDEX "DoctorPayout_doctorId_idx" ON "DoctorPayout"("doctorId");

-- CreateIndex
CREATE INDEX "DoctorPayout_paymentDate_idx" ON "DoctorPayout"("paymentDate");

-- CreateIndex
CREATE INDEX "DayClosure_closureDate_idx" ON "DayClosure"("closureDate");

-- CreateIndex
CREATE INDEX "DayClosure_status_idx" ON "DayClosure"("status");

-- CreateIndex
CREATE INDEX "UserDayClosure_userId_idx" ON "UserDayClosure"("userId");

-- CreateIndex
CREATE INDEX "UserDayClosure_closureDate_idx" ON "UserDayClosure"("closureDate");

-- CreateIndex
CREATE UNIQUE INDEX "Staff_staffId_key" ON "Staff"("staffId");

-- CreateIndex
CREATE INDEX "StaffAdvance_staffId_idx" ON "StaffAdvance"("staffId");

-- CreateIndex
CREATE INDEX "StaffSalaryPayment_staffId_idx" ON "StaffSalaryPayment"("staffId");

-- CreateIndex
CREATE INDEX "StaffSalaryPayment_monthYear_idx" ON "StaffSalaryPayment"("monthYear");

-- CreateIndex
CREATE INDEX "StaffAttendance_staffId_idx" ON "StaffAttendance"("staffId");

-- CreateIndex
CREATE INDEX "StaffAttendance_attendanceDate_idx" ON "StaffAttendance"("attendanceDate");

-- CreateIndex
CREATE UNIQUE INDEX "StaffAttendance_staffId_attendanceDate_key" ON "StaffAttendance"("staffId", "attendanceDate");

-- CreateIndex
CREATE UNIQUE INDEX "ReportTemplate_name_key" ON "ReportTemplate"("name");

-- CreateIndex
CREATE UNIQUE INDEX "PatientReport_reportNumber_key" ON "PatientReport"("reportNumber");

-- CreateIndex
CREATE INDEX "PatientReport_billId_idx" ON "PatientReport"("billId");

-- CreateIndex
CREATE INDEX "PatientReport_patientId_idx" ON "PatientReport"("patientId");

-- CreateIndex
CREATE INDEX "PatientReport_status_idx" ON "PatientReport"("status");

-- CreateIndex
CREATE UNIQUE INDEX "PatientReportCounter_yearMonth_key" ON "PatientReportCounter"("yearMonth");

-- CreateIndex
CREATE UNIQUE INDEX "Package_packageId_key" ON "Package"("packageId");

-- CreateIndex
CREATE INDEX "Package_category_idx" ON "Package"("category");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryItem_itemId_key" ON "InventoryItem"("itemId");

-- CreateIndex
CREATE INDEX "InventoryItem_name_idx" ON "InventoryItem"("name");

-- CreateIndex
CREATE INDEX "InventoryItem_category_idx" ON "InventoryItem"("category");

-- CreateIndex
CREATE INDEX "InventoryItem_preferredVendorId_idx" ON "InventoryItem"("preferredVendorId");

-- CreateIndex
CREATE INDEX "InventoryTransaction_itemId_idx" ON "InventoryTransaction"("itemId");

-- CreateIndex
CREATE INDEX "InventoryTransaction_createdAt_idx" ON "InventoryTransaction"("createdAt");

-- CreateIndex
CREATE INDEX "InventoryTransaction_vendorId_idx" ON "InventoryTransaction"("vendorId");

-- CreateIndex
CREATE INDEX "InventoryConsumptionRule_testId_idx" ON "InventoryConsumptionRule"("testId");

-- CreateIndex
CREATE INDEX "InventoryConsumptionRule_itemId_idx" ON "InventoryConsumptionRule"("itemId");

-- CreateIndex
CREATE INDEX "EmailLog_status_idx" ON "EmailLog"("status");

-- CreateIndex
CREATE INDEX "EmailLog_billId_idx" ON "EmailLog"("billId");

-- CreateIndex
CREATE INDEX "EmailLog_createdAt_idx" ON "EmailLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "OnlineBooking_bookingRef_key" ON "OnlineBooking"("bookingRef");

-- CreateIndex
CREATE INDEX "OnlineBooking_status_idx" ON "OnlineBooking"("status");

-- CreateIndex
CREATE INDEX "OnlineBooking_patientPhone_idx" ON "OnlineBooking"("patientPhone");

-- CreateIndex
CREATE INDEX "OnlineBooking_appointmentDate_idx" ON "OnlineBooking"("appointmentDate");

-- CreateIndex
CREATE INDEX "OnlineBooking_iciciMerchantTxnNo_idx" ON "OnlineBooking"("iciciMerchantTxnNo");

-- CreateIndex
CREATE INDEX "PaymentGatewayDiagnostic_gateway_idx" ON "PaymentGatewayDiagnostic"("gateway");

-- CreateIndex
CREATE INDEX "PaymentGatewayDiagnostic_stage_idx" ON "PaymentGatewayDiagnostic"("stage");

-- CreateIndex
CREATE INDEX "PaymentGatewayDiagnostic_success_idx" ON "PaymentGatewayDiagnostic"("success");

-- CreateIndex
CREATE INDEX "PaymentGatewayDiagnostic_merchantTxnNo_idx" ON "PaymentGatewayDiagnostic"("merchantTxnNo");

-- CreateIndex
CREATE INDEX "PaymentGatewayDiagnostic_createdAt_idx" ON "PaymentGatewayDiagnostic"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Appointment_appointmentId_key" ON "Appointment"("appointmentId");

-- CreateIndex
CREATE INDEX "Appointment_appointmentDate_idx" ON "Appointment"("appointmentDate");

-- CreateIndex
CREATE INDEX "Appointment_status_idx" ON "Appointment"("status");

-- CreateIndex
CREATE INDEX "Appointment_patientPhone_idx" ON "Appointment"("patientPhone");

-- CreateIndex
CREATE UNIQUE INDEX "AppointmentCounter_dateStr_key" ON "AppointmentCounter"("dateStr");

-- CreateIndex
CREATE INDEX "Notification_channel_idx" ON "Notification"("channel");

-- CreateIndex
CREATE INDEX "Notification_status_idx" ON "Notification"("status");

-- CreateIndex
CREATE INDEX "Notification_createdAt_idx" ON "Notification"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Branch_branchId_key" ON "Branch"("branchId");

-- CreateIndex
CREATE UNIQUE INDEX "Branch_code_key" ON "Branch"("code");

-- CreateIndex
CREATE UNIQUE INDEX "DailySummaryLog_summaryDate_key" ON "DailySummaryLog"("summaryDate");

-- CreateIndex
CREATE INDEX "PatientOtp_phone_idx" ON "PatientOtp"("phone");

-- CreateIndex
CREATE INDEX "PatientOtp_code_idx" ON "PatientOtp"("code");

-- CreateIndex
CREATE UNIQUE INDEX "PatientPortalSession_token_key" ON "PatientPortalSession"("token");

-- CreateIndex
CREATE INDEX "PatientPortalSession_patientId_idx" ON "PatientPortalSession"("patientId");

-- CreateIndex
CREATE INDEX "PatientPortalSession_token_idx" ON "PatientPortalSession"("token");

-- CreateIndex
CREATE UNIQUE INDEX "Sample_sampleId_key" ON "Sample"("sampleId");

-- CreateIndex
CREATE INDEX "Sample_billId_idx" ON "Sample"("billId");

-- CreateIndex
CREATE INDEX "Sample_patientId_idx" ON "Sample"("patientId");

-- CreateIndex
CREATE INDEX "Sample_status_idx" ON "Sample"("status");

-- CreateIndex
CREATE INDEX "Sample_sampleId_idx" ON "Sample"("sampleId");

-- CreateIndex
CREATE UNIQUE INDEX "SampleCounter_dateStr_key" ON "SampleCounter"("dateStr");

-- CreateIndex
CREATE UNIQUE INDEX "HomeCollectionRequest_requestId_key" ON "HomeCollectionRequest"("requestId");

-- CreateIndex
CREATE INDEX "HomeCollectionRequest_status_idx" ON "HomeCollectionRequest"("status");

-- CreateIndex
CREATE INDEX "HomeCollectionRequest_patientPhone_idx" ON "HomeCollectionRequest"("patientPhone");

-- CreateIndex
CREATE INDEX "HomeCollectionRequest_preferredDate_idx" ON "HomeCollectionRequest"("preferredDate");

-- CreateIndex
CREATE INDEX "HomeCollectionRequest_assignedPhlebotomistId_idx" ON "HomeCollectionRequest"("assignedPhlebotomistId");

-- CreateIndex
CREATE UNIQUE INDEX "HomeCollectionCounter_dateStr_key" ON "HomeCollectionCounter"("dateStr");

-- CreateIndex
CREATE UNIQUE INDEX "Corporate_corporateId_key" ON "Corporate"("corporateId");

-- CreateIndex
CREATE INDEX "Corporate_name_idx" ON "Corporate"("name");

-- CreateIndex
CREATE INDEX "Corporate_type_idx" ON "Corporate"("type");

-- CreateIndex
CREATE INDEX "CorporateRateCard_corporateId_idx" ON "CorporateRateCard"("corporateId");

-- CreateIndex
CREATE UNIQUE INDEX "CorporateRateCard_corporateId_testId_key" ON "CorporateRateCard"("corporateId", "testId");

-- CreateIndex
CREATE INDEX "CorporatePatient_corporateId_idx" ON "CorporatePatient"("corporateId");

-- CreateIndex
CREATE UNIQUE INDEX "CorporatePatient_corporateId_patientId_key" ON "CorporatePatient"("corporateId", "patientId");

-- CreateIndex
CREATE UNIQUE INDEX "CorporateInvoice_invoiceNumber_key" ON "CorporateInvoice"("invoiceNumber");

-- CreateIndex
CREATE INDEX "CorporateInvoice_corporateId_idx" ON "CorporateInvoice"("corporateId");

-- CreateIndex
CREATE INDEX "CorporateInvoice_status_idx" ON "CorporateInvoice"("status");

-- CreateIndex
CREATE UNIQUE INDEX "CorporateInvoiceCounter_yearMonth_key" ON "CorporateInvoiceCounter"("yearMonth");

-- CreateIndex
CREATE UNIQUE INDEX "Equipment_equipmentId_key" ON "Equipment"("equipmentId");

-- CreateIndex
CREATE INDEX "Equipment_name_idx" ON "Equipment"("name");

-- CreateIndex
CREATE INDEX "Equipment_status_idx" ON "Equipment"("status");

-- CreateIndex
CREATE INDEX "EquipmentMaintenance_equipmentId_idx" ON "EquipmentMaintenance"("equipmentId");

-- CreateIndex
CREATE INDEX "EquipmentMaintenance_serviceDate_idx" ON "EquipmentMaintenance"("serviceDate");

-- CreateIndex
CREATE INDEX "LoyaltyPoint_patientId_idx" ON "LoyaltyPoint"("patientId");

-- CreateIndex
CREATE INDEX "LoyaltyPoint_tier_idx" ON "LoyaltyPoint"("tier");

-- CreateIndex
CREATE UNIQUE INDEX "LoyaltyPoint_patientId_key" ON "LoyaltyPoint"("patientId");

-- CreateIndex
CREATE INDEX "LoyaltyTransaction_patientId_idx" ON "LoyaltyTransaction"("patientId");

-- CreateIndex
CREATE INDEX "LoyaltyTransaction_createdAt_idx" ON "LoyaltyTransaction"("createdAt");

-- CreateIndex
CREATE INDEX "DiscountApproval_status_idx" ON "DiscountApproval"("status");

-- CreateIndex
CREATE INDEX "DiscountApproval_billId_idx" ON "DiscountApproval"("billId");

-- CreateIndex
CREATE UNIQUE INDEX "ApiKey_keyId_key" ON "ApiKey"("keyId");

-- CreateIndex
CREATE UNIQUE INDEX "ApiKey_key_key" ON "ApiKey"("key");

-- CreateIndex
CREATE INDEX "ApiKey_keyId_idx" ON "ApiKey"("keyId");

-- CreateIndex
CREATE INDEX "ApiAccessLog_apiKeyId_idx" ON "ApiAccessLog"("apiKeyId");

-- CreateIndex
CREATE INDEX "ApiAccessLog_createdAt_idx" ON "ApiAccessLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "NablChecklist_checklistId_key" ON "NablChecklist"("checklistId");

-- CreateIndex
CREATE INDEX "NablChecklist_status_idx" ON "NablChecklist"("status");

-- CreateIndex
CREATE INDEX "NablChecklist_category_idx" ON "NablChecklist"("category");

-- CreateIndex
CREATE INDEX "NablCorrectiveAction_checklistId_idx" ON "NablCorrectiveAction"("checklistId");

-- CreateIndex
CREATE INDEX "NablCorrectiveAction_status_idx" ON "NablCorrectiveAction"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Translation_key_key" ON "Translation"("key");

-- CreateIndex
CREATE INDEX "Translation_key_idx" ON "Translation"("key");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SuperAdminSession" ADD CONSTRAINT "SuperAdminSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Test" ADD CONSTRAINT "Test_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "TestCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "Doctor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderTest" ADD CONSTRAINT "OrderTest_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderTest" ADD CONSTRAINT "OrderTest_testId_fkey" FOREIGN KEY ("testId") REFERENCES "Test"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bill" ADD CONSTRAINT "Bill_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bill" ADD CONSTRAINT "Bill_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bill" ADD CONSTRAINT "Bill_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_billId_fkey" FOREIGN KEY ("billId") REFERENCES "Bill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillAudit" ADD CONSTRAINT "BillAudit_billId_fkey" FOREIGN KEY ("billId") REFERENCES "Bill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Voucher" ADD CONSTRAINT "Voucher_creditAccountId_fkey" FOREIGN KEY ("creditAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Voucher" ADD CONSTRAINT "Voucher_debitAccountId_fkey" FOREIGN KEY ("debitAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Voucher" ADD CONSTRAINT "Voucher_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoucherAudit" ADD CONSTRAINT "VoucherAudit_voucherId_fkey" FOREIGN KEY ("voucherId") REFERENCES "Voucher"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseBill" ADD CONSTRAINT "ExpenseBill_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseBill" ADD CONSTRAINT "ExpenseBill_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormFRecord" ADD CONSTRAINT "FormFRecord_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankTransaction" ADD CONSTRAINT "BankTransaction_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "BankAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentRequest" ADD CONSTRAINT "PaymentRequest_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "BankAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReconciliationLog" ADD CONSTRAINT "ReconciliationLog_bankTransactionId_fkey" FOREIGN KEY ("bankTransactionId") REFERENCES "BankTransaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionRule" ADD CONSTRAINT "CommissionRule_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "Doctor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DoctorPayout" ADD CONSTRAINT "DoctorPayout_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "Doctor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DoctorPayout" ADD CONSTRAINT "DoctorPayout_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DayClosure" ADD CONSTRAINT "DayClosure_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserDayClosure" ADD CONSTRAINT "UserDayClosure_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffAdvance" ADD CONSTRAINT "StaffAdvance_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffSalaryPayment" ADD CONSTRAINT "StaffSalaryPayment_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffSalaryPayment" ADD CONSTRAINT "StaffSalaryPayment_paidById_fkey" FOREIGN KEY ("paidById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffAttendance" ADD CONSTRAINT "StaffAttendance_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryTransaction" ADD CONSTRAINT "InventoryTransaction_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "InventoryItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryConsumptionRule" ADD CONSTRAINT "InventoryConsumptionRule_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "InventoryItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CorporateRateCard" ADD CONSTRAINT "CorporateRateCard_corporateId_fkey" FOREIGN KEY ("corporateId") REFERENCES "Corporate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CorporateRateCard" ADD CONSTRAINT "CorporateRateCard_testId_fkey" FOREIGN KEY ("testId") REFERENCES "Test"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CorporatePatient" ADD CONSTRAINT "CorporatePatient_corporateId_fkey" FOREIGN KEY ("corporateId") REFERENCES "Corporate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CorporatePatient" ADD CONSTRAINT "CorporatePatient_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CorporateInvoice" ADD CONSTRAINT "CorporateInvoice_corporateId_fkey" FOREIGN KEY ("corporateId") REFERENCES "Corporate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquipmentMaintenance" ADD CONSTRAINT "EquipmentMaintenance_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NablCorrectiveAction" ADD CONSTRAINT "NablCorrectiveAction_checklistId_fkey" FOREIGN KEY ("checklistId") REFERENCES "NablChecklist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

