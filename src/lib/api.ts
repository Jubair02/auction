'use client'

// Typed fetch helpers for the REST API. Errors carry the server `error` message.
export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
  body?: unknown
}

export async function api<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const res = await fetch(path, {
    method: opts.method ?? 'GET',
    headers: opts.body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    cache: 'no-store',
  })
  let data: unknown = null
  try {
    data = await res.json()
  } catch {
    // non-JSON response
  }
  if (!res.ok) {
    const message = (data as { error?: string })?.error || `Request failed (${res.status})`
    throw new ApiError(message, res.status)
  }
  return data as T
}

export const apiGet = <T,>(path: string) => api<T>(path)
export const apiPost = <T,>(path: string, body: unknown) => api<T>(path, { method: 'POST', body })
export const apiPatch = <T,>(path: string, body: unknown) => api<T>(path, { method: 'PATCH', body })
export const apiDelete = <T,>(path: string) => api<T>(path, { method: 'DELETE' })

/** Download a file (e.g. CSV export) from an API endpoint. */
export async function apiDownload(path: string, filename: string): Promise<void> {
  const res = await fetch(path, { cache: 'no-store' })
  if (!res.ok) throw new ApiError(`Download failed (${res.status})`, res.status)
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
