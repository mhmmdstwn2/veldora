import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron'
import renderer from 'vite-plugin-electron-renderer'
import path from 'path'

export default defineConfig(({ mode }) => {
  const isElectron = process.env.ELECTRON === 'true'

  return {
    base: './',
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    plugins: [
      react(),
      ...(isElectron
        ? [
            electron([
              {
                entry: 'electron/main.ts',
                vite: {
                  build: {
                    outDir: 'dist-electron',
                    lib: {
                      entry: 'electron/main.ts',
                      formats: ['cjs'],
                      fileName: () => 'main.cjs',
                    },
                    rollupOptions: {
                      external: ['electron', 'electron-updater'],
                    },
                  },
                },
              },
              {
                entry: 'electron/preload.ts',
                onstart(options) {
                  options.reload()
                },
                vite: {
                  build: {
                    outDir: 'dist-electron',
                    lib: {
                      entry: 'electron/preload.ts',
                      formats: ['cjs'],
                      fileName: () => 'preload.cjs',
                    },
                  },
                },
              },
            ]),
            renderer(),
          ]
        : []),
    ],
    server: {
      port: 5173,
    },
    build: {
      outDir: 'dist',
    },
  }
})

