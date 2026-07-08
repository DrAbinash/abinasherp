export function formatCurrency(amount: number, currency = 'INR'): string {
  if (isNaN(amount)) return '₹0.00'
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(amount)
  } catch {
    return `₹${amount.toFixed(2)}`
  }
}

export function formatDate(d: string | Date | null | undefined): string {
  if (!d) return '—'
  try {
    const date = typeof d === 'string' ? new Date(d) : d
    return new Intl.DateTimeFormat('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
    }).format(date)
  } catch {
    return String(d)
  }
}

export function formatDateTime(d: string | Date | null | undefined): string {
  if (!d) return '—'
  try {
    const date = typeof d === 'string' ? new Date(d) : d
    return new Intl.DateTimeFormat('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true,
    }).format(date)
  } catch {
    return String(d)
  }
}

export function todayIST(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date())
}

export function daysAgo(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(d)
}
