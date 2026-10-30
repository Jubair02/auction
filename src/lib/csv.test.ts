// Run: npm test (node --test).
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { neutralizeFormula, parseCsvObjects, toCsv } from './csv.ts'

describe('neutralizeFormula', () => {
  it('defuses formula-looking text', () => {
    for (const s of ['=1+1', '@SUM(A1)', '+HYPERLINK("http://x","y")', '-2+3+cmd|"/c calc"!A0', '\t=1']) {
      assert.equal(neutralizeFormula(s), `'${s}`)
    }
  })

  it('leaves names, phone numbers and negative numbers alone', () => {
    for (const s of ['Shakib Hasan', '+880 1712-345678', '+8801712345678', '-5000', '(017) 1234']) {
      assert.equal(neutralizeFormula(s), s)
    }
  })
})

describe('toCsv', () => {
  it('quotes separators and escapes quotes', () => {
    assert.equal(toCsv(['a', 'b'], [['x,y', 'say "hi"']]), 'a,b\r\n"x,y","say ""hi"""')
  })

  it('neutralizes string cells but not numeric ones', () => {
    assert.equal(toCsv(['n', 'v'], [['=cmd()', -5]]), "n,v\r\n'=cmd(),-5")
  })
})

describe('parseCsvObjects', () => {
  it('lower-cases headers, strips BOM and skips blank lines', () => {
    const { headers, rows } = parseCsvObjects('﻿Name,Base Price\r\nRakib,"10,000"\r\n\r\n')
    assert.deepEqual(headers, ['name', 'baseprice'])
    assert.deepEqual(rows, [{ name: 'Rakib', baseprice: '10,000' }])
  })
})
