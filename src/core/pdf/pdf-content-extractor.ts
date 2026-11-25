import * as pdfjsLib from 'pdfjs-dist'
import { PdfTextElement, PdfImageElement, PdfOutlineItem, TextRun } from '@/types'
import { extractImageWithContentBounds } from '@/utils/image-utils'
import { normalizeRuns } from './rich-text'

export class PdfContentExtractor {
  /**
   * Extracts editable text elements from a PDF page, grouping inline words into natural sentences/phrases
   * with Canva-like tight bounding box accuracy, true font weight, exact color, and font family.
   */
  static async extractPageTextElements(
    pdfDoc: pdfjsLib.PDFDocumentProxy,
    pageNumber: number
  ): Promise<PdfTextElement[]> {
    try {
      const page = await pdfDoc.getPage(pageNumber)
      const textContent = await page.getTextContent()
      const opList = await page.getOperatorList()
      const viewport = page.getViewport({ scale: 1.0 })

      // 1. Scan OperatorList to map text operations 1:1 to their exact active fill color
      interface TextOpRecord {
        str: string
        color: string
      }
      const textOps: TextOpRecord[] = []
      let currentColor = '#000000'

      for (let i = 0; i < opList.fnArray.length; i++) {
        const fn = opList.fnArray[i]
        const args = opList.argsArray[i]

        if (fn === pdfjsLib.OPS.setFillRGBColor) {
          const r = args[0]
          const g = args[1]
          const b = args[2]
          currentColor =
            '#' +
            [r, g, b].map((x: number) => x.toString(16).padStart(2, '0')).join('')
        } else if (fn === pdfjsLib.OPS.setFillColor) {
          if (args.length === 1) {
            const v = Math.round(args[0] * 255)
            currentColor =
              '#' +
              [v, v, v].map((x: number) => x.toString(16).padStart(2, '0')).join('')
          } else if (args.length === 3) {
            const r = Math.round(args[0] * 255)
            const g = Math.round(args[1] * 255)
            const b = Math.round(args[2] * 255)
            currentColor =
              '#' +
              [r, g, b].map((x: number) => x.toString(16).padStart(2, '0')).join('')
          }
        } else if (
          fn === pdfjsLib.OPS.showText ||
          fn === pdfjsLib.OPS.showSpacedText
        ) {
          const glyphs = args[0]
          const str = Array.isArray(glyphs)
            ? glyphs
              .map((g: any) =>
                typeof g === 'string'
                  ? g
                  : g && typeof g.unicode === 'string'
                    ? g.unicode
                    : ''
              )
              .join('')
            : typeof glyphs === 'string'
              ? glyphs
              : ''
          textOps.push({ str: str.trim(), color: currentColor })
        }
      }

      interface RawItem {
        str: string
        blockIndex: number
        x: number
        y: number
        width: number
        height: number
        fontName: string
        cleanFontFamily: string
        isBold: boolean
        isItalic: boolean
        fontSize: number
        color: string
        transform: number[]
        pdfX?: number
        pdfBaselineY?: number
        pdfWidth?: number
        pdfHeight?: number
      }

      const rawItems: RawItem[] = []
      let blockCount = 0
      let opCursor = 0

      for (const item of textContent.items) {
        if (!('str' in item)) continue
        const textStr = item.str?.trim()
        if (!textStr) continue

        const currentBlockIdx = blockCount++

        const tx = pdfjsLib.Util.transform(viewport.transform, item.transform)
        const fontSize = Math.hypot(tx[0], tx[1]) || item.height || 12
        const left = tx[4]
        const baselineY = tx[5]
        const top = baselineY - fontSize * 0.78
        const width = item.width
        const height = fontSize * 0.98

        const xPercent = (left / viewport.width) * 100
        const yPercent = (top / viewport.height) * 100
        const widthPercent = (width / viewport.width) * 100
        const heightPercent = (height / viewport.height) * 100

        if (widthPercent <= 0 || heightPercent <= 0) continue

        // Resolve font metadata from commonObjs
        let fontObj: any = null
        try {
          if (page.commonObjs.has(item.fontName)) {
            fontObj = page.commonObjs.get(item.fontName)
          }
        } catch {
          // ignore
        }

        const rawFontName = (fontObj?.name || item.fontName || 'Helvetica').replace(
          /^[A-Z]{6}\+/,
          ''
        )
        const isBold =
          rawFontName.toLowerCase().includes('bold') ||
          rawFontName.toLowerCase().includes('black') ||
          rawFontName.toLowerCase().includes('heavy') ||
          (fontObj?.bold ?? false)
        const isItalic =
          rawFontName.toLowerCase().includes('italic') ||
          rawFontName.toLowerCase().includes('oblique') ||
          (fontObj?.italic ?? false)

        // Find best matching textOp color starting from opCursor
        let itemColor = currentColor || '#000000'
        let foundOpIdx = -1
        for (let k = opCursor; k < textOps.length; k++) {
          const opStr = textOps[k].str
          if (
            opStr.includes(textStr) ||
            textStr.includes(opStr) ||
            (opStr.length >= 3 && textStr.startsWith(opStr.slice(0, 3))) ||
            (textStr.length >= 3 && opStr.startsWith(textStr.slice(0, 3)))
          ) {
            foundOpIdx = k
            break
          }
        }

        if (foundOpIdx !== -1) {
          itemColor = textOps[foundOpIdx].color
          opCursor = foundOpIdx
        } else if (opCursor < textOps.length) {
          itemColor = textOps[opCursor].color
        }

        rawItems.push({
          str: textStr,
          blockIndex: currentBlockIdx,
          x: xPercent,
          y: yPercent,
          width: widthPercent,
          height: heightPercent,
          fontName: item.fontName,
          cleanFontFamily: rawFontName,
          isBold,
          isItalic,
          fontSize: Math.round(fontSize * 10) / 10,
          color: itemColor,
          transform: item.transform,
          pdfX: item.transform[4],
          pdfBaselineY: item.transform[5],
          pdfWidth: item.width,
          pdfHeight: item.height || fontSize,
        })
      }

      // Group words on the exact same baseline that are adjacent into clean phrases/lines
      const groupedElements: PdfTextElement[] = []
      let currentGroup: RawItem[] = []

      const flushGroup = () => {
        if (currentGroup.length === 0) return

        let combinedText = ''
        const rawRuns: TextRun[] = []
        for (let i = 0; i < currentGroup.length; i++) {
          const r = currentGroup[i]
          if (i === 0) {
            combinedText = r.str
            rawRuns.push({
              text: r.str,
              bold: r.isBold,
              italic: r.isItalic,
            })
          } else {
            const prev = currentGroup[i - 1]
            const gap = r.x - (prev.x + prev.width)
            if (gap > 0.05 && !combinedText.endsWith(' ') && !r.str.startsWith(' ')) {
              combinedText += ' ' + r.str
              rawRuns.push({
                text: ' ',
                bold: prev.isBold && r.isBold,
                italic: prev.isItalic && r.isItalic,
              })
              rawRuns.push({
                text: r.str,
                bold: r.isBold,
                italic: r.isItalic,
              })
            } else {
              combinedText += r.str
              rawRuns.push({
                text: r.str,
                bold: r.isBold,
                italic: r.isItalic,
              })
            }
          }
        }
        const normalizedRuns = normalizeRuns(rawRuns)

        if (!combinedText.trim()) {
          currentGroup = []
          return
        }

        const first = currentGroup[0]
        const minX = Math.min(...currentGroup.map((r) => r.x))
        const maxX = Math.max(...currentGroup.map((r) => r.x + r.width))
        const minY = Math.min(...currentGroup.map((r) => r.y))
        const maxH = Math.max(...currentGroup.map((r) => r.height))

        const roundedX = Math.max(0, Math.min(99, Math.round(minX * 100) / 100))
        const roundedY = Math.max(0, Math.min(99, Math.round(minY * 100) / 100))
        const roundedW = Math.min(100, Math.round((maxX - minX) * 100) / 100)
        const roundedH = Math.min(100, Math.round(maxH * 100) / 100)

        // Select clean standard font family while preserving specific font names (Lato, DejaVu, Roboto, Calibri)
        let fontFamily = first.cleanFontFamily || 'Helvetica'
        const lower = fontFamily.toLowerCase()
        if (lower.includes('times') || lower.includes('serif') || lower.includes('roman')) {
          fontFamily = first.isBold ? 'Times-Roman-Bold' : 'Times-Roman'
        } else if (lower.includes('courier') || lower.includes('mono')) {
          fontFamily = first.isBold ? 'Courier-Bold' : 'Courier'
        } else if (lower.includes('lato')) {
          fontFamily = first.isBold ? 'Lato-Bold' : 'Lato'
        } else if (lower.includes('dejavu')) {
          fontFamily = first.isBold ? 'DejaVuSans-Bold' : 'DejaVuSans'
        } else if (lower.includes('roboto')) {
          fontFamily = first.isBold ? 'Roboto-Bold' : 'Roboto'
        } else if (lower.includes('calibri')) {
          fontFamily = first.isBold ? 'Calibri-Bold' : 'Calibri'
        } else if (first.isBold) {
          fontFamily = 'Helvetica-Bold'
        } else {
          fontFamily = 'Helvetica'
        }

        const minPdfX = Math.min(...currentGroup.map((r) => r.pdfX ?? (r.x / 100) * viewport.width))
        const maxPdfX = Math.max(...currentGroup.map((r) => (r.pdfX ?? (r.x / 100) * viewport.width) + (r.pdfWidth ?? (r.width / 100) * viewport.width)))

        groupedElements.push({
          id: `orig_txt_${pageNumber}_${first.blockIndex}`,
          pageNumber,
          text: combinedText,
          originalText: combinedText,
          runs: normalizedRuns,
          blockIndex: first.blockIndex,
          blockIndices: currentGroup.map((r) => r.blockIndex),
          opIndex: first.blockIndex,
          opIndices: currentGroup.map((r) => r.blockIndex),
          x: roundedX,
          y: roundedY,
          width: roundedW,
          height: roundedH,
          origX: roundedX,
          origY: roundedY,
          origWidth: roundedW,
          origHeight: roundedH,
          pdfX: Math.round(minPdfX * 100) / 100,
          pdfBaselineY: Math.round((first.pdfBaselineY ?? 0) * 100) / 100,
          pdfWidth: Math.round((maxPdfX - minPdfX) * 100) / 100,
          pdfHeight: first.fontSize,
          fontSize: first.fontSize,
          lineHeight: Math.round(first.fontSize * 1.35 * 10) / 10,
          fontFamily,
          fontWeight: first.isBold ? 700 : 400,
          fontStyle: first.isItalic ? 'italic' : 'normal',
          color: first.color,
          isModified: false,
          isDeleted: false,
        })

        currentGroup = []
      }

      // Sort top-to-bottom, left-to-right with tight baseline threshold
      rawItems.sort((a, b) => {
        const threshold = Math.min(a.height, b.height) * 0.4
        if (Math.abs(a.y - b.y) > threshold) {
          return a.y - b.y
        }
        return a.x - b.x
      })

      for (let i = 0; i < rawItems.length; i++) {
        const item = rawItems[i]

        if (currentGroup.length === 0) {
          currentGroup.push(item)
          continue
        }

        const prev = currentGroup[currentGroup.length - 1]
        // Same line check: baselines within 35% of font height
        const sameLine = Math.abs(item.y - prev.y) <= Math.min(item.height, prev.height) * 0.35
        // Horizontal adjacency check
        const gapX = item.x - (prev.x + prev.width)
        const maxWordGap = Math.min(1.8, (prev.fontSize / viewport.width) * 100 * 1.5)
        const isAdjacentX = gapX >= -0.2 && gapX <= maxWordGap

        if (sameLine && isAdjacentX) {
          currentGroup.push(item)
        } else {
          flushGroup()
          currentGroup.push(item)
        }
      }

      flushGroup()

      // 3. Canva-Grade Smart Paragraph Clustering
      // Merge consecutive lines that belong to the same continuous body paragraph into a unified paragraph block
      const clusteredParagraphs: PdfTextElement[] = []
      let currentParagraph: PdfTextElement[] = []

      const flushParagraph = () => {
        if (currentParagraph.length === 0) return

        if (currentParagraph.length === 1) {
          clusteredParagraphs.push(currentParagraph[0])
          currentParagraph = []
          return
        }

        const first = currentParagraph[0]
        const minX = Math.min(...currentParagraph.map((l) => l.x))
        const maxX = Math.max(...currentParagraph.map((l) => l.x + l.width))
        const minY = Math.min(...currentParagraph.map((l) => l.y))
        const maxY = Math.max(...currentParagraph.map((l) => l.y + l.height))

        const origMinX = Math.min(...currentParagraph.map((l) => l.origX ?? l.x))
        const origMaxX = Math.max(...currentParagraph.map((l) => (l.origX ?? l.x) + (l.origWidth ?? l.width)))
        const origMinY = Math.min(...currentParagraph.map((l) => l.origY ?? l.y))
        const origMaxY = Math.max(...currentParagraph.map((l) => (l.origY ?? l.y) + (l.origHeight ?? l.height)))

        const combinedText = currentParagraph.map((l) => l.text).join('\n')
        const mergedRuns: TextRun[] = []
        currentParagraph.forEach((l, idx) => {
          if (idx > 0) {
            mergedRuns.push({ text: '\n', bold: false, italic: false })
          }
          if (l.runs && l.runs.length > 0) {
            mergedRuns.push(...l.runs)
          } else {
            mergedRuns.push({
              text: l.text,
              bold: l.fontWeight === 700,
              italic: l.fontStyle === 'italic',
              underline: l.underline,
            })
          }
        })
        const allBlockIndices = currentParagraph.flatMap((l) => l.blockIndices || [l.blockIndex ?? 0])

        const deltaYpt =
          currentParagraph.length > 1
            ? ((currentParagraph[1].y - currentParagraph[0].y) / 100) * viewport.height
            : first.fontSize * 1.35

        clusteredParagraphs.push({
          id: `orig_para_${pageNumber}_${first.blockIndex}`,
          pageNumber,
          text: combinedText,
          originalText: combinedText,
          runs: normalizeRuns(mergedRuns),
          blockIndex: first.blockIndex,
          blockIndices: allBlockIndices,
          opIndex: first.opIndex,
          opIndices: allBlockIndices,
          x: Math.round(minX * 100) / 100,
          y: Math.round(minY * 100) / 100,
          width: Math.round((maxX - minX) * 100) / 100,
          height: Math.round((maxY - minY) * 100) / 100,
          origX: Math.round(origMinX * 100) / 100,
          origY: Math.round(origMinY * 100) / 100,
          origWidth: Math.round((origMaxX - origMinX) * 100) / 100,
          origHeight: Math.round((origMaxY - origMinY) * 100) / 100,
          fontSize: first.fontSize,
          lineHeight: Math.round(deltaYpt * 10) / 10,
          lineCount: currentParagraph.length,
          fontFamily: first.fontFamily,
          fontWeight: first.fontWeight,
          fontStyle: first.fontStyle,
          color: first.color,
          isModified: false,
          isDeleted: false,
        })

        currentParagraph = []
      }

      for (let i = 0; i < groupedElements.length; i++) {
        const line = groupedElements[i]
        if (currentParagraph.length === 0) {
          currentParagraph.push(line)
          continue
        }

        const prev = currentParagraph[currentParagraph.length - 1]

        const sameStyle =
          Math.abs(line.fontSize - prev.fontSize) <= 0.4 &&
          line.color === prev.color &&
          line.fontFamily === prev.fontFamily &&
          line.fontWeight === prev.fontWeight
        const alignedX = Math.abs(line.x - prev.x) <= 1.5
        const deltaYpt = ((line.y - prev.y) / 100) * viewport.height
        const validLineSpacing =
          deltaYpt >= prev.fontSize * 0.85 && deltaYpt <= prev.fontSize * 1.85
        const prevIsFilledLine = prev.width >= 20 || (prev.x + prev.width) >= 55
        const prevEndsWithColon = prev.text.endsWith(':')

        if (sameStyle && alignedX && validLineSpacing && prevIsFilledLine && !prevEndsWithColon) {
          currentParagraph.push(line)
        } else {
          flushParagraph()
          currentParagraph.push(line)
        }
      }

      flushParagraph()

      return clusteredParagraphs
    } catch (err) {
      console.warn('Failed to extract original text elements:', err)
      return []
    }
  }

