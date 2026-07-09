'use client'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="en">
      <body>
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', fontFamily: 'system-ui, sans-serif' }}>
          <div style={{ width: '100%', maxWidth: '28rem', borderRadius: '0.75rem', border: '1px solid #e5e7eb', padding: '1.5rem', textAlign: 'center' }}>
            <h2 style={{ fontSize: '1.125rem', fontWeight: 600 }}>Something went wrong</h2>
            <p style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: '#6b7280' }}>
              An unexpected error occurred. You can try again.
            </p>
            <button
              onClick={() => reset()}
              style={{ marginTop: '1rem', borderRadius: '0.375rem', background: '#111827', color: '#fff', padding: '0.5rem 1rem', fontSize: '0.875rem', border: 'none', cursor: 'pointer' }}
            >
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  )
}
