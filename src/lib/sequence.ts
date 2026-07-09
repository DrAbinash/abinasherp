// Concurrency-safe document numbering.
//
// Several models generate human-readable numbers (bill / order / patient /
// voucher) from a count- or max-based sequence, then insert with a @unique
// constraint. Under real concurrency (PostgreSQL, unlike single-writer SQLite)
// two requests can compute the same number; the loser hits a P2002 unique
// violation. Wrapping the compute-and-insert in withUniqueRetry recomputes the
// sequence and retries so the second writer transparently gets the next number
// instead of a 500.
export async function withUniqueRetry<T>(fn: () => Promise<T>, attempts = 6): Promise<T> {
  let lastErr: unknown
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn()
    } catch (e: unknown) {
      if ((e as { code?: string })?.code === 'P2002') {
        lastErr = e
        continue
      }
      throw e
    }
  }
  throw lastErr
}
