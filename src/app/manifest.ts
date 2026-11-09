import type { MetadataRoute } from 'next'

// Web app manifest, served at /manifest.webmanifest (Next adds the <link> tag).
// Icons come from scripts/generate-icons.mjs. Colours: the brand teal
// (--primary in globals.css, oklch(0.51 0.096 186) = #0f766e) on white.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'NeelamGhor — Live Player Auctions',
    short_name: 'NeelamGhor',
    description:
      'Run live room-code player auctions for your local tournament — budgets, squads and results in ৳ BDT. Cricket & Football.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'any',
    theme_color: '#0f766e',
    background_color: '#ffffff',
    lang: 'en',
    dir: 'ltr',
    categories: ['sports'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'Join an auction room', short_name: 'Join room', url: '/join' },
      { name: 'Dashboard', url: '/dashboard' },
    ],
  }
}
