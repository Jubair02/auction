/* NeelamGhor service worker.
 *
 * Deliberately small and conservative — a live auction must never show stale data:
 *  - pages (navigations): always the network; only when that fails, /offline.html.
 *    HTML is never cached, so a deploy can't leave anyone on an old page.
 *  - /_next/static/** (content-hashed build files) and /icons/**: cache-first.
 *  - everything else — /api/**, socket.io / auction-service traffic, uploads,
 *    POST and other non-GET requests, other origins — is not touched at all.
 *
 * Bump VERSION to drop every cache on the next activation. Served with
 * Cache-Control: no-cache (next.config.ts), so browsers pick up a new copy promptly.
 */
const VERSION = 'v1'
const PRECACHE = `ng-precache-${VERSION}`
const STATIC_CACHE = `ng-static-${VERSION}`
const MAX_STATIC_ENTRIES = 250

const OFFLINE_URL = '/offline.html'
const PRECACHE_URLS = [
  OFFLINE_URL,
  '/favicon.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/maskable-512.png',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(PRECACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS.map((url) => new Request(url, { cache: 'reload' }))))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  const keep = new Set([PRECACHE, STATIC_CACHE])
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith('ng-') && !keep.has(key)).map((key) => caches.delete(key))))
      // Navigation preload: the page request starts while the worker boots —
      // no extra delay on slow phones.
      .then(() => (self.registration.navigationPreload ? self.registration.navigationPreload.enable() : undefined))
      .then(() => self.clients.claim()),
  )
})

/** Requests the worker must leave alone. */
function bypass(request, url) {
  if (request.method !== 'GET') return true
  if (url.origin !== self.location.origin) return true
  if (url.pathname.startsWith('/api/')) return true
  // Socket.io / the auction service gateway (path "/" with ?EIO=… or ?XTransformPort=…).
  if (url.pathname.startsWith('/socket.io') || url.searchParams.has('EIO') || url.searchParams.has('XTransformPort')) return true
  if (request.headers.has('range')) return true
  return false
}

async function trimCache(name, max) {
  const cache = await caches.open(name)
  const keys = await cache.keys()
  // Oldest entries first (insertion order) — drops files from earlier deploys.
  for (let i = 0; i < keys.length - max; i++) await cache.delete(keys[i])
}

async function cacheFirst(request) {
  const cached = await caches.match(request)
  if (cached) return cached
  const response = await fetch(request)
  if (response.ok && response.type === 'basic') {
    const copy = response.clone()
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.put(request, copy))
      .then(() => trimCache(STATIC_CACHE, MAX_STATIC_ENTRIES))
      .catch(() => {})
  }
  return response
}

async function networkFirstPage(event) {
  try {
    // Straight from the network; the pages themselves are sent no-store, so never stale.
    const preloaded = await event.preloadResponse
    if (preloaded) return preloaded
    return await fetch(event.request)
  } catch {
    const offline = await caches.match(OFFLINE_URL)
    return offline || new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)
  if (bypass(request, url)) return

  if (request.mode === 'navigate') {
    event.respondWith(networkFirstPage(event))
    return
  }
  if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/')) {
    event.respondWith(cacheFirst(request))
  }
  // Anything else: default browser handling.
})
