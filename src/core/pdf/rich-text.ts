import { TextRun } from '@/types'

/**
 * Merge adjacent TextRuns that share identical formatting and drop empty segments
 * (while keeping newline-only runs if they carry text).
 */
export function normalizeRuns(runs: TextRun[]): TextRun[] {
  const result: TextRun[] = []
  for (const run of runs) {
    if (!run.text) continue
    const clean: TextRun = {
      text: run.text,
      bold: Boolean(run.bold),
      italic: Boolean(run.italic),
      underline: Boolean(run.underline),
      ...(run.color ? { color: run.color } : {}),
    }
    const prev = result[result.length - 1]
    if (
      prev &&
      Boolean(prev.bold) === Boolean(clean.bold) &&
      Boolean(prev.italic) === Boolean(clean.italic) &&
      Boolean(prev.underline) === Boolean(clean.underline) &&
      (prev.color || '') === (clean.color || '')
    ) {
      prev.text += clean.text
    } else {
      result.push(clean)
    }
  }
  return result
}

export function runsToPlainText(runs: TextRun[]): string {
  return runs.map((r) => r.text).join('')
}

/**
 * Resolve effective TextRun[] for either a PdfTextElement or an AnnotationItem.
 */
export function getEffectiveRuns(item: {
  text?: string
  runs?: TextRun[]
  fontWeight?: string | number
  fontStyle?: string
  fontFamily?: string
  underline?: boolean
}): TextRun[] {
  if (item.runs && item.runs.length > 0) {
    return item.runs
  }
  const text = item.text || ''
  if (!text) return []
  const isBold =
    item.fontWeight === 700 ||
    item.fontWeight === 'bold' ||
    Boolean(item.fontFamily?.toLowerCase().includes('bold'))
  const isItalic =
    item.fontStyle === 'italic' ||
    Boolean(item.fontFamily?.toLowerCase().includes('italic')) ||
    Boolean(item.fontFamily?.toLowerCase().includes('oblique'))
  return [
    {
      text,
      bold: isBold,
      italic: isItalic,
      underline: Boolean(item.underline),
    },
  ]
}

export function applyRunStyleToAll(
  runs: TextRun[],
  patch: Partial<Pick<TextRun, 'bold' | 'italic' | 'underline'>>
): TextRun[] {
  return normalizeRuns(
    runs.map((r) => ({
      ...r,
      ...patch,
    }))
  )
}

export function splitRunsByLine(runs: TextRun[]): TextRun[][] {
  const lines: TextRun[][] = [[]]
  for (const run of runs) {
    const parts = run.text.split('\n')
    parts.forEach((part, idx) => {
      if (idx > 0) {
        lines.push([])
      }
      if (part.length > 0) {
        lines[lines.length - 1].push({
          ...run,
          text: part,
        })
      }
    })
  }
  return lines
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Convert TextRun[] to safe HTML for a contentEditable rich-text editor.
 */
export function runsToHtml(runs: TextRun[]): string {
  if (!runs || runs.length === 0) return ''
  return runs
    .map((run) => {
      let content = escapeHtml(run.text).replace(/\n/g, '<br>')
      if (run.bold) content = `<b>${content}</b>`
      if (run.italic) content = `<i>${content}</i>`
      if (run.underline) content = `<u>${content}</u>`
      return content
    })
    .join('')
}

/**
 * Parse a contentEditable DOM tree back into normalized TextRun[].
 */
export function htmlToRuns(container: HTMLElement): TextRun[] {
  const raw: TextRun[] = []

  const walk = (
    node: Node,
    style: { bold: boolean; italic: boolean; underline: boolean }
  ) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = (node.textContent || '').replace(/\u00a0/g, ' ')
      if (text) {
        raw.push({
          text,
          bold: style.bold,
          italic: style.italic,
          underline: style.underline,
        })
      }
      return
    }

    if (node.nodeType !== Node.ELEMENT_NODE) return
    const el = node as HTMLElement
    const tag = el.tagName.toUpperCase()

    if (tag === 'BR') {
      raw.push({
        text: '\n',
        bold: style.bold,
        italic: style.italic,
        underline: style.underline,
      })
      return
    }

    const nextStyle = { ...style }
    if (tag === 'B' || tag === 'STRONG') nextStyle.bold = true
    if (tag === 'I' || tag === 'EM') nextStyle.italic = true
    if (tag === 'U') nextStyle.underline = true

    const fw = el.style?.fontWeight
    if (fw === 'bold' || fw === 'bolder' || (fw && parseInt(fw, 10) >= 600)) {
      nextStyle.bold = true
    } else if (fw === 'normal' || fw === '400') {
      nextStyle.bold = false
    }

    const fs = el.style?.fontStyle
    if (fs === 'italic' || fs === 'oblique') {
      nextStyle.italic = true
    } else if (fs === 'normal') {
      nextStyle.italic = false
    }

    const td = el.style?.textDecorationLine || el.style?.textDecoration || ''
    if (td.includes('underline')) {
      nextStyle.underline = true
    } else if (td === 'none') {
      nextStyle.underline = false
    }

    const isBlock = tag === 'DIV' || tag === 'P'
    if (isBlock && raw.length > 0 && !raw[raw.length - 1].text.endsWith('\n')) {
      raw.push({
        text: '\n',
        bold: nextStyle.bold,
        italic: nextStyle.italic,
        underline: nextStyle.underline,
      })
    }

    for (let i = 0; i < el.childNodes.length; i++) {
      walk(el.childNodes[i], nextStyle)
    }
  }

  for (let i = 0; i < container.childNodes.length; i++) {
    walk(container.childNodes[i], { bold: false, italic: false, underline: false })
  }

  // Trim trailing single synthetic newline added by contentEditable around trailing <br>
  const normalized = normalizeRuns(raw)
  if (
    normalized.length > 0 &&
    normalized[normalized.length - 1].text === '\n' &&
    container.lastChild instanceof HTMLElement &&
    container.lastChild.tagName === 'BR'
  ) {
    normalized.pop()
  }
  return normalized
}
