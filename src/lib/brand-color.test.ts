import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  brandPalette,
  contrastLevelOnWhite,
  contrastRatio,
  DEFAULT_BRAND_COLOR,
  ensureContrast,
  isHexColor,
  mixHex,
  normalizeHex,
  parseSponsorUrl,
  readableForeground,
  relativeLuminance,
  withAlpha,
} from './brand-color.ts'

describe('normalizeHex', () => {
  it('accepts long and short forms, with or without #', () => {
    assert.equal(normalizeHex('#0f766e'), '#0F766E')
    assert.equal(normalizeHex('0F766E'), '#0F766E')
    assert.equal(normalizeHex('#fff'), '#FFFFFF')
    assert.equal(normalizeHex('  #abc  '), '#AABBCC')
  })
  it('rejects anything else', () => {
    assert.equal(normalizeHex('red'), null)
    assert.equal(normalizeHex('#12345'), null)
    assert.equal(normalizeHex(''), null)
    assert.equal(normalizeHex(null), null)
  })
  it('isHexColor is strict #RRGGBB', () => {
    assert.equal(isHexColor('#0F766E'), true)
    assert.equal(isHexColor('#fff'), false)
    assert.equal(isHexColor(42), false)
  })
})

describe('contrast', () => {
  it('matches the WCAG reference values', () => {
    assert.equal(relativeLuminance('#FFFFFF'), 1)
    assert.equal(relativeLuminance('#000000'), 0)
    assert.equal(contrastRatio('#FFFFFF', '#000000'), 21)
    assert.equal(contrastRatio('#777777', '#777777'), 1)
    // #767676 is the classic "just passes AA on white" grey
    assert.ok(contrastRatio('#767676', '#FFFFFF') >= 4.5)
    assert.ok(contrastRatio('#777777', '#FFFFFF') < 4.5)
  })
  it('picks a readable foreground for any background', () => {
    assert.equal(readableForeground('#0F766E'), '#FFFFFF')
    assert.equal(readableForeground('#FDE047'), '#000000') // yellow
    assert.equal(readableForeground('#FFFFFF'), '#000000')
    assert.equal(readableForeground('#000000'), '#FFFFFF')
    for (const bg of ['#FDE047', '#22D3EE', '#F472B6', '#0F172A', '#84CC16', '#808080']) {
      assert.ok(contrastRatio(bg, readableForeground(bg)) >= 4.5, bg)
    }
  })
  it('ensureContrast keeps good colours and darkens/lightens weak ones', () => {
    assert.equal(ensureContrast('#0F766E'), '#0F766E')
    const fixed = ensureContrast('#FDE047')
    assert.notEqual(fixed, '#FDE047')
    assert.ok(contrastRatio(fixed, '#FFFFFF') >= 4.5)
    const onDark = ensureContrast('#1E293B', '#020617')
    assert.ok(contrastRatio(onDark, '#020617') >= 4.5)
  })
  it('rates colours on white', () => {
    assert.equal(contrastLevelOnWhite('#0F766E'), 'good')
    assert.equal(contrastLevelOnWhite('#F97316'), 'poor')
    assert.equal(contrastLevelOnWhite('#FFFFFF'), 'poor')
  })
})

describe('brandPalette', () => {
  it('falls back to the default for missing or invalid colours', () => {
    assert.equal(brandPalette(null).bg, DEFAULT_BRAND_COLOR)
    assert.equal(brandPalette('nope').bg, DEFAULT_BRAND_COLOR)
  })
  it('always pairs a readable foreground', () => {
    const p = brandPalette('#ffffff')
    assert.equal(p.bg, '#FFFFFF')
    assert.equal(p.fg, '#000000')
    assert.ok(contrastRatio(p.onLight, '#FFFFFF') >= 4.5)
  })
  it('withAlpha', () => {
    assert.equal(withAlpha('#0F766E', 0.2), 'rgba(15, 118, 110, 0.2)')
    assert.equal(withAlpha('nope', 0.5), 'rgba(0, 0, 0, 0)')
  })
})

describe('parseSponsorUrl', () => {
  it('accepts http(s) links and adds https:// to bare domains', () => {
    assert.equal(parseSponsorUrl('https://example.com/'), 'https://example.com/')
    assert.equal(parseSponsorUrl('example.com.bd'), 'https://example.com.bd/')
    assert.equal(parseSponsorUrl('http://shop.example.com/a?b=1'), 'http://shop.example.com/a?b=1')
  })
  it('clears on empty', () => {
    assert.equal(parseSponsorUrl(''), null)
    assert.equal(parseSponsorUrl(null), null)
  })
  it('rejects other schemes, junk and long links', () => {
    assert.equal(parseSponsorUrl('javascript:alert(1)'), false)
    assert.equal(parseSponsorUrl('ftp://example.com'), false)
    assert.equal(parseSponsorUrl('not a url'), false)
    assert.equal(parseSponsorUrl('https://user:pw@example.com'), false)
    assert.equal(parseSponsorUrl(`https://example.com/${'a'.repeat(200)}`), false)
    assert.equal(parseSponsorUrl(42), false)
  })
})

describe('mixHex', () => {
  it('mixes between two colours', () => {
    assert.equal(mixHex('#000000', '#FFFFFF', 0), '#000000')
    assert.equal(mixHex('#000000', '#FFFFFF', 1), '#FFFFFF')
    assert.equal(mixHex('#000000', '#FFFFFF', 0.5), '#808080')
    assert.equal(mixHex('nope', '#FFFFFF', 0.5), 'nope')
  })
})
