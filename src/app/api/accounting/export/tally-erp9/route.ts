import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getStaffSession } from '@/lib/session'

// Tally ERP 9 XML export — full chart of accounts + all vouchers
// Compatible with Tally ERP 9 (silver/gold series) Import Data flow
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

  // Escape XML special chars
  const esc = (s: string | null | undefined): string => {
    if (!s) return ''
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  }

  // Convert YYYY-MM-DD to YYYYMMDD
  const tallyDate = (d: string): string => (d ? d.replace(/-/g, '') : dateStr)

  // Format amount with Dr/Cr suffix
  const fmtBal = (amt: number, type: string): string => {
    const abs = Math.abs(amt).toFixed(2)
    return `${abs} ${type}`
  }

  // Build LEDGER master messages
  const ledgerMessages = accounts.map((a) => {
    const opening = a.openingBalance > 0 ? `\n        <OPENINGBALANCE>${fmtBal(a.openingBalance, a.openingBalanceType)}</OPENINGBALANCE>` : ''
    const parent = a.tallyGroup ? `\n        <PARENT>${esc(a.tallyGroup)}</PARENT>` : ''
    const gst = a.gstApplicable && a.gstNumber ? `\n        <GSTNUMBER>${esc(a.gstNumber)}</GSTNUMBER>\n        <ISGSTAPPLICABLE>Applicable</ISGSTAPPLICABLE>` : ''
    const pan = a.pan ? `\n        <PANNUMBER>${esc(a.pan)}</PANNUMBER>` : ''
    const bank = a.type === 'bank' && a.bankName ? `\n        <BANKNAME>${esc(a.bankName)}</BANKNAME>${a.accountNumber ? `\n        <ACCOUNTNUMBER>${esc(a.accountNumber)}</ACCOUNTNUMBER>` : ''}${a.ifscCode ? `\n        <IFSCODE>${esc(a.ifscCode)}</IFSCODE>` : ''}` : ''
    return `      <TALLYMESSAGE xmlns:UDF="TallyUDF">
        <LEDGER NAME="${esc(a.name)}" ID="${a.id.slice(-8).toUpperCase()}">
          <NAME>${esc(a.name)}</NAME>
          ${parent ? parent.trim() : ''}${opening ? opening.trim() : ''}${gst ? gst.trim() : ''}${pan ? pan.trim() : ''}${bank ? bank.trim() : ''}
        </LEDGER>
      </TALLYMESSAGE>`
  }).join('\n')

  // Build VOUCHER messages
  const voucherMessages = vouchers.map((v) => {
    const vchType = v.type === 'bank_transfer' ? 'Contra' : v.type === 'receipt' ? 'Receipt' : v.type === 'payment' ? 'Payment' : v.type === 'sales' ? 'Sales' : v.type === 'purchase' ? 'Purchase' : 'Journal'
    return `      <TALLYMESSAGE xmlns:UDF="TallyUDF">
        <VOUCHER VCHTYPE="${vchType}" ACTION="Create">
          <DATE>${tallyDate(v.date)}</DATE>
          <VOUCHERNUMBER>${esc(v.voucherNumber)}</VOUCHERNUMBER>
          <PARTYLEDGERNAME>${esc(v.debitAccount.name)}</PARTYLEDGERNAME>
          ${v.reference ? `<REFERENCE>${esc(v.reference)}</REFERENCE>` : ''}
          <NARRATION>${esc(v.particular || v.remark || v.narration || '')}</NARRATION>
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
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>All Masters</REPORTNAME>
        <STATICVARIABLES>
          <SVCURRENTCOMPANY>Care ERP</SVCURRENTCOMPANY>
        </STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>
${ledgerMessages}
${voucherMessages}
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`

  return new NextResponse(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Content-Disposition': `attachment; filename="care-erp-tally-erp9-${dateStr}.xml"`,
    },
  })
}