  /**
   * Extracts embedded images from a PDF page using full CTM matrix stack tracking
   * and precise 4-corner viewport mapping.
   */
  static async extractPageImages(
    pdfDoc: pdfjsLib.PDFDocumentProxy,
    pageNumber: number
  ): Promise<PdfImageElement[]> {
    try {
      const page = await pdfDoc.getPage(pageNumber)
      const opList = await page.getOperatorList()
      const viewport = page.getViewport({ scale: 1.0 })

      const images: PdfImageElement[] = []
      const fnArray = opList.fnArray
      const argsArray = opList.argsArray

      let currentTransform = [1, 0, 0, 1, 0, 0]
      const transformStack: number[][] = []

      for (let i = 0; i < fnArray.length; i++) {
        const fn = fnArray[i]
        const args = argsArray[i]

        if (fn === pdfjsLib.OPS.save) {
          transformStack.push([...currentTransform])
        } else if (fn === pdfjsLib.OPS.restore) {
          currentTransform = transformStack.pop() || [1, 0, 0, 1, 0, 0]
        } else if (fn === pdfjsLib.OPS.transform) {
          currentTransform = pdfjsLib.Util.transform(currentTransform, args)
        } else if (
          fn === pdfjsLib.OPS.paintImageXObject ||
          fn === pdfjsLib.OPS.paintInlineImageXObject
        ) {
          const imgName = args[0]
          const a = currentTransform[0]
          const b = currentTransform[1]
          const c = currentTransform[2]
          const d = currentTransform[3]
          const e = currentTransform[4]
          const f = currentTransform[5]

          // 4 corners of unit image square [0,1]x[0,1] in PDF space
          const p0 = viewport.convertToViewportPoint(e, f)
          const p1 = viewport.convertToViewportPoint(a + e, b + f)
          const p2 = viewport.convertToViewportPoint(c + e, d + f)
          const p3 = viewport.convertToViewportPoint(a + c + e, b + d + f)

          const minVx = Math.min(p0[0], p1[0], p2[0], p3[0])
          const maxX = Math.max(p0[0], p1[0], p2[0], p3[0])
          const minVy = Math.min(p0[1], p1[1], p2[1], p3[1])
          const maxY = Math.max(p0[1], p1[1], p2[1], p3[1])

          let dataUrl: string | undefined = undefined
          let padLeftRatio = 0
          let padRightRatio = 0
          let padTopRatio = 0
          let padBottomRatio = 0

          try {
            const imgData = await new Promise<any>((resolve) => {
              const timer = setTimeout(() => resolve(null), 250)
              page.objs.get(imgName, (data: any) => {
                clearTimeout(timer)
                resolve(data)
              })
            })
            if (imgData) {
              const res = extractImageWithContentBounds(imgData)
              if (res) {
                dataUrl = res.dataUrl
                padLeftRatio = res.padLeftRatio
                padRightRatio = res.padRightRatio
                padTopRatio = res.padTopRatio
                padBottomRatio = res.padBottomRatio
              }
            }
          } catch {
            // ignore
          }

          const widthVx = maxX - minVx
          const heightVy = maxY - minVy

          // Content-aware bounding box that strictly trims transparent/empty edge padding
          // so adjacent lines, table borders, and headers are NEVER clipped or whited out!
          const contentMinVx = minVx + padLeftRatio * widthVx
          const contentMaxVx = maxX - padRightRatio * widthVx
          const contentMinVy = minVy + padTopRatio * heightVy
          const contentMaxVy = maxY - padBottomRatio * heightVy

          const xPercent = (contentMinVx / viewport.width) * 100
          const yPercent = (contentMinVy / viewport.height) * 100
          const widthPercent = ((contentMaxVx - contentMinVx) / viewport.width) * 100
          const heightPercent = ((contentMaxVy - contentMinVy) / viewport.height) * 100

          // Filter out tiny artifacts (<2%) or full-page backgrounds (>92%)
          if (widthPercent < 2 || heightPercent < 2) continue
          if (widthPercent > 92 && heightPercent > 92) continue

          // Filter out images completely outside or overflowing page boundaries
          if (
            xPercent < -5 ||
            yPercent < -5 ||
            xPercent > 98 ||
            yPercent > 98 ||
            xPercent + widthPercent > 105 ||
            yPercent + heightPercent > 105
          ) {
            continue
          }

          const roundedX = Math.max(0, Math.min(98, Math.round(xPercent * 100) / 100))
          const roundedY = Math.max(0, Math.min(98, Math.round(yPercent * 100) / 100))
          const roundedW = Math.min(100, Math.round(widthPercent * 100) / 100)
          const roundedH = Math.min(100, Math.round(heightPercent * 100) / 100)

          const pdfWidth = contentMaxVx - contentMinVx
          const pdfHeight = contentMaxVy - contentMinVy
          const pdfX = contentMinVx
          const pdfY = viewport.height - contentMaxVy

          images.push({
            id: `orig_img_${pageNumber}_${imgName}_${i}`,
            imgId: imgName,
            pageNumber,
            x: roundedX,
            y: roundedY,
            width: roundedW,
            height: roundedH,
            origX: roundedX,
            origY: roundedY,
            origWidth: roundedW,
            origHeight: roundedH,
            rotation: 0,
            dataUrl,
            isDeleted: false,
            isModified: false,
            pdfX,
            pdfY,
            pdfWidth,
            pdfHeight,
          })
        }
      }

      return images
    } catch (err) {
      console.warn('Failed to extract embedded images:', err)
      return []
    }
  }

