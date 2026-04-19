#!/usr/bin/env node
// One-off CI-unblock helper: add @bigbluebam/ui as workspace:* dep to every
// app that imports from it, and update pnpm-lock.yaml importers section.
// Not part of the permanent build.

import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const apps = ['frontend', 'bill', 'book', 'blank', 'blast', 'board', 'bolt', 'bond', 'brief', 'helpdesk', 'banter', 'beacon', 'bearing', 'bench'];

for (const app of apps) {
  const pkgPath = `H:/BigBlueBam/apps/${app}/package.json`;
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
  if (pkg.dependencies?.['@bigbluebam/ui']) continue;

  // Insert at the top of dependencies so the diff is compact.
  const newDeps = { '@bigbluebam/ui': 'workspace:*', ...pkg.dependencies };
  pkg.dependencies = newDeps;
  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
  console.log(`added @bigbluebam/ui to apps/${app}/package.json`);
}

// Update pnpm-lock.yaml — add '@bigbluebam/ui' entry under each app's
// dependencies section. Insert right after the importer key line, before
// any existing `devDependencies:` or `dependencies:` subsection.
const lockPath = 'H:/BigBlueBam/pnpm-lock.yaml';
let lock = readFileSync(lockPath, 'utf8');

for (const app of apps) {
  const header = `  apps/${app}:`;
  const idx = lock.indexOf(header);
  if (idx === -1) {
    console.error(`lockfile has no importer block for apps/${app}`);
    continue;
  }
  // Skip if already present
  const afterHeader = lock.slice(idx, idx + 4000);
  if (afterHeader.match(/^\s+'@bigbluebam\/ui':/m)) {
    continue;
  }
  // Find the first `dependencies:` or `devDependencies:` line under the header
  const tail = lock.slice(idx + header.length);
  const depsMatch = tail.match(/\n    dependencies:\n/);
  if (depsMatch) {
    // Insert after the `dependencies:` line
    const insertAt = idx + header.length + depsMatch.index + depsMatch[0].length;
    const insertion = `      '@bigbluebam/ui':\n        specifier: workspace:*\n        version: link:../../packages/ui\n`;
    lock = lock.slice(0, insertAt) + insertion + lock.slice(insertAt);
    console.log(`patched lockfile: apps/${app}`);
  } else {
    // No dependencies section yet — add one after the header
    const insertion = `\n    dependencies:\n      '@bigbluebam/ui':\n        specifier: workspace:*\n        version: link:../../packages/ui`;
    const insertAt = idx + header.length;
    lock = lock.slice(0, insertAt) + insertion + lock.slice(insertAt);
    console.log(`added dependencies block + @bigbluebam/ui: apps/${app}`);
  }
}

writeFileSync(lockPath, lock);
console.log('wrote pnpm-lock.yaml');
