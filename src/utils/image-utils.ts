/**
 * Calculates responsive width and height for a replacement image
 * so that it fits gracefully within the document layout while preserving
 * its natural aspect ratio.
 */
export function calculateFittedDimensions(
  currentW: number,
  currentH: number,
  naturalW: number,
  naturalH: number
): { width: number; height: number } {
  if (!naturalW || !naturalH || naturalW <= 0 || naturalH <= 0) {
    return { width: currentW, height: currentH }
  }

  const aspect = naturalW / naturalH
  const maxDim = Math.max(currentW, currentH)

  let w: number
  let h: number

  if (aspect >= 1) {
    // Landscape or square
    w = Math.min(92, Math.max(currentW, maxDim))
    h = w / aspect
    if (h > 88) {
      h = 88
      w = h * aspect
    }
  } else {
    // Portrait
    h = Math.min(88, Math.max(currentH, maxDim))
    w = h * aspect
    if (w > 92) {
      w = 92
      h = w / aspect
    }
  }

  return {
    width: Math.round(w * 10) / 10,
    height: Math.round(h * 10) / 10,
  }
}

export interface ExtractedImageResult {
  dataUrl: string
  padLeftRatio: number
  padRightRatio: number
  padTopRatio: number
  padBottomRatio: number
}

/**
 * Converts raw PDF.js image object (ImageBitmap, HTMLCanvasElement, ImageData, or raw pixel buffer)
 * to a PNG data URL, trimming empty / transparent / white edge margins so that adjacent
 * lines, borders, and backgrounds are never covered or clipped by whiteout patches.
 */
