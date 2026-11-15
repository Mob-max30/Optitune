import { build } from 'vite';
import { resolve } from 'node:path';
import fs from 'node:fs';

const rootDir = process.cwd();
const extDir = resolve(rootDir, 'extension');
const distDir = resolve(extDir, 'dist');

async function buildAll() {
  console.log('[Build] Cleaning extension dist directory...');
  if (fs.existsSync(distDir)) {
    fs.rmSync(distDir, { recursive: true, force: true });
  }
  fs.mkdirSync(distDir, { recursive: true });

  // 1. Build Content Script as self-contained IIFE (no imports, injects cleanly into any page)
  console.log('[Build] Compiling content.js (IIFE)...');
  await build({
    configFile: false,
    build: {
      emptyOutDir: false,
      outDir: distDir,
      target: 'es2022',
      lib: {
        entry: resolve(extDir, 'src/content/index.ts'),
        name: 'EarthJukeboxContent',
        formats: ['iife'],
        fileName: () => 'content.js'
      }
    }
  });

  // 2. Build Service Worker (ES module)
  console.log('[Build] Compiling service-worker.js (ES module)...');
  await build({
    configFile: false,
    build: {
      emptyOutDir: false,
      outDir: distDir,
      target: 'es2022',
      lib: {
        entry: resolve(extDir, 'src/background/service-worker.ts'),
        formats: ['es'],
        fileName: () => 'service-worker.js'
      }
    }
  });

  // 3. Build Popup and Offscreen HTML pages
  console.log('[Build] Compiling popup and offscreen HTML...');
  await build({
    configFile: false,
    root: resolve(extDir, 'src'),
    publicDir: resolve(extDir, 'public'),
    build: {
      emptyOutDir: false,
      outDir: distDir,
      target: 'es2022',
      rollupOptions: {
        input: {
          popup: resolve(extDir, 'src/popup/popup.html'),
          offscreen: resolve(extDir, 'src/offscreen/offscreen.html')
        },
        output: {
          chunkFileNames: 'assets/[name]-[hash].js',
          assetFileNames: 'assets/[name]-[hash].[ext]'
        }
      }
    }
  });

  // 5. Move HTML files to root of dist and copy manifest
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

  // Copy manifest.json
  const manifestSrc = resolve(extDir, 'manifest.json');
  const manifestDest = resolve(distDir, 'manifest.json');
  fs.copyFileSync(manifestSrc, manifestDest);

  // Copy icons if not copied
  const iconsSrc = resolve(extDir, 'public/icons');
  const iconsDest = resolve(distDir, 'icons');
  if (fs.existsSync(iconsSrc) && !fs.existsSync(iconsDest)) {
    fs.cpSync(iconsSrc, iconsDest, { recursive: true });
  }

  console.log('[Build] Extension build complete: extension/dist is ready to load unpacked!');
}

buildAll().catch((err) => {
  console.error('[Build Error]:', err);
  process.exit(1);
});
