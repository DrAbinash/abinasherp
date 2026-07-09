import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getStaffSession } from '@/lib/session'

// GET /api/patient-reports/:id/pdf — returns simple HTML representation for browser print-to-PDF
// In production, replace with a PDF library like @react-pdf/renderer or puppeteer
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getStaffSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const report = await db.patientReport.findUnique({ where: { id } })
  if (!report) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const clinic = await db.clinic.findFirst()
  const values = JSON.parse(report.values || '{}')
  const impression = report.impression || ''

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${report.reportNumber}</title>
<style>
  body { font-family: Arial, sans-serif; margin: 30px; color: #1a1a1a; }
  .header { text-align: center; border-bottom: 3px solid #10b981; padding-bottom: 15px; margin-bottom: 20px; }
  .header h1 { color: #10b981; margin: 0; font-size: 24px; }
  .header p { margin: 4px 0; font-size: 12px; color: #555; }
  .patient-info { display: flex; justify-content: space-between; margin-bottom: 20px; font-size: 12px; }
  .patient-info table { width: 48%; }
  .patient-info td { padding: 3px 0; border-bottom: 1px dotted #ccc; }
  .patient-info td:first-child { color: #666; width: 30%; }
  .test-name { background: #f0fdf4; padding: 8px 12px; border-left: 4px solid #10b981; margin: 20px 0; font-weight: bold; font-size: 14px; }
  table.results { width: 100%; border-collapse: collapse; margin: 15px 0; font-size: 12px; }
  table.results th { background: #f5f5f5; padding: 8px; text-align: left; border-bottom: 2px solid #ddd; }
  table.results td { padding: 8px; border-bottom: 1px solid #eee; }
  table.results td:first-child { font-weight: 500; }
  .impression { margin-top: 25px; padding: 12px; background: #fffbeb; border-left: 4px solid #f59e0b; font-size: 12px; }
  .impression strong { display: block; margin-bottom: 5px; color: #92400e; }
  .footer { margin-top: 40px; padding-top: 15px; border-top: 1px solid #ddd; font-size: 10px; color: #999; text-align: center; }
  .signature { margin-top: 50px; text-align: right; font-size: 12px; }
  .signature .line { border-top: 1px solid #333; width: 200px; margin-left: auto; padding-top: 5px; }
  @media print { body { margin: 15px; } .no-print { display: none; } }
</style>
</head><body>
  <div class="header">
    <h1>${clinic?.name || 'Care Diagnostic Centre'}</h1>
    <p>${clinic?.address || ''}${clinic?.phone ? ' · ' + clinic.phone : ''}</p>
    ${clinic?.gstin ? `<p>GSTIN: ${clinic.gstin}</p>` : ''}
  </div>
  <div class="patient-info">
    <table>
      <tr><td>Name:</td><td><strong>${report.patientName}</strong></td></tr>
      <tr><td>Age/Gender:</td><td>${report.patientAge || '-'} / ${report.patientGender || '-'}</td></tr>
      <tr><td>Phone:</td><td>${report.patientPhone || '-'}</td></tr>
    </table>
    <table>
      <tr><td>Report #:</td><td><strong>${report.reportNumber}</strong></td></tr>
      <tr><td>Date:</td><td>${new Date(report.createdAt).toLocaleDateString('en-IN')}</td></tr>
      <tr><td>Ref. Doctor:</td><td>${report.doctorName || 'Self'}</td></tr>
    </table>
  </div>
  <div class="test-name">${report.testName}</div>
  <table class="results">
    <thead><tr><th>Parameter</th><th>Value</th><th>Unit</th><th>Reference Range</th></tr></thead>
    <tbody>
      ${Object.entries(values).map(([key, val]: [string, any]) => `
        <tr><td>${key}</td><td><strong>${typeof val === 'object' ? val.value : val}</strong></td><td>${typeof val === 'object' ? val.unit || '' : ''}</td><td>${typeof val === 'object' ? val.refRange || '' : ''}</td></tr>
      `).join('')}
    </tbody>
  </table>
  ${impression ? `<div class="impression"><strong>Impression:</strong>${impression}</div>` : ''}
  <div class="signature">
    <div class="line">${report.approvedByName || report.reportedByName || 'Lab In-charge'}</div>
    <div style="font-size: 10px; color: #999;">Lab Technician / Pathologist</div>
  </div>
  <div class="footer">
    *** This is a computer-generated report. ***<br>
    Report generated on ${new Date().toLocaleString('en-IN')} · Status: ${report.status.toUpperCase()}
  </div>
  <script>window.print()</script>
</body></html>`

  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}
