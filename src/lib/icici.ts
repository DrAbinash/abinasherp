import crypto from 'crypto'

// ============================================================
// ICICI ORANGE PAY PROVIDER — verbatim field names from reference repo
// Reference: artifacts/api-server/src/lib/payments/IciciPaymentProvider.ts
// ============================================================
//
// CRITICAL COMPLIANCE NOTES (DO NOT CHANGE):
// 1. Field-name casing is INCONSISTENT by design — matches ICICI spec:
//    merchantId (camel), aggregatorID (caps ID), merchantTxnNo (camel),
//    customerEmailID (caps ID), customerMobileNo (camel), customerName (camel),
//    returnURL (caps URL), addlParam1/2 (camel), txnDate (camel), secureHash (camel)
// 2. currencyCode "356" = INR ISO-4217 numeric
// 3. payType "0" = fixed
// 4. transactionType "SALE" | "STATUS" | "REFUND"
// 5. addlParam2 "care-diagnostics" = clinic tenant tag (must be verbatim)
// 6. success code = "R1000" for initiateSale; "SUC"/"0000"/"000" for status
// 7. Webhook signature is MANDATORY (never make it conditional — was a CVE)
// 8. returnURL host MUST be whitelisted in ICICI merchant dashboard
//

const ICICI_UAT_BASE = 'https://pgpayuat.icicibank.com'
const ICICI_PROD_BASE = 'https://pgpay.icicibank.com'

export function getIciciBaseUrl(env: string, override?: string): string {
  if (override) {
    return normalizeIciciBaseUrl(override)
  }
  return env === 'production' ? ICICI_PROD_BASE : ICICI_UAT_BASE
}

function normalizeIciciBaseUrl(url: string): string {
  let u = url.trim().replace(/\/$/, '')
  // Strip trailing /pg/api/v2 or /pg/api (case-insensitive)
  u = u.replace(/\/pg\/api\/v2$/i, '').replace(/\/pg\/api$/i, '')
  return u
}

// ICICI credentials — env-first, DB-fallback (matches reference repo)
export async function getIciciCredentials(): Promise<{
  merchantId: string
  aggregatorId: string
  secretKey: string
  baseUrl: string
  publicBaseUrl: string
  environment: string
} | null> {
  const merchantId = process.env.ICICI_MERCHANT_ID || ''
  const aggregatorId = process.env.ICICI_AGGREGATOR_ID || ''
  const secretKey = process.env.ICICI_SECRET_KEY || ''

  if (!merchantId || !aggregatorId || !secretKey) return null

  const environment = process.env.NODE_ENV === 'production' ? 'production' : 'sandbox'
  const baseUrl = getIciciBaseUrl(environment, process.env.ICICI_BASE_URL)
  const publicBaseUrl = (process.env.PUBLIC_BASE_URL || process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '')

  return { merchantId, aggregatorId, secretKey, baseUrl, publicBaseUrl, environment }
}

// ============================================================
// SECURE HASH — HMAC-SHA256 over sorted values concatenated with NO separator
// Hash-input parameter set (sorted alphabetically):
//   addlParam1, addlParam2, aggregatorID, amount, currencyCode,
//   customerEmailID, customerMobileNo, customerName, merchantId,
//   merchantTxnNo, payType, returnURL, transactionType, txnDate
// ============================================================
export function computeIciciSecureHash(
  params: Record<string, string>,
  secretKey: string
): string {
  const sortedKeys = Object.keys(params).filter((k) => k !== 'secureHash').sort()
  const hashText = sortedKeys.map((k) => params[k] || '').join('')
  return crypto.createHmac('sha256', secretKey).update(hashText).digest('hex')
}

// ============================================================
// INITIATE SALE — POST /pg/api/v2/initiateSale
// ============================================================
export interface InitiateSaleParams {
  merchantTxnNo: string // our booking ref
  amount: string // "100.00" (2 decimals, string)
  customerEmailID?: string
  customerMobileNo?: string
  customerName?: string
  returnUrl: string // our callback URL
}

export async function initiateSale(
  params: InitiateSaleParams,
  creds: NonNullable<Awaited<ReturnType<typeof getIciciCredentials>>>
): Promise<{
  success: boolean
  redirectUrl?: string // full URL the browser should navigate to
  tranCtx?: string
  responseCode?: string
  respDescription?: string
  raw: any
}> {
  const txnDate = formatIciciTxnDate(new Date())

  // Sanitize customerName to [a-zA-Z0-9 ] only (matches reference repo)
  const safeName = (params.customerName || 'VALUED PATIENT').replace(/[^a-zA-Z0-9 ]/g, '').trim() || 'VALUED PATIENT'

  const payload: Record<string, string> = {
    merchantId: creds.merchantId,
    aggregatorID: creds.aggregatorId,
    merchantTxnNo: params.merchantTxnNo,
    amount: params.amount,
    currencyCode: '356',
    payType: '0',
    customerEmailID: params.customerEmailID || 'care.deoghar@gmail.com',
    transactionType: 'SALE',
    returnURL: params.returnUrl,
    txnDate,
    customerMobileNo: params.customerMobileNo || '9973497200',
    customerName: safeName,
    addlParam1: params.merchantTxnNo,
    addlParam2: 'care-diagnostics',
  }
  payload.secureHash = computeIciciSecureHash(payload, creds.secretKey)

  const url = `${creds.baseUrl}/pg/api/v2/initiateSale`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(payload),
  })
  const data = await res.json().catch(() => ({}))

  if (data.responseCode === 'R1000' && data.tranCtx) {
    const redirectUri = data.redirectURI as string
    const sep = redirectUri.includes('?') ? '&' : '?'
    const redirectUrl = `${redirectUri}${sep}tranCtx=${encodeURIComponent(data.tranCtx)}`
    return { success: true, redirectUrl, tranCtx: data.tranCtx, responseCode: data.responseCode, raw: data }
  }

  return {
    success: false,
    responseCode: data.responseCode,
    respDescription: data.respDescription,
    raw: data,
  }
}

