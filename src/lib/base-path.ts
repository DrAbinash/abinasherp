// The sub-path the app is served under (e.g. "/erp"). Injected at build time via
// NEXT_PUBLIC_BASE_PATH and inlined by Next.js. Empty string when served at root.
//
// Next.js `basePath` automatically prefixes <Link>, the router, and static assets,
// but it does NOT prefix `fetch()` calls. Every client-side fetch to an internal
// route must therefore go through apiPath() so it resolves correctly under /erp/.
const BASE_PATH = (process.env.NEXT_PUBLIC_BASE_PATH || '').replace(/\/$/, '')

/** Prefix an app-internal path (e.g. "/api/bills") with the deployment base path. */
export function apiPath(path: string): string {
  if (!path.startsWith('/')) path = '/' + path
  // Already prefixed (avoid double-prefixing).
  if (BASE_PATH && path.startsWith(BASE_PATH + '/')) return path
  return `${BASE_PATH}${path}`
}

export function getBasePath(): string {
  return BASE_PATH
}
