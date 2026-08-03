// Génération et lecture du format CSV multi-sections utilisé par
// GET/POST /api/organizations/me/export|import (voir docs/export-import-config-mail.md).

// Neutralise les préfixes de formule (=, +, -, @) qu'Excel/Sheets exécuterait à
// l'ouverture, puis entoure de guillemets si la valeur contient une virgule, un
// guillemet ou un retour ligne.
export function csvCell(value: unknown): string {
  const str = value === null || value === undefined ? '' : String(value)
  const safe = /^[=+\-@]/.test(str) ? `'${str}` : str
  return /["\r\n,]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}

export function csvRow(values: unknown[]): string {
  return values.map(csvCell).join(',') + '\r\n'
}

// Inverse de csvCell : retire l'apostrophe anti-injection ajoutée devant une
// valeur commençant par =, +, - ou @ — sans ça une valeur légitimement vide
// réimportée depuis notre propre export se retrouverait préfixée de "'".
export function unescapeCsvCell(value: string): string {
  return /^'[=+\-@]/.test(value) ? value.slice(1) : value
}

// Parseur CSV générique (RFC4180) : guillemets, "" pour un guillemet littéral,
// champs contenant virgule/retour ligne, fins de ligne \r\n | \n | \r. Nécessaire
// ici car les corps de modèles de réponse peuvent contenir virgules et retours
// ligne — un simple split(',')/split('\n') les tronquerait.
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let inQuotes = false
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text

  const endCell = () => {
    row.push(cell)
    cell = ''
  }
  const endRow = () => {
    endCell()
    rows.push(row)
    row = []
  }

  for (let i = 0; i < src.length; i++) {
    const c = src[i]
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          cell += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        cell += c
      }
      continue
    }

    if (c === '"') {
      inQuotes = true
    } else if (c === ',') {
      endCell()
    } else if (c === '\r') {
      if (src[i + 1] === '\n') i++
      endRow()
    } else if (c === '\n') {
      endRow()
    } else {
      cell += c
    }
  }
  if (cell !== '' || row.length > 0) endRow()

  return rows
}

function isBlankRow(row: string[]): boolean {
  return row.every(c => c.trim() === '')
}

// Découpe le CSV multi-sections en { "Mail Routes": { headers, rows }, ... }.
// Tolérant à l'ordre des sections et aux lignes vides en trop — nécessaire pour
// accepter un fichier réimporté après édition manuelle (Excel/Sheets).
export function parseCsvSections(text: string): Map<string, { headers: string[]; rows: string[][] }> {
  const rows = parseCsv(text).map(row => row.map(unescapeCsvCell))
  const sections = new Map<string, { headers: string[]; rows: string[][] }>()

  let i = 0
  while (i < rows.length) {
    const row = rows[i]
    if (isBlankRow(row)) {
      i++
      continue
    }
    if (row[0] !== 'Section') {
      i++
      continue
    }
    const name = row[1] || ''
    i++
    const headers = i < rows.length ? rows[i] : []
    i++
    const dataRows: string[][] = []
    while (i < rows.length && !isBlankRow(rows[i]) && rows[i][0] !== 'Section') {
      dataRows.push(rows[i])
      i++
    }
    sections.set(name, { headers, rows: dataRows })
  }

  return sections
}

// Reconstruit un objet par ligne en s'appuyant sur la ligne d'en-tête de la
// section plutôt que sur une position fixe — robuste si les colonnes ont été
// réordonnées à la main dans un tableur.
export function rowsToObjects(section: { headers: string[]; rows: string[][] } | undefined): Record<string, string>[] {
  if (!section) return []
  return section.rows.map(row => {
    const obj: Record<string, string> = {}
    section.headers.forEach((h, idx) => {
      obj[h] = row[idx] ?? ''
    })
    return obj
  })
}