// ============================================================
// STATUS CHECK — POST /pg/api/command with transactionType "STATUS"
// ============================================================
export async function checkStatus(
  merchantTxnNo: string,
  creds: NonNullable<Awaited<ReturnType<typeof getIciciCredentials>>>
): Promise<{
  success: boolean
  txnStatus?: string // "SUC" | "FAIL" | "PENDING"
  txnId?: string // gateway's transaction ID
  responseCode?: string
  respDescription?: string
  raw: any
}> {
  const payload: Record<string, string> = {
    merchantId: creds.merchantId,
    aggregatorID: creds.aggregatorId,
    merchantTxnNo,
    originalTxnNo: merchantTxnNo,
    transactionType: 'STATUS',
  }
  payload.secureHash = computeIciciSecureHash(payload, creds.secretKey)

  const url = `${creds.baseUrl}/pg/api/command`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(payload),
  })
  const data = await res.json().catch(() => ({}))

  const isSuccess =
    data.txnStatus === 'SUC' ||
    data.txnResponseCode === '0000' ||
    data.responseCode === '000'

  return {
    success: isSuccess,
    txnStatus: data.txnStatus,
    txnId: data.txnID,
    responseCode: data.responseCode,
    respDescription: data.respDescription,
    raw: data,
  }
}

// ============================================================
// REFUND — POST /pg/api/command with transactionType "REFUND"
// ============================================================
export async function refundPayment(
  merchantTxnNo: string,
  originalTxnId: string, // gateway's txnID from the original sale
  amount: string,
  creds: NonNullable<Awaited<ReturnType<typeof getIciciCredentials>>>
): Promise<{ success: boolean; refundTxnId?: string; raw: any }> {
  const payload: Record<string, string> = {
    merchantId: creds.merchantId,
    aggregatorID: creds.aggregatorId,
    merchantTxnNo,
    originalTxnNo: originalTxnId,
    amount,
    transactionType: 'REFUND',
  }
  payload.secureHash = computeIciciSecureHash(payload, creds.secretKey)

  const url = `${creds.baseUrl}/pg/api/command`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(payload),
  })
  const data = await res.json().catch(() => ({}))

  if (data.responseCode === 'R1000' || data.status === 'SUC') {
    return { success: true, refundTxnId: data.txnID || merchantTxnNo, raw: data }
  }
  return { success: false, raw: data }
}

// ============================================================
// WEBHOOK SIGNATURE VERIFICATION — MANDATORY (never make conditional)
// Algorithm:
//   1. Drop secureHash from body
//   2. Sort remaining keys alphabetically
//   3. hashText = concatenation of all values (NO separator)
//   4. expected = HMAC-SHA256(secretKey, hashText) as hex
//   5. Return expected === body.secureHash
// ============================================================
export function verifyIciciWebhookSignature(
  body: Record<string, any>,
  secretKey: string
): boolean {
  const secureHash = body.secureHash
  if (!secureHash) return false // MANDATORY — missing hash = reject (was a CVE)

  const bodyWithoutHash = { ...body }
  delete bodyWithoutHash.secureHash

  const sortedKeys = Object.keys(bodyWithoutHash).sort()
  const hashText = sortedKeys.map((k) => String(bodyWithoutHash[k] ?? '')).join('')
  const expected = crypto.createHmac('sha256', secretKey).update(hashText).digest('hex')

  try {
    const a = Buffer.from(expected, 'hex')
    const b = Buffer.from(secureHash, 'hex')
    if (a.length !== b.length) return false
    return crypto.timingSafeEqual(a, b)
  } catch {
    // secureHash might not be hex — fall back to string compare (less safe but works)
    return expected === secureHash
  }
}

// Webhook success codes (multiple accepted — compliance-critical)
export const ICICI_WEBHOOK_SUCCESS_CODES = ['SUC', '0000', '000', 'success', 'SUCCESS', 'TXN_SUCCESS', 'R1000']

export function isIciciWebhookSuccess(body: Record<string, any>): boolean {
  const txnStatus = body.txnStatus || body.responseCode
  const txnResponseCode = body.txnResponseCode
  return (
    txnStatus === 'SUC' ||
    txnStatus === '0000' ||
    txnStatus === '000' ||
    body.responseCode === 'R1000' ||
    txnResponseCode === '0000'
  )
}

// ============================================================
// HELPERS
// ============================================================

// Format date as YYYYMMDDHHMMSS (matches reference repo txnDate format)
function formatIciciTxnDate(d: Date): string {
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mi = String(d.getMinutes()).padStart(2, '0')
  const ss = String(d.getSeconds()).padStart(2, '0')
  return `${yyyy}${mm}${dd}${hh}${mi}${ss}`
}

// Mask secureHash for diagnostics logging
export function maskSecureHash(hash?: string): string {
  if (!hash) return ''
  if (hash.length <= 12) return '***'
  return `${hash.slice(0, 6)}***${hash.slice(-4)}`
}
