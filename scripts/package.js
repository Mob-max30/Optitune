import fs from 'node:fs';
import path from 'node:path';
import archiverModule from 'archiver';

const archiver = archiverModule.default || archiverModule;

const rootDir = process.cwd();
const distDir = path.resolve(rootDir, 'extension/dist');
const releasesDir = path.resolve(rootDir, 'releases');

if (!fs.existsSync(distDir)) {
  console.error('[Package Error] extension/dist does not exist. Run "npm run build" first.');
  process.exit(1);
}

const pkg = JSON.parse(fs.readFileSync(path.resolve(rootDir, 'package.json'), 'utf-8'));
const version = pkg.version || '1.1.1';
const zipName = `optitone-v${version}.zip`;

fs.mkdirSync(releasesDir, { recursive: true });
const zipPath = path.resolve(releasesDir, zipName);

const output = fs.createWriteStream(zipPath);
const archive = archiver('zip', {
  zlib: { level: 9 } // Maximum compression
});

output.on('close', () => {
  const bytes = archive.pointer();
  const kb = (bytes / 1024).toFixed(1);
  console.log(`[Package Success] Created release archive: releases/${zipName} (${kb} KB)`);
});

archive.on('error', (err) => {
  throw err;
});

archive.pipe(output);
archive.directory(distDir, false);
archive.finalize();