  /**
   * Extracts document outline (TOC / Bookmarks)
   */
  static async extractDocumentOutline(
    pdfDoc: pdfjsLib.PDFDocumentProxy
  ): Promise<PdfOutlineItem[]> {
    try {
      const outline = await pdfDoc.getOutline()
      if (!outline || outline.length === 0) return []

      const processItems = async (items: any[]): Promise<PdfOutlineItem[]> => {
        const result: PdfOutlineItem[] = []

        for (const item of items) {
          let pageNum = 0
          if (typeof item.dest === 'string') {
            try {
              const dest = await pdfDoc.getDestination(item.dest)
              if (dest && dest[0]) {
                const pageIndex = await pdfDoc.getPageIndex(dest[0])
                pageNum = pageIndex + 1
              }
            } catch {
              // ignore
            }
          } else if (Array.isArray(item.dest) && item.dest[0]) {
            try {
              const pageIndex = await pdfDoc.getPageIndex(item.dest[0])
              pageNum = pageIndex + 1
            } catch {
              // ignore
            }
          }

          const children =
            item.items && item.items.length > 0 ? await processItems(item.items) : undefined

          result.push({
            title: item.title,
            pageNumber: pageNum,
            dest: item.dest,
            items: children,
          })
        }

        return result
      }

      return await processItems(outline)
    } catch (err) {
      console.warn('Failed to extract document outline:', err)
      return []
    }
  }
}
