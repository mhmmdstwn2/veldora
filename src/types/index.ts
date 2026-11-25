export type ToolType =
  | 'select'
  | 'hand'
  | 'edit-text' // Real original text editing
  | 'edit-image' // Real original image editing
  | 'text' // Add new text
  | 'whiteout' // Whiteout & replace
  | 'highlight'
  | 'comment'
  | 'rect'
  | 'circle'
  | 'line'
  | 'arrow'
  | 'image' // Add new image
  | 'sign'
  | 'redact' // True PDF content redaction
  | 'watermark'
  | 'page-number'
  | 'crop'
  | 'split'
  | 'merge'
  | 'insert'
  | 'delete'
  | 'compress'
  | 'convert'
  | 'ocr'

export type FitMode = 'fit-width' | 'fit-page' | 'custom'

export interface PageThumbnail {
  pageNumber: number
  dataUrl?: string
  width: number
  height: number
  rotation: number
  isDeleted?: boolean
}

export interface AnnotationItem {
  id: string
  type: 'highlight' | 'text' | 'comment' | 'shape' | 'signature' | 'image' | 'redact'
  pageNumber: number
  x: number // percentage 0-100
  y: number // percentage 0-100
  width?: number
  height?: number
  color?: string
  backgroundColor?: string
  opacity?: number
  strokeWidth?: number
  text?: string
  fontSize?: number
  fontFamily?: string
  shapeType?: 'rect' | 'circle' | 'line' | 'arrow'
  dataUrl?: string
  author?: string
  resolved?: boolean
  createdAt: number
}

// Real Original PDF Text Element
export interface PdfTextElement {
  id: string
  pageNumber: number
  text: string
  originalText: string
  x: number // percentage 0-100
  y: number // percentage 0-100
  width: number // percentage
  height: number // percentage
  origX?: number
  origY?: number
  origWidth?: number
  origHeight?: number
  pdfX?: number
  pdfBaselineY?: number
  pdfWidth?: number
  pdfHeight?: number
  fontSize: number
  fontFamily: string
  fontWeight?: string | number
  fontStyle?: string
  color: string
  backgroundColor?: string
  alignment?: 'left' | 'center' | 'right'
  lineHeight?: number
  lineCount?: number
  isModified?: boolean
  isDeleted?: boolean
  blockIndex?: number
  blockIndices?: number[]
  opIndex?: number
  opIndices?: number[]
}

// Real Original Embedded PDF Image Element
export interface PdfImageElement {
  id: string
  imgId: string
  pageNumber: number
  x: number // percentage 0-100
  y: number // percentage 0-100
  width: number // percentage
  height: number // percentage
  origX?: number
  origY?: number
  origWidth?: number
  origHeight?: number
  rotation: number
  dataUrl?: string
  isDeleted?: boolean
  isModified?: boolean
  replacementDataUrl?: string
  pdfX?: number
  pdfY?: number
  pdfWidth?: number
  pdfHeight?: number
}

// Document Outline / Bookmarks
export interface PdfOutlineItem {
  title: string
  pageNumber: number
  dest?: any
  items?: PdfOutlineItem[]
}

export interface DocumentInfo {
  name: string
  path?: string
  size: number
  pageCount: number
  data: Uint8Array
  lastModified?: number
}

export interface RecentDocument {
  id: string
  name: string
  path?: string
  size: number
  pageCount: number
  lastOpened: string
}

export interface SplitRange {
  id: string
  from: number
  to: number
  name?: string
}

export interface MergeFileItem {
  id: string
  name: string
  size: number
  pageCount?: number
  data: Uint8Array
}

export interface CompressOptions {
  level: 'low' | 'medium' | 'high'
  imageQuality: number
}

export interface ConvertOptions {
  format: 'jpg' | 'png' | 'docx' | 'xlsx'
  dpi?: number
}

export interface DetectedSignatureSpot {
  id: string
  label: string
  pageNumber: number
  x: number
  y: number
  width: number
  height: number
  confidence: number
  matchedText: string
  headerText?: string
  footerText?: string
}

export interface OcrProgress {
  status: string
  progress: number // 0 to 1
  page: number
  totalPages: number
}

export interface WatermarkOptions {
  text: string
  color: string
  fontSize: number
  opacity: number
  rotation: number
  pages: 'all' | 'custom'
  pageRange?: string
}

export interface PageNumberOptions {
  format: '1' | '1 / N' | 'Page 1 of N' | '- 1 -'
  position: 'bottom-center' | 'bottom-right' | 'bottom-left' | 'top-center' | 'top-right'
  fontSize: number
  startNumber: number
}

export interface CropOptions {
  pageNumber: number
  top: number // percentage
  bottom: number
  left: number
  right: number
}

export type SelectedObjectType = 'text' | 'image' | 'annotation' | 'page'

export interface SelectedObject {
  type: SelectedObjectType
  id: string
  data: any
}
