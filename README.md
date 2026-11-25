# VELDORA – Professional Local-First PDF Editor

VELDORA is a high-performance, privacy-focused PDF editor and document toolkit designed for both Desktop (Electron) and Web (React + Vite). All document operations (merging, splitting, compression, signing, and annotating) are executed **100% locally** on the user's device.

## Key Features

- **Dashboard**: Minimalist dark-mode hub with drag-and-drop document loading and recent file history.
- **PDF Viewer & Canvas**: Smooth page rendering, zoom controls, fit-page/fit-width, and thumbnail navigation.
- **PDF Manipulation**:
  - **Split PDF**: Extract specific page ranges or individual pages.
  - **Merge PDF**: Combine multiple PDFs with custom ordering.
  - **Organize Pages**: Delete pages, reorder pages, or insert blank pages.
  - **Compress PDF**: Optimize document file size with Low, Medium, and High compression profiles.
  - **Sign PDF**: Interactive stylus/mouse signature drawing pad or image signature placement.
  - **Convert**: PDF to high-resolution PNG/JPG (packaged into ZIP) and Image to PDF conversion.
  - **Annotations & Editing**: Add custom text, highlights, shapes (rectangles, circles, arrows, lines), and stamps.
  - **Export & Save**: Burn annotations and export valid standard PDFs.

## Tech Stack

- **Frontend**: React 18, TypeScript, Tailwind CSS, Lucide Icons, Zustand
- **PDF Engine**: `pdfjs-dist` (viewer & canvas rendering), `pdf-lib` (local-first PDF manipulation), `jszip`
- **Desktop Runtime**: Electron 34 with secure context isolation and preload IPC bridge
- **Build Tool**: Vite 6, Electron Builder

## Getting Started

### Development (Web Mode)
```bash
npm run dev
```

### Development (Desktop / Electron Mode)
```bash
npm run electron:dev
```

### Production Build
```bash
npm run build
```

## Security & Privacy
- **Node Integration**: Disabled in renderer (`contextIsolation: true`)
- **Zero Cloud Leak**: Documents are never transmitted over the network.