export function extractImageWithContentBounds(imgData: any): ExtractedImageResult | null {
  if (!imgData) return null
  if (typeof document === 'undefined') return null

  try {
    const width =
      imgData.width ||
      imgData.naturalWidth ||
      (imgData.bitmap && imgData.bitmap.width) ||
      (typeof ImageBitmap !== 'undefined' && imgData instanceof ImageBitmap ? imgData.width : 0) ||
      100
    const height =
      imgData.height ||
      imgData.naturalHeight ||
      (imgData.bitmap && imgData.bitmap.height) ||
      (typeof ImageBitmap !== 'undefined' && imgData instanceof ImageBitmap ? imgData.height : 0) ||
      100

    if (width <= 0 || height <= 0) return null

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) return null

    // 1. Direct ImageBitmap / Canvas / HTMLImageElement
    const bitmapSource =
      imgData.bitmap ||
      (typeof ImageBitmap !== 'undefined' && imgData instanceof ImageBitmap ? imgData : null)

    if (bitmapSource) {
      ctx.drawImage(bitmapSource, 0, 0)
    } else if (
      (typeof HTMLImageElement !== 'undefined' && imgData instanceof HTMLImageElement) ||
      (typeof HTMLCanvasElement !== 'undefined' && imgData instanceof HTMLCanvasElement)
    ) {
      ctx.drawImage(imgData, 0, 0)
    } else if (typeof ImageData !== 'undefined' && imgData instanceof ImageData) {
      ctx.putImageData(imgData, 0, 0)
    } else if (imgData.data) {
      const imgDataObj = ctx.createImageData(width, height)
      const d = imgDataObj.data
      const src = imgData.data

      if (imgData.kind === 2) {
        // RGB (3 bytes per pixel)
        let sIdx = 0
        let dIdx = 0
        const len = width * height
        for (let i = 0; i < len; i++) {
          d[dIdx] = src[sIdx]
          d[dIdx + 1] = src[sIdx + 1]
          d[dIdx + 2] = src[sIdx + 2]
          d[dIdx + 3] = 255
          sIdx += 3
          dIdx += 4
        }
      } else if (imgData.kind === 3) {
        // RGBA (4 bytes per pixel)
        d.set(src)
      } else if (imgData.kind === 1) {
        // Grayscale (1 byte per pixel)
        let dIdx = 0
        for (let i = 0; i < src.length; i++) {
          const g = src[i]
          d[dIdx] = g
          d[dIdx + 1] = g
          d[dIdx + 2] = g
          d[dIdx + 3] = 255
          dIdx += 4
        }
      } else {
        d.set(src)
      }

      ctx.putImageData(imgDataObj, 0, 0)
    } else {
      return null
    }

    // Inspect pixel data to determine true visible non-empty content bounding box
    let minX = width
    let maxX = 0
    let minY = height
    let maxY = 0
    let hasContent = false

    try {
      const pixelData = ctx.getImageData(0, 0, width, height).data
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const idx = (y * width + x) * 4
          const a = pixelData[idx + 3]
          if (a > 15) {
            const r = pixelData[idx]
            const g = pixelData[idx + 1]
            const b = pixelData[idx + 2]
            // Any colored pixel that is not pure white paper background
            if (r < 250 || g < 250 || b < 250) {
              hasContent = true
              if (x < minX) minX = x
              if (x > maxX) maxX = x
              if (y < minY) minY = y
              if (y > maxY) maxY = y
            }
          }
        }
      }
    } catch {
      // If getImageData fails (e.g. cross-origin canvas), fallback to full box
      hasContent = false
    }

    // If no distinct non-white content was found, or if content fills entire frame
    if (!hasContent || (minX === 0 && maxX >= width - 1 && minY === 0 && maxY >= height - 1)) {
      return {
        dataUrl: canvas.toDataURL('image/png'),
        padLeftRatio: 0,
        padRightRatio: 0,
        padTopRatio: 0,
        padBottomRatio: 0,
      }
    }

    const padLeftRatio = minX / width
    const padRightRatio = (width - 1 - maxX) / width
    const padTopRatio = minY / height
    const padBottomRatio = (height - 1 - maxY) / height

    // Crop the canvas to the true visible content
    const cropW = Math.max(1, maxX - minX + 1)
    const cropH = Math.max(1, maxY - minY + 1)
    const cropCanvas = document.createElement('canvas')
    cropCanvas.width = cropW
    cropCanvas.height = cropH
    const cropCtx = cropCanvas.getContext('2d')

    if (cropCtx) {
      cropCtx.drawImage(canvas, minX, minY, cropW, cropH, 0, 0, cropW, cropH)
      return {
        dataUrl: cropCanvas.toDataURL('image/png'),
        padLeftRatio,
        padRightRatio,
        padTopRatio,
        padBottomRatio,
      }
    }

    return {
      dataUrl: canvas.toDataURL('image/png'),
      padLeftRatio,
      padRightRatio,
      padTopRatio,
      padBottomRatio,
    }
  } catch (err) {
    console.warn('Failed to extract image with content bounds:', err)
    return null
  }
}

/**
 * Converts raw PDF.js image object to a PNG data URL directly.
 */
export function imageObjToDataUrl(imgData: any): string | null {
  return extractImageWithContentBounds(imgData)?.dataUrl ?? null
}

/**
 * Returns exact native CSS font family matching PDF font metadata
 */
export function getCssFontFamily(fontFamily?: string): string {
  if (!fontFamily) return `'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`
  const lower = fontFamily.toLowerCase()

  if (lower.includes('dejavu')) {
    return `'DejaVu Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif`
  }
  if (lower.includes('lato')) {
    return `'Lato', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`
  }
  if (lower.includes('roboto')) {
    return `'Roboto', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`
  }
  if (lower.includes('calibri')) {
    return `'Calibri', 'Segoe UI', Arial, sans-serif`
  }
  if (lower.includes('arial') || lower.includes('helvetica')) {
    return `'Helvetica Neue', Helvetica, Arial, sans-serif`
  }
  if (lower.includes('times') || lower.includes('roman') || lower.includes('serif')) {
    return `'Times New Roman', Times, Georgia, serif`
  }
  if (lower.includes('courier') || lower.includes('mono')) {
    return `'Courier New', Courier, monospace`
  }

  const cleanName = fontFamily.replace(/-?(Bold|Italic|Regular|Medium|Light)/gi, '').trim()
  return `'${cleanName}', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif`
}

