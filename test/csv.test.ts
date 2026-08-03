import { describe, it, expect } from 'vitest'
import { csvCell, csvRow, parseCsv, unescapeCsvCell, parseCsvSections, rowsToObjects } from '../src/lib/csv'
import { parseConfigImport } from '../src/lib/configImport'

describe('csvCell / unescapeCsvCell', () => {
  it('neutralizes formula-injection prefixes and reverses it on read', () => {
    for (const dangerous of ['=SUM(A1)', '+1+1', '-1', '@cmd']) {
      const cell = csvCell(dangerous)
      expect(cell.startsWith("'")).toBe(true)
      expect(unescapeCsvCell(cell)).toBe(dangerous)
    }
  })

  it('leaves ordinary values untouched', () => {
    expect(unescapeCsvCell(csvCell('contact@example.com'))).toBe('contact@example.com')
  })
})

describe('parseCsv', () => {
  it('round-trips values containing commas, quotes and newlines', () => {
    const text = csvRow(['a,b', 'has "quotes"', 'line1\nline2', 'plain'])
    const [row] = parseCsv(text)
    expect(row).toEqual(['a,b', 'has "quotes"', 'line1\nline2', 'plain'])
  })

  it('strips a leading BOM', () => {
    const [row] = parseCsv('﻿hello,world\r\n')
    expect(row).toEqual(['hello', 'world'])
  })
})

describe('parseCsvSections / rowsToObjects', () => {
  it('reconstructs rows by header name, tolerant of section order', () => {
    const text =
      csvRow(['Section', 'Mail Routes']) +
      csvRow(['alias', 'personalEmail', 'displayName', 'active']) +
      csvRow(['contact@example.com', 'perso@example.com', '', 'true']) +
      '\r\n' +
      csvRow(['Section', 'Domaine']) +
      csvRow(['domain']) +
      csvRow(['example.com'])

    const sections = parseCsvSections(text)
    const mailRoutes = rowsToObjects(sections.get('Mail Routes'))
    expect(mailRoutes).toEqual([{ alias: 'contact@example.com', personalEmail: 'perso@example.com', displayName: '', active: 'true' }])
    expect(rowsToObjects(sections.get('Domaine'))).toEqual([{ domain: 'example.com' }])
  })
})

describe('parseConfigImport', () => {
  it('parses a full export round-trip', () => {
    let csv = '﻿'
    csv += csvRow(['Section', 'Domaine'])
    csv += csvRow(['domain'])
    csv += csvRow(['example.com'])
    csv += '\r\n'
    csv += csvRow(['Section', 'Mail Routes'])
    csv += csvRow(['alias', 'personalEmail', 'displayName', 'active'])
    csv += csvRow(['contact@example.com', 'perso@example.com', 'Contact', 'true'])
    csv += csvRow(['archive@example.com', '', '', 'false'])
    csv += '\r\n'
    csv += csvRow(['Section', 'Routing Rules'])
    csv += csvRow(['canal', 'assignToEmail', 'active'])
    csv += csvRow(['contact', 'owner@example.com', 'true'])
    csv += '\r\n'
    csv += csvRow(['Section', 'Reply Templates'])
    csv += csvRow(['titre', 'canal', 'corps'])
    csv += csvRow(['Bienvenue', '', 'Bonjour,\nmerci pour votre message, à bientôt.'])

    const parsed = parseConfigImport(csv)
    expect(parsed.domain).toBe('example.com')
    expect(parsed.mailRoutes).toEqual([
      { alias: 'contact@example.com', personalEmail: 'perso@example.com', displayName: 'Contact', active: true },
      { alias: 'archive@example.com', personalEmail: '', displayName: '', active: false },
    ])
    expect(parsed.routingRules).toEqual([{ canal: 'contact', assignToEmail: 'owner@example.com', active: true }])
    expect(parsed.replyTemplates).toEqual([{ titre: 'Bienvenue', canal: '', corps: 'Bonjour,\nmerci pour votre message, à bientôt.' }])
  })

  it('drops rows missing their required key', () => {
    const csv = csvRow(['Section', 'Mail Routes']) + csvRow(['alias', 'personalEmail', 'displayName', 'active']) + csvRow(['', '', '', 'true'])
    expect(parseConfigImport(csv).mailRoutes).toEqual([])
  })
})
