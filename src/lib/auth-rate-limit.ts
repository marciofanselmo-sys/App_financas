/** Rate limit client-side — complemento ao Supabase Auth (12.15) */
const STORAGE_KEY = 'financeapp_auth_attempts'
const MAX_ATTEMPTS = 5
const WINDOW_MS = 15 * 60 * 1000

interface AttemptRecord {
  count: number
  resetAt: number
}

function readStore(): Record<string, AttemptRecord> {
  if (typeof window === 'undefined') return {}
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
  } catch {
    return {}
  }
}

function writeStore(store: Record<string, AttemptRecord>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
}

export function checkAuthRateLimit(email: string): { ok: true } | { ok: false; retryAfterSec: number } {
  const key = email.trim().toLowerCase()
  const now = Date.now()
  const store = readStore()
  const record = store[key]

  if (!record || now > record.resetAt) {
    return { ok: true }
  }

  if (record.count >= MAX_ATTEMPTS) {
    return { ok: false, retryAfterSec: Math.ceil((record.resetAt - now) / 1000) }
  }

  return { ok: true }
}

export function recordAuthFailure(email: string) {
  const key = email.trim().toLowerCase()
  const now = Date.now()
  const store = readStore()
  const record = store[key]

  if (!record || now > record.resetAt) {
    store[key] = { count: 1, resetAt: now + WINDOW_MS }
  } else {
    store[key] = { count: record.count + 1, resetAt: record.resetAt }
  }

  writeStore(store)
}

export function clearAuthRateLimit(email: string) {
  const key = email.trim().toLowerCase()
  const store = readStore()
  delete store[key]
  writeStore(store)
}
