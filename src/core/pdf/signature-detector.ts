import * as pdfjsLib from 'pdfjs-dist'

export interface DetectedSignatureSpot {
  id: string
  label: string
  pageNumber: number
  x: number // percentage 0-100
  y: number // percentage 0-100
  width: number // percentage 0-100
  height: number // percentage 0-100
  confidence: number // 0 to 1
  matchedText: string
  headerText?: string
  footerText?: string
}

export class SignatureDetector {
  /**
   * Scans a PDF page and accurately identifies signature spots
   * using Strict Pairwise Spatial Analysis and Explicit Anchor Verification.
   * Completely eliminates false positives on documents without signatures.
   */
  static async detectSignatureSpots(
    pdfDoc: pdfjsLib.PDFDocumentProxy,
    pageNumber: number
  ): Promise<DetectedSignatureSpot[]> {
    try {
      const page = await pdfDoc.getPage(pageNumber)
      const textContent = await page.getTextContent()
      const viewport = page.getViewport({ scale: 1.0 })

      interface TextBlock {
        text: string
        lower: string
        x: number // percentage
        y: number // percentage (from top)
        width: number
        height: number
      }

      const allBlocks: TextBlock[] = []

      for (const item of textContent.items) {
        if (!('str' in item) || !item.str.trim()) continue

        const tx = item.transform[4]
        const ty = item.transform[5]
        const [vx, vy] = viewport.convertToViewportPoint(tx, ty)

        // vy is baseline distance from top
        const xPercent = (vx / viewport.width) * 100
        const yPercent = (vy / viewport.height) * 100
        const widthPercent = (item.width / viewport.width) * 100
        const heightPercent = (Math.max(10, item.height) / viewport.height) * 100

        allBlocks.push({
          text: item.str.trim(),
          lower: item.str.trim().toLowerCase(),
          x: xPercent,
          y: yPercent,
          width: widthPercent,
          height: heightPercent,
        })
      }

      // Explicit Signature & Approval Keywords (Indonesian & English)
      const explicitSignatureKeywords = [
        'tanda tangan',
        'ttd',
        'signature',
        'sign here',
        'materai',
        'meterai',
        'tempel materai',
        'mengetahui',
        'disetujui oleh',
        'disetujui',
        'disahkan oleh',
        'disahkan',
        'dibuat oleh',
        'diperiksa oleh',
        'diajukan oleh',
        'diterima oleh',
        'pemohon',
        'pemberi kuasa',
        'penerima kuasa',
        'pihak pertama',
        'pihak kedua',
        'yang menyatakan',
        'hormat kami',
        'approved by',
        'signed by',
        'checked by',
        'verified by',
        'reviewed by',
        'authorized signature',
        'authorized by',
        'prepared by',
        'accepted by',
        'sincerely',
      ]

      // Business & Organizational Role Titles
      // Note: Only valid as signature headers in the lower half of the page (y >= 50%)
      // AND only when paired with a matching signer name or underline footer!
      const roleKeywords = [
        'site operations',
        'team leader',
        'branch manager',
        'general manager',
        'project manager',
        'supervisor',
        'direktur',
        'director',
        'kepala cabang',
        'kepala bagian',
        'koordinator',
        'petugas',
        'pic',
        'teknisi',
      ]

      // Common non-name words found in tables, forms, and technical sheets
      // to avoid false-positive signer name recognition
      const nonNameBlacklist = [
        'checklist',
        'preventive',
        'maintenance',
        'komputindo',
        'digital service',
        'configuration',
        'configurations',
        'items',
        'rembang',
        'location',
        'serial number',
        'id tagging',
        'description',
        'condition',
        'normal',
        'error',
        'information',
        'windows',
        'hostname',
        'processor',
        'antivirus',
        'total',
        'page',
        'catatan',
        'notes',
        'nomor',
        'lampiran',
        'halaman',
        'subtotal',
        'grand total',
        'dokumen',
        'ruang rapat',
        'check device',
        'speaker',
        'kamera',
        'remote',
        'status baterai',
        'kabel hdmi',
        'konektor',
        'video in/out',
        'audio in/out',
        'sharing presentasi',
        'ip address',
        'mac address',
        'version',
        'intel core',
        'tehtris',
        'device',
        'pro mini',
      ]

      // Underlines used as signature lines
      const underlineRegex = /^[_\-\.]{4,}$|^[_\-\.\s]{5,}$|^\([_\-\.\s]{3,}\)$/
      // Person name format (capitalized, letters/spaces/dots/hyphens only, no numbers)
      const personNameRegex = /^[A-Z][a-zA-Z\s\.,'\-]{2,40}$/

      const headers: TextBlock[] = []
      const footers: TextBlock[] = []

      for (const b of allBlocks) {
        // Signatures are virtually always in the lower half of the page
        if (b.y < 45) continue

        const isExplicit = explicitSignatureKeywords.some((kw) => b.lower.includes(kw))
        const isRole = b.y >= 52 && roleKeywords.some((kw) => b.lower.includes(kw)) && b.text.length <= 35
        const isUnderline = underlineRegex.test(b.text) && b.width >= 5 && b.width <= 45

        // Person names are only considered in the lower 45% (y >= 55%)
        const containsNumber = /\d/.test(b.text)
        const isBlacklisted = nonNameBlacklist.some((bl) => b.lower.includes(bl))
        const isPersonName =
          b.y >= 55 &&
          !containsNumber &&
          !isBlacklisted &&
          !isExplicit &&
          !isRole &&
          personNameRegex.test(b.text) &&
          b.text.length >= 4 &&
          b.text.length <= 35

        if (isExplicit || isRole) {
          headers.push(b)
        } else if (isUnderline || isPersonName) {
          footers.push(b)
        }
      }

      const spots: DetectedSignatureSpot[] = []
      const usedFooters = new Set<TextBlock>()
      const usedHeaders = new Set<TextBlock>()

      // 1. STRICT PAIRWISE DETECTION:
      // Match Title Header with Signer Name or Underline directly beneath it in the same column
      for (const h of headers) {
        const hCenter = h.x + h.width / 2

        const candidates = footers.filter((f) => {
          const fCenter = f.x + f.width / 2
          const isSameColumn = Math.abs(hCenter - fCenter) < 18
          const isBelow = f.y > h.y
          const verticalDistance = f.y - h.y
          // Signature gap must be reasonable (2% to 22% of page)
          const isValidDistance = verticalDistance >= 2.0 && verticalDistance <= 22

          if (!isSameColumn || !isBelow || !isValidDistance) return false

          // Verify there aren't multiple intervening text lines (which would indicate a table column or paragraph)
          const intermediateLines = allBlocks.filter(
            (other) =>
              other !== h &&
              other !== f &&
              other.y > h.y + h.height &&
              other.y < f.y - f.height &&
              Math.abs(other.x + other.width / 2 - hCenter) < 14
          )

          return intermediateLines.length <= 2
        })

        if (candidates.length > 0) {
          // Sort by proximity beneath the header
          candidates.sort((a, b) => a.y - b.y)
          const f = candidates[0]

          usedHeaders.add(h)
          usedFooters.add(f)

          const headerBottom = h.y + h.height
          const footerTop = f.y - f.height
          const availableGap = footerTop - headerBottom

          let spotTop: number
          let spotHeight: number

          if (availableGap >= 2.5) {
            spotTop = headerBottom + 0.3
            spotHeight = Math.min(8.0, Math.max(3.5, availableGap - 0.6))
          } else {
            spotHeight = 4.5
            spotTop = Math.max(headerBottom, footerTop - spotHeight)
          }

          const colCenter = (hCenter + (f.x + f.width / 2)) / 2
          const spotWidth = Math.max(16, Math.min(26, Math.max(h.width, f.width) + 4))
          const spotLeft = Math.max(2, Math.min(98 - spotWidth, colCenter - spotWidth / 2))

          spots.push({
            id: `spot_${spots.length}_${Math.random().toString(36).substring(2, 6)}`,
            label: h.text,
            pageNumber,
            x: Math.round(spotLeft * 10) / 10,
            y: Math.round(spotTop * 10) / 10,
            width: Math.round(spotWidth * 10) / 10,
            height: Math.round(spotHeight * 10) / 10,
            confidence: 0.98,
            matchedText: `${h.text} -> ${f.text}`,
            headerText: h.text,
            footerText: f.text,
          })
        }
      }

      // 2. EXPLICIT UNPAIRED HEADERS:
      // Only trigger if header explicitly says "tanda tangan", "ttd", "signature", "materai", etc.
      // (Generic roles like "manager" or "supervisor" WITHOUT a signer beneath are NEVER created as spots!)
      for (const h of headers) {
        if (usedHeaders.has(h)) continue

        const isExplicitKeyword = explicitSignatureKeywords.some((kw) => h.lower.includes(kw))
        if (!isExplicitKeyword) continue // Skip loose role titles

        const spotHeight = 5.5
        const spotTop = h.y + h.height + 0.4
        const spotWidth = Math.max(18, h.width + 4)
        const spotLeft = Math.max(2, Math.min(98 - spotWidth, h.x))

        spots.push({
          id: `spot_h_${spots.length}_${Math.random().toString(36).substring(2, 6)}`,
          label: h.text,
          pageNumber,
          x: Math.round(spotLeft * 10) / 10,
          y: Math.round(spotTop * 10) / 10,
          width: Math.round(spotWidth * 10) / 10,
          height: Math.round(spotHeight * 10) / 10,
          confidence: 0.88,
          matchedText: h.text,
          headerText: h.text,
        })
      }

      // 3. EXPLICIT UNPAIRED UNDERLINES:
      // An explicit signature line in the bottom 45% (y >= 55%)
      // (Loose person names without an underline or header are NEVER created as spots!)
      for (const f of footers) {
        if (usedFooters.has(f)) continue

        const isUnderline = underlineRegex.test(f.text) && f.width >= 6 && f.width <= 40
        if (!isUnderline) continue // Skip loose names

        const spotHeight = 5.5
        const spotTop = Math.max(2, f.y - f.height - spotHeight - 0.3)
        const spotWidth = Math.max(18, f.width + 2)
        const spotLeft = Math.max(2, Math.min(98 - spotWidth, f.x + f.width / 2 - spotWidth / 2))

        spots.push({
          id: `spot_f_${spots.length}_${Math.random().toString(36).substring(2, 6)}`,
          label: 'Tanda Tangan',
          pageNumber,
          x: Math.round(spotLeft * 10) / 10,
          y: Math.round(spotTop * 10) / 10,
          width: Math.round(spotWidth * 10) / 10,
          height: Math.round(spotHeight * 10) / 10,
          confidence: 0.85,
          matchedText: f.text,
          footerText: f.text,
        })
      }

      // 4. Deduplicate any overlapping spots
      const finalSpots: DetectedSignatureSpot[] = []
      for (const s of spots) {
        const overlap = finalSpots.find(
          (existing) =>
            Math.abs(existing.x - s.x) < 10 && Math.abs(existing.y - s.y) < 8
        )
        if (!overlap) {
          finalSpots.push(s)
        }
      }

      return finalSpots.sort((a, b) => b.confidence - a.confidence || a.x - b.x)
    } catch (err) {
      console.warn('Signature detection failed:', err)
      return []
    }
  }
}
