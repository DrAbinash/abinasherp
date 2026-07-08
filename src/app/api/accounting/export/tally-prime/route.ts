import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getStaffSession } from '@/lib/session'

// Tally Prime XML export — uses updated envelope + UDF support
// Compatible with Tally Prime (2022+ releases) Import Data flow
export async function GET() {
  const session = await getStaffSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [accounts, vouchers] = await Promise.all([
    db.account.findMany({ orderBy: { name: 'asc' } }),
    db.voucher.findMany({
      orderBy: { date: 'asc' },
      include: { creditAccount: true, debitAccount: true },
    }),
  ])

  const today = new Date()
  const dateStr = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`

  const esc = (s: string | null | undefined): string => {
    if (!s) return ''
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  }

  const tallyDate = (d: string): string => (d ? d.replace(/-/g, '') : dateStr)
  const fmtBal = (amt: number, type: string): string => `${Math.abs(amt).toFixed(2)} ${type}`

  // Tally Prime uses the same LEDGER element but supports GSTRegistration / UDF
  const ledgerMessages = accounts.map((a) => {
    const opening = a.openingBalance > 0 ? `\n          <OPENINGBALANCE>${fmtBal(a.openingBalance, a.openingBalanceType)}</OPENINGBALANCE>` : ''
    const parent = a.tallyGroup ? `\n          <PARENT>${esc(a.tallyGroup)}</PARENT>` : ''
    const gst = a.gstApplicable && a.gstNumber ? `\n          <GSTREGISTRATIONTYPE>Regular</GSTREGISTRATIONTYPE>\n          <GSTNUMBER>${esc(a.gstNumber)}</GSTNUMBER>` : ''
    const pan = a.pan ? `\n          <PANNUMBER>${esc(a.pan)}</PANNUMBER>` : ''
    // Tally Prime UDF for source tracking
    const udf = `\n          <UDF:CAREERP_ID Type="String">${a.id}</UDF:CAREERP_ID>`
    return `      <TALLYMESSAGE xmlns:UDF="TallyUDF">
        <LEDGER NAME="${esc(a.name)}" RESERVEDNAME="">
          <NAME>${esc(a.name)}</NAME>${parent}${opening}${gst}${pan}${udf}
        </LEDGER>
      </TALLYMESSAGE>`
  }).join('\n')

  const voucherMessages = vouchers.map((v) => {
    const vchType = v.type === 'bank_transfer' ? 'Contra' : v.type === 'receipt' ? 'Receipt' : v.type === 'payment' ? 'Payment' : v.type === 'sales' ? 'Sales' : v.type === 'purchase' ? 'Purchase' : 'Journal'
    // Tally Prime UDF for voucher tracking
    const udfVoucher = `\n          <UDF:CAREERP_VID Type="String">${v.id}</UDF:CAREERP_VID>`
    return `      <TALLYMESSAGE xmlns:UDF="TallyUDF">
        <VOUCHER VCHTYPE="${vchType}" ACTION="Create" OBJVIEW="Accounting Voucher View">
          <DATE>${tallyDate(v.date)}</DATE>
          <VOUCHERNUMBER>${esc(v.voucherNumber)}</VOUCHERNUMBER>
          <PARTYLEDGERNAME>${esc(v.debitAccount.name)}</PARTYLEDGERNAME>
          ${v.reference ? `<REFERENCE>${esc(v.reference)}</REFERENCE>` : ''}
          <NARRATION>${esc(v.particular || v.remark || v.narration || '')}</NARRATION>
          <EFFECTIVEDATE>${tallyDate(v.date)}</EFFECTIVEDATE>${udfVoucher}
          <ALLLEDGERENTRIES.LIST>
            <LEDGERNAME>${esc(v.debitAccount.name)}</LEDGERNAME>
            <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
            <AMOUNT>${v.amount.toFixed(2)}</AMOUNT>
          </ALLLEDGERENTRIES.LIST>
          <ALLLEDGERENTRIES.LIST>
            <LEDGERNAME>${esc(v.creditAccount.name)}</LEDGERNAME>
            <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
            <AMOUNT>${v.amount.toFixed(2)}</AMOUNT>
          </ALLLEDGERENTRIES.LIST>
        </VOUCHER>
      </TALLYMESSAGE>`
  }).join('\n')

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <HEADER>
    <VERSION>2</VERSION>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
    <TYPE>Data</TYPE>
    <ID>All Masters</ID>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>
        <SVCURRENTCOMPANY>Care ERP</SVCURRENTCOMPANY>
        <SVFROMDATE Type="Date">${dateStr}</SVFROMDATE>
        <SVTODATE Type="Date">${dateStr}</SVTODATE>
      </STATICVARIABLES>
      <TDL>
        <TDLMESSAGE>
          <DEFINITION Name="Care ERP Source" ISMODIFY="No">
            <SET ChartofAccounts Care ERP>
          </DEFINITION>
        </TDLMESSAGE>
      </TDL>
    </DESC>
    <DATA>
      <TALLYMESSAGE>
${ledgerMessages}
${voucherMessages}
      </TALLYMESSAGE>
    </DATA>
  </BODY>
</ENVELOPE>`

  return new NextResponse(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Content-Disposition': `attachment; filename="care-erp-tally-prime-${dateStr}.xml"`,
    },
  })
}
