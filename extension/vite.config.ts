import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import fs from 'node:fs';

export default defineConfig({
  root: resolve(__dirname, 'src'),
  publicDir: resolve(__dirname, 'public'),
  build: {
    outDir: resolve(__dirname, 'dist'),
    emptyOutDir: true,
    target: 'es2022',
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'src/popup/popup.html'),
        offscreen: resolve(__dirname, 'src/offscreen/offscreen.html'),
        content: resolve(__dirname, 'src/content/index.ts'),
        'service-worker': resolve(__dirname, 'src/background/service-worker.ts'),
        'analyzer.worker': resolve(__dirname, 'src/worker/analyzer.worker.ts')
      },
      output: {
        entryFileNames: (chunkInfo) => {
          if (chunkInfo.name === 'content') return 'content.js';
          if (chunkInfo.name === 'service-worker') return 'service-worker.js';
          if (chunkInfo.name === 'analyzer.worker') return 'analyzer.worker.js';
          return 'assets/[name]-[hash].js';
        },
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]'
      }
    }
  },
  plugins: [
    {
      name: 'copy-extension-manifest-and-html',
      closeBundle() {
        const distDir = resolve(__dirname, 'dist');
        const manifestSrc = resolve(__dirname, 'manifest.json');
        const manifestDest = resolve(distDir, 'manifest.json');

        if (fs.existsSync(manifestSrc)) {
          fs.copyFileSync(manifestSrc, manifestDest);
        }

        // Ensure popup.html and offscreen.html are at the root of dist if Vite placed them in nested folders
        const popupSrc = resolve(distDir, 'popup/popup.html');
        const popupDest = resolve(distDir, 'popup.html');
        if (fs.existsSync(popupSrc)) {
          fs.renameSync(popupSrc, popupDest);
        }

        const offscreenSrc = resolve(distDir, 'offscreen/offscreen.html');
        const offscreenDest = resolve(distDir, 'offscreen.html');
        if (fs.existsSync(offscreenSrc)) {
          fs.renameSync(offscreenSrc, offscreenDest);
        }
      }
    }
  ]
});
