export interface BundledFontDef {
  id: string
  label: string
  cssName: string
  fallbackCss: string
  files: {
    regular?: string
    bold?: string
    italic?: string
    boldItalic?: string
  }
}

export interface SystemFontFamily {
  family: string
  regular?: string
  bold?: string
  italic?: string
  boldItalic?: string
}

export const BUNDLED_FONTS: BundledFontDef[] = [
  {
    id: 'Arial',
    label: 'Arial',
    cssName: 'VeldoraArial',
    fallbackCss: "'VeldoraArial', Arial, Helvetica, sans-serif",
    files: {
      regular: 'arial.ttf',
      bold: 'arialbd.ttf',
      italic: 'ariali.ttf',
      boldItalic: 'arialbi.ttf',
    },
  },
  {
    id: 'Calibri',
    label: 'Calibri',
    cssName: 'VeldoraCalibri',
    fallbackCss: "'VeldoraCalibri', Calibri, 'Segoe UI', sans-serif",
    files: {
      regular: 'calibri.ttf',
      bold: 'calibrib.ttf',
      italic: 'calibrii.ttf',
      boldItalic: 'calibriz.ttf',
    },
  },
  {
    id: 'Times New Roman',
    label: 'Times New Roman',
    cssName: 'VeldoraTimes',
    fallbackCss: "'VeldoraTimes', 'Times New Roman', Times, serif",
    files: {
      regular: 'times.ttf',
      bold: 'timesbd.ttf',
      italic: 'timesi.ttf',
      boldItalic: 'timesbi.ttf',
    },
  },
  {
    id: 'Tahoma',
    label: 'Tahoma',
    cssName: 'VeldoraTahoma',
    fallbackCss: "'VeldoraTahoma', Tahoma, Verdana, sans-serif",
    files: {
      regular: 'tahoma.ttf',
      bold: 'tahomabd.ttf',
    },
  },
  {
    id: 'Verdana',
    label: 'Verdana',
    cssName: 'VeldoraVerdana',
    fallbackCss: "'VeldoraVerdana', Verdana, Geneva, sans-serif",
    files: {
      regular: 'verdana.ttf',
      bold: 'verdanab.ttf',
      italic: 'verdanai.ttf',
      boldItalic: 'verdanaz.ttf',
    },
  },
  {
    id: 'Georgia',
    label: 'Georgia',
    cssName: 'VeldoraGeorgia',
    fallbackCss: "'VeldoraGeorgia', Georgia, serif",
    files: {
      regular: 'georgia.ttf',
      bold: 'georgiab.ttf',
      italic: 'georgiai.ttf',
      boldItalic: 'georgiaz.ttf',
    },
  },
  {
    id: 'Trebuchet MS',
    label: 'Trebuchet MS',
    cssName: 'VeldoraTrebuchet',
    fallbackCss: "'VeldoraTrebuchet', 'Trebuchet MS', sans-serif",
    files: {
      regular: 'trebuc.ttf',
      bold: 'trebucbd.ttf',
      italic: 'trebucit.ttf',
      boldItalic: 'trebucbi.ttf',
    },
  },
  {
    id: 'Segoe UI',
    label: 'Segoe UI',
    cssName: 'VeldoraSegoeUI',
    fallbackCss: "'VeldoraSegoeUI', 'Segoe UI', sans-serif",
    files: {
      regular: 'segoeui.ttf',
      bold: 'segoeuib.ttf',
      italic: 'segoeuii.ttf',
      boldItalic: 'segoeuiz.ttf',
    },
  },
  {
    id: 'Courier New',
    label: 'Courier New',
    cssName: 'VeldoraCourier',
    fallbackCss: "'VeldoraCourier', 'Courier New', Courier, monospace",
    files: {
      regular: 'cour.ttf',
      bold: 'courbd.ttf',
      italic: 'couri.ttf',
      boldItalic: 'courbi.ttf',
    },
  },
  {
    id: 'Consolas',
    label: 'Consolas',
    cssName: 'VeldoraConsolas',
    fallbackCss: "'VeldoraConsolas', Consolas, monospace",
    files: {
      regular: 'consola.ttf',
      bold: 'consolab.ttf',
      italic: 'consolai.ttf',
      boldItalic: 'consolaz.ttf',
    },
  },
  {
    id: 'Helvetica',
    label: 'Helvetica (PDF Standard)',
    cssName: 'VeldoraArial',
    fallbackCss: "'VeldoraArial', Helvetica, Arial, sans-serif",
    files: {
      regular: 'arial.ttf',
      bold: 'arialbd.ttf',
      italic: 'ariali.ttf',
      boldItalic: 'arialbi.ttf',
    },
  },
  {
    id: 'Lato',
    label: 'Lato',
    cssName: 'Lato',
    fallbackCss: "'Lato', -apple-system, sans-serif",
    files: {},
  },
  {
    id: 'Roboto',
    label: 'Roboto',
    cssName: 'Roboto',
    fallbackCss: "'Roboto', -apple-system, sans-serif",
    files: {},
  },
  {
    id: 'DejaVuSans',
    label: 'DejaVu Sans',
    cssName: 'DejaVu Sans',
    fallbackCss: "'DejaVu Sans', Arial, sans-serif",
    files: {},
  },
]

