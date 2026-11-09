// Generates the PWA icons in public/icons/ from public/favicon.svg.
// Run: node scripts/generate-icons.mjs  (commit the PNGs it writes)
//
//  - icon-192.png / icon-512.png  — "any" purpose: the favicon as is (rounded tile)
//  - maskable-512.png             — "maskable": full-bleed teal square with the gavel
//                                    inside the 80% safe zone, so Android's circle /
//                                    squircle masks never clip it
//  - apple-touch-icon.png         — 180px, opaque (iOS fills transparency with black)
import { mkdir, readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const pub = join(root, 'public')
const outDir = join(pub, 'icons')

const TEAL = '#0f766e'

const favicon = await readFile(join(pub, 'favicon.svg'))
// The gavel strokes from the favicon (inside its <g>…</g>), reused for the maskable / opaque variants.
const gavel = favicon.toString('utf8').match(/<g[\s\S]*?<\/g>/)?.[0]
if (!gavel) throw new Error('favicon.svg: gavel <g> group not found')

/** Full-bleed square with the 24-unit gavel scaled to `scale` of the 32-unit canvas. */
function fullBleed(scale) {
  const size = 24 * scale
  const offset = (32 - size) / 2
  const inner = gavel.replace(/transform="[^"]*"/, `transform="translate(${offset} ${offset}) scale(${scale})"`)
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" fill="${TEAL}"/>${inner}</svg>`,
  )
}

const render = (svg, px) => sharp(svg, { density: Math.ceil((72 * px) / 32) }).resize(px, px).png({ compressionLevel: 9 })

await mkdir(outDir, { recursive: true })
const jobs = [
  [favicon, 192, join(outDir, 'icon-192.png')],
  [favicon, 512, join(outDir, 'icon-512.png')],
  // Safe zone is a centred circle of 80% diameter; the gavel at 0.85 × 24/32 ≈ 64% fits well inside.
  [fullBleed(0.85), 512, join(outDir, 'maskable-512.png')],
  [fullBleed(0.95), 180, join(pub, 'apple-touch-icon.png')],
]
for (const [svg, px, file] of jobs) {
  await render(svg, px).toFile(file)
  console.log(`wrote ${file.slice(root.length + 1)} (${px}×${px})`)
}
