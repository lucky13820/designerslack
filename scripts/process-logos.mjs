#!/usr/bin/env node

/**
 * Downloads all community logos from external URLs, converts them to WebP,
 * and updates the data files to use local paths.
 *
 * Usage: node scripts/process-logos.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DATA_PATH = path.join(ROOT, 'data', 'communities.json');
const DATA_JS_PATH = path.join(ROOT, 'js', 'data.js');
const LOGOS_DIR = path.join(ROOT, 'images', 'logos');

const WEBP_OPTIONS = { quality: 80 };
const RESIZE_WIDTH = 256; // max width for logos
const CONCURRENCY = 5;
const TIMEOUT_MS = 15000;

async function downloadBuffer(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'DesignerSlack-LogoFetcher/1.0' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  } finally {
    clearTimeout(timer);
  }
}

async function processLogo(community) {
  const { slug, logoUrl, name } = community;
  if (!logoUrl) {
    console.log(`  SKIP (no URL): ${name}`);
    return community;
  }

  const outFile = path.join(LOGOS_DIR, `${slug}.webp`);
  const localPath = `images/logos/${slug}.webp`;

  // Skip if already processed
  if (fs.existsSync(outFile)) {
    console.log(`  CACHED: ${name}`);
    return { ...community, logoUrl: localPath };
  }

  try {
    console.log(`  DOWNLOAD: ${name} — ${logoUrl}`);
    const buf = await downloadBuffer(logoUrl);

    await sharp(buf)
      .resize(RESIZE_WIDTH, RESIZE_WIDTH, { fit: 'inside', withoutEnlargement: true })
      .webp(WEBP_OPTIONS)
      .toFile(outFile);

    console.log(`  OK: ${name} → ${localPath}`);
    return { ...community, logoUrl: localPath };
  } catch (err) {
    console.error(`  FAIL: ${name} — ${err.message}`);
    return community; // keep original URL on failure
  }
}

async function processBatch(communities, start, batchSize) {
  const batch = communities.slice(start, start + batchSize);
  return Promise.all(batch.map((c) => processLogo(c)));
}

async function main() {
  fs.mkdirSync(LOGOS_DIR, { recursive: true });

  const communities = JSON.parse(fs.readFileSync(DATA_PATH, 'utf-8'));
  console.log(`Processing ${communities.length} communities...\n`);

  const results = [];
  for (let i = 0; i < communities.length; i += CONCURRENCY) {
    const batch = await processBatch(communities, i, CONCURRENCY);
    results.push(...batch);
  }

  // Write updated communities.json
  fs.writeFileSync(DATA_PATH, JSON.stringify(results, null, 2) + '\n');
  console.log(`\nUpdated ${DATA_PATH}`);

  // Write updated data.js
  const dataJs = 'const COMMUNITIES_DATA = ' + JSON.stringify(results, null, 2) + ';\n';
  fs.writeFileSync(DATA_JS_PATH, dataJs);
  console.log(`Updated ${DATA_JS_PATH}`);

  // Summary
  const downloaded = results.filter((c) => c.logoUrl.startsWith('images/')).length;
  const empty = results.filter((c) => !c.logoUrl).length;
  const failed = results.filter((c) => c.logoUrl && !c.logoUrl.startsWith('images/')).length;
  console.log(`\nDone: ${downloaded} downloaded, ${empty} empty, ${failed} failed`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
