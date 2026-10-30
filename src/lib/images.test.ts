// Run: npm test (node --test). Uses sharp to synthesise inputs — no fixtures.
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import sharp from 'sharp'
import { InvalidImageError, processImage } from './images.ts'

const png = (width: number, height: number) =>
  sharp({ create: { width, height, channels: 4, background: { r: 15, g: 118, b: 110, alpha: 1 } } }).png().toBuffer()

describe('processImage', () => {
  it('crops photos to a 512px WebP square', async () => {
    const out = await processImage(await png(1200, 800), 'PHOTO')
    assert.equal(out.mime, 'image/webp')
    assert.deepEqual([out.width, out.height], [512, 512])
    assert.equal((await sharp(out.data).metadata()).format, 'webp')
  })

  it('pads logos to a transparent 256px square whatever their shape', async () => {
    const opaqueJpeg = (w: number, h: number) =>
      sharp({ create: { width: w, height: h, channels: 3, background: '#0f766e' } }).jpeg().toBuffer()
    for (const [w, h] of [[1000, 500], [100, 100], [80, 300]]) {
      const out = await processImage(await opaqueJpeg(w, h), 'LOGO')
      assert.deepEqual([out.width, out.height], [256, 256])
      // Non-square marks are padded — the padding must be see-through.
      if (w !== h) assert.equal((await sharp(out.data).metadata()).hasAlpha, true)
    }
  })

  it('crops banners to 1600×600', async () => {
    const out = await processImage(await png(3000, 3000), 'BANNER')
    assert.deepEqual([out.width, out.height], [1600, 600])
  })

  it('strips metadata', async () => {
    const withExif = await sharp(await png(600, 600)).jpeg().withMetadata({ exif: { IFD0: { Copyright: 'secret' } } }).toBuffer()
    const out = await processImage(withExif, 'PHOTO')
    assert.equal((await sharp(out.data).metadata()).exif, undefined)
  })

  it('rejects non-images and empty files', async () => {
    await assert.rejects(processImage(Buffer.from('<svg onload=alert(1)>'), 'PHOTO'), InvalidImageError)
    await assert.rejects(processImage(Buffer.alloc(0), 'PHOTO'), InvalidImageError)
  })
})
