#!/usr/bin/env node
// One-off CI-unblock helper: add testTimeout: 30000 + hookTimeout: 30000
// to every apps/*/vitest.config.ts that does not yet have them.
// CI runners are slow enough that first-test-in-file import cost can blow
// through the 5s default.

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const appsDir = 'H:/BigBlueBam/apps';
const entries = readdirSync(appsDir);
let touched = 0;
for (const entry of entries) {
  const config = join(appsDir, entry, 'vitest.config.ts');
  let src;
  try {
    src = readFileSync(config, 'utf8');
  } catch {
    continue;
  }
  if (src.includes('testTimeout')) continue;

  // Insert after the opening `test: {` line, matching its indentation.
  const testBlockRe = /(\s{2,})test:\s*\{/;
  const m = src.match(testBlockRe);
  if (!m) {
    console.log(`skip (no test block): ${entry}`);
    continue;
  }
  const indent = m[1] + '  ';
  const insertion =
    `\n${indent}// CI runners sometimes blow through the 5s default on first-test-in-file\n` +
    `${indent}// import cost (drizzle + peer-app-stubs can take multiple seconds).\n` +
    `${indent}testTimeout: 30_000,\n` +
    `${indent}hookTimeout: 30_000,`;
  const insertAt = m.index + m[0].length;
  src = src.slice(0, insertAt) + insertion + src.slice(insertAt);
  writeFileSync(config, src);
  touched++;
  console.log(`bumped: ${entry}`);
}
console.log(`\n${touched} vitest.config.ts file(s) updated`);
