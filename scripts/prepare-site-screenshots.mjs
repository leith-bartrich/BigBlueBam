#!/usr/bin/env node
/**
 * Materialize flat-named screenshots into site/public/screenshots/ so the
 * marketing site's React components can fetch them.
 *
 * Why this exists: the marketing site code references screenshots like
 * `/screenshots/banter-channels.png` (flat filenames), but the repo's
 * authoritative screenshot source is the `images/` directory at the root,
 * populated by `scripts/screenshots-*.js` Playwright capture scripts. A
 * docs-pipeline mirror under `site/public/screenshots/<app>/{light,dark}/`
 * serves a different purpose (per-app docs hero images) and does not cover
 * the flat-name paths the marketing pages expect.
 *
 * This script bridges the two: for every `/screenshots/<name>.png`
 * reference found anywhere under `site/src/`, it copies the matching file
 * from `images/<name>.png` or `images/<NN>-<name>.png` (numeric prefix)
 * into `site/public/screenshots/<name>.png`. It fails loudly if any
 * reference has no source file, so fresh deploys surface the breakage
 * instead of silently 404ing.
 *
 * Invoked by `infra/site/Dockerfile` before `npm run build`. Safe to run
 * locally too: `node scripts/prepare-site-screenshots.mjs`.
 *
 * Environment knobs:
 *   IMAGES_DIR    override source dir (default: <repo>/images)
 *   SITE_DIR      override site root    (default: <repo>/site)
 */

import { readdirSync, readFileSync, copyFileSync, mkdirSync, statSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..');
const IMAGES_DIR = process.env.IMAGES_DIR || join(REPO_ROOT, 'images');
const SITE_DIR = process.env.SITE_DIR || join(REPO_ROOT, 'site');
const SRC_DIR = join(SITE_DIR, 'src');
const DEST_DIR = join(SITE_DIR, 'public', 'screenshots');

const REF_RE = /\/screenshots\/([a-z0-9_.-]+\.png)/gi;

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(p));
    else if (/\.(tsx?|jsx?|md|html|css|scss)$/i.test(entry.name)) out.push(p);
  }
  return out;
}

function discoverReferences() {
  const files = walk(SRC_DIR);
  const refs = new Set();
  for (const f of files) {
    const text = readFileSync(f, 'utf8');
    let m;
    REF_RE.lastIndex = 0;
    while ((m = REF_RE.exec(text))) refs.add(m[1]);
  }
  return refs;
}

function indexImages() {
  const map = new Map();
  for (const name of readdirSync(IMAGES_DIR)) {
    const full = join(IMAGES_DIR, name);
    if (!statSync(full).isFile()) continue;
    if (!name.toLowerCase().endsWith('.png')) continue;
    if (!map.has(name)) map.set(name, full);
    const stripped = name.replace(/^\d+-/, '');
    if (stripped !== name && !map.has(stripped)) map.set(stripped, full);
  }
  return map;
}

const refs = discoverReferences();
const images = indexImages();
mkdirSync(DEST_DIR, { recursive: true });

let copied = 0;
const missing = [];
for (const name of [...refs].sort()) {
  const src = images.get(name);
  if (!src) {
    missing.push(name);
    continue;
  }
  copyFileSync(src, join(DEST_DIR, name));
  copied++;
}

console.log(
  `[prepare-site-screenshots] referenced=${refs.size} copied=${copied} missing=${missing.length}`,
);
if (missing.length) {
  for (const name of missing) console.error(`  MISSING: ${name}`);
  process.exit(1);
}