let cssInjected = false

/**
 * Injects @font-face rules for all bundled TTFs in public/fonts/ once so canvas
 * previews match PDF output 100% offline on any machine.
 */
export function ensureBundledCssFaces(): void {
  if (cssInjected || typeof document === 'undefined') return
  cssInjected = true

  const rules: string[] = []
  const seen = new Set<string>()

  for (const font of BUNDLED_FONTS) {
    if (seen.has(font.cssName)) continue
    seen.add(font.cssName)

    const addRule = (file: string | undefined, weight: number, style: string) => {
      if (!file) return
      rules.push(
        `@font-face{font-family:'${font.cssName}';src:url('./fonts/${file}') format('truetype');font-weight:${weight};font-style:${style};font-display:swap;}`
      )
    }

    addRule(font.files.regular, 400, 'normal')
    addRule(font.files.bold, 700, 'normal')
    addRule(font.files.italic, 400, 'italic')
    addRule(font.files.boldItalic, 700, 'italic')
  }

  if (rules.length > 0) {
    const styleEl = document.createElement('style')
    styleEl.id = 'veldora-bundled-fonts'
    styleEl.textContent = rules.join('\n')
    document.head.appendChild(styleEl)
  }
}

let systemFontsCache: SystemFontFamily[] | null = null
let systemFontsPromise: Promise<SystemFontFamily[]> | null = null

export async function getSystemFonts(): Promise<SystemFontFamily[]> {
  if (systemFontsCache) return systemFontsCache
  if (systemFontsPromise) return systemFontsPromise

  const api = typeof window !== 'undefined' ? (window as any).electronAPI : null
  if (!api?.listSystemFonts) {
    systemFontsCache = []
    return []
  }

  systemFontsPromise = api
    .listSystemFonts()
    .then((list: SystemFontFamily[]) => {
      const clean = Array.isArray(list) ? list : []
      systemFontsCache = clean
      return clean
    })
    .catch(() => {
      systemFontsCache = []
      return []
    })

  return systemFontsPromise!
}

export function findBundledFont(fontFamily?: string): BundledFontDef | undefined {
  if (!fontFamily) return undefined
  const clean = fontFamily
    .replace(/-(Bold|Italic|Oblique|BoldItalic|BoldOblique)$/i, '')
    .trim()
    .toLowerCase()

  return BUNDLED_FONTS.find((b) => {
    const bid = b.id.toLowerCase()
    if (clean === bid) return true
    if (clean.includes('times') || clean.includes('roman')) return b.id === 'Times New Roman'
    if (clean.includes('courier')) return b.id === 'Courier New'
    if (clean.includes('trebuc')) return b.id === 'Trebuchet MS'
    if (clean.includes('segoe')) return b.id === 'Segoe UI'
    if (clean.includes('consola')) return b.id === 'Consolas'
    if (clean.includes('calibri')) return b.id === 'Calibri'
    if (clean.includes('tahoma')) return b.id === 'Tahoma'
    if (clean.includes('verdana')) return b.id === 'Verdana'
    if (clean.includes('georgia')) return b.id === 'Georgia'
    if (clean.includes('arial')) return b.id === 'Arial'
    if (clean.includes('dejavu')) return b.id === 'DejaVuSans'
    if (clean.includes('lato')) return b.id === 'Lato'
    if (clean.includes('roboto')) return b.id === 'Roboto'
    if (clean.includes('helvetica')) return b.id === 'Helvetica'
    return false
  })
}

export function findCachedSystemFont(fontFamily?: string): SystemFontFamily | undefined {
  if (!fontFamily || !systemFontsCache) return undefined
  const clean = fontFamily
    .replace(/-(Bold|Italic|Oblique|BoldItalic|BoldOblique)$/i, '')
    .trim()
    .toLowerCase()
  return systemFontsCache.find((f) => f.family.toLowerCase() === clean)
}

export function resolveCssFontFamily(fontFamily?: string): string {
  ensureBundledCssFaces()
  if (!fontFamily) return `'VeldoraArial', 'Inter', Arial, sans-serif`

  const bundled = findBundledFont(fontFamily)
  if (bundled) return bundled.fallbackCss

  const clean = fontFamily
    .replace(/-(Bold|Italic|Oblique|BoldItalic|BoldOblique)$/i, '')
    .trim()
  return `'${clean}', Arial, sans-serif`
}
