#!/usr/bin/env node
// One-off CI-unblock helper: read a list of TS6133 errors and remove the
// named unused symbols from their imports. For destructured parameters we
// prefix with `_`. Not part of the permanent build.

import { readFileSync, writeFileSync } from 'node:fs';

// Each entry: [absolutePath, line (1-based), symbol, kind]
// kind: 'import' (remove from named imports) | 'param' (prefix with _)
const fixes = [
  // blank
  ['apps/blank/src/components/layout/blank-sidebar.tsx', 4, 'BarChart3', 'import'],
  ['apps/blank/src/pages/form-builder.tsx', 20, 'Save', 'import'],
  ['apps/blank/src/pages/form-builder.tsx', 413, 'onNavigate', 'param'],
  ['apps/blank/src/pages/form-list.tsx', 1, 'useState', 'import'],
  ['apps/blank/src/pages/form-list.tsx', 2, 'Globe', 'import'],
  ['apps/blank/src/pages/form-list.tsx', 2, 'Lock', 'import'],
  ['apps/blank/src/pages/form-list.tsx', 2, 'Archive', 'import'],
  ['apps/blank/src/pages/settings.tsx', 5, 'onNavigate', 'param'],
  // blast
  ['apps/blast/src/components/layout/blast-sidebar.tsx', 7, 'Settings', 'import'],
  ['apps/blast/src/pages/analytics-dashboard.tsx', 3, 'BarChart3', 'import'],
  ['apps/blast/src/pages/analytics-dashboard.tsx', 30, 'onNavigate', 'param'],
  ['apps/blast/src/pages/campaign-list.tsx', 2, 'Clock', 'import'],
  ['apps/blast/src/pages/campaign-list.tsx', 2, 'FileEdit', 'import'],
  ['apps/blast/src/pages/campaign-list.tsx', 2, 'MoreHorizontal', 'import'],
  ['apps/blast/src/pages/campaign-list.tsx', 3, 'Campaign', 'import'],
  // bolt
  ['apps/bolt/src/pages/automation-executions.tsx', 4, 'BoltExecution', 'import'],
  ['apps/bolt/src/pages/home.tsx', 6, 'StatusBadge', 'import'],
  // bond
  ['apps/bond/src/components/contacts/activity-timeline.tsx', 18, 'cn', 'import'],
  ['apps/bond/src/pages/analytics.tsx', 2, 'BarChart3', 'import'],
  ['apps/bond/src/pages/analytics.tsx', 4, 'TrendingDown', 'import'],
  ['apps/bond/src/pages/analytics.tsx', 9, 'XCircle', 'import'],
  ['apps/bond/src/pages/analytics.tsx', 12, 'Button', 'import'],
  ['apps/bond/src/pages/analytics.tsx', 22, 'formatCurrency', 'import'],
  ['apps/bond/src/pages/company-list.tsx', 4, 'Badge', 'import'],
  ['apps/bond/src/pages/contact-list.tsx', 2, 'Mail', 'import'],
  ['apps/bond/src/pages/contact-list.tsx', 2, 'Phone', 'import'],
  ['apps/bond/src/pages/deal-detail.tsx', 8, 'Users', 'import'],
  ['apps/bond/src/pages/deal-detail.tsx', 27, 'cn', 'import'],
  ['apps/bond/src/pages/settings.tsx', 3, 'SettingsIcon', 'import'],
  ['apps/bond/src/pages/settings.tsx', 11, 'Power', 'import'],
  ['apps/bond/src/pages/settings.tsx', 12, 'PowerOff', 'import'],
  ['apps/bond/src/pages/settings.tsx', 13, 'AlertTriangle', 'import'],
  ['apps/bond/src/pages/settings.tsx', 14, 'Check', 'import'],
  ['apps/bond/src/pages/settings.tsx', 23, 'Pipeline', 'import'],
  // brief
  ['apps/brief/src/components/document/export-menu.tsx', 10, 'slug', 'param'],
  ['apps/brief/src/components/editor/brief-editor.tsx', 158, 'key', 'local'],
  ['apps/brief/src/components/editor/editor-toolbar.tsx', 23, 'Heading1', 'import'],
  ['apps/brief/src/components/editor/editor-toolbar.tsx', 24, 'Heading2', 'import'],
  ['apps/brief/src/components/editor/editor-toolbar.tsx', 25, 'Heading3', 'import'],
  ['apps/brief/src/components/editor/editor-toolbar.tsx', 26, 'Heading4', 'import'],
  ['apps/brief/src/components/editor/editor-toolbar.tsx', 27, 'Type', 'import'],
  ['apps/brief/src/components/editor/suggestion-popup.tsx', 7, 'useRef', 'import'],
  ['apps/brief/src/components/editor/suggestion-popup.tsx', 9, 'createPortal', 'import'],
  ['apps/brief/src/extensions/task-embed.ts', 2, 'ReactNodeViewRenderer', 'import'],
  // banter
  ['apps/banter/src/components/calls/huddle-banner.tsx', 16, 'huddleId', 'param'],
  ['apps/banter/src/components/messages/cross-product-embed.tsx', 7, 'AlertCircle', 'import'],
  ['apps/banter/src/components/messages/cross-product-embed.tsx', 8, 'Calendar', 'import'],
  ['apps/banter/src/components/messages/link-preview.tsx', 2, 'ExternalLink', 'import'],
  ['apps/banter/src/components/messages/message-item.tsx', 42, 'onNavigate', 'param'],
  ['apps/banter/src/components/threads/thread-panel.tsx', 10, 'api', 'import'],
  ['apps/banter/src/pages/admin.tsx', 15, 'RefreshCw', 'import'],
  ['apps/banter/src/pages/channel-browser.tsx', 4, 'cn', 'import'],
  // beacon
  ['apps/beacon/src/pages/beacon-settings.tsx', 11, 'usePolicyResolve', 'import'],
  ['apps/beacon/src/pages/home.tsx', 14, 'formatRelativeTime', 'import'],
  // bench
  ['apps/bench/src/pages/dashboard-list.tsx', 1, 'useState', 'import'],
  ['apps/bench/src/pages/dashboard-list.tsx', 4, 'cn', 'import'],
  ['apps/bench/src/pages/dashboard-view.tsx', 2, 'Copy', 'import'],
  ['apps/bench/src/pages/dashboard-view.tsx', 2, 'Download', 'import'],
  ['apps/bench/src/pages/dashboard-view.tsx', 7, 'formatRelativeTime', 'import'],
  ['apps/bench/src/pages/explorer.tsx', 2, 'Download', 'import'],
  ['apps/bench/src/pages/explorer.tsx', 2, 'Save', 'import'],
  ['apps/bench/src/pages/explorer.tsx', 10, 'onNavigate', 'param'],
  ['apps/bench/src/pages/reports.tsx', 5, 'formatDate', 'import'],
  ['apps/bench/src/pages/reports.tsx', 264, 'onNavigate', 'param'],
  ['apps/bench/src/pages/settings.tsx', 7, 'onNavigate', 'param'],
  // board
  ['apps/board/src/components/list/board-card.tsx', 3, 'Avatar', 'import'],
];

// Group by file to read/write each once
const byFile = new Map();
for (const [file, line, sym, kind] of fixes) {
  if (!byFile.has(file)) byFile.set(file, []);
  byFile.get(file).push({ line, sym, kind });
}

function removeNamedImport(source, sym) {
  // Remove `sym` from any `import { ... }` list in the file. Works for
  // default-style lists too. Leaves whole-line imports intact if only
  // sym is present.
  const importRe = /import\s+(?:type\s+)?(\w+\s*,\s*)?\{([^}]+)\}\s+from\s+['"][^'"]+['"]/g;
  return source.replace(importRe, (full, def, names) => {
    const parts = names.split(',').map((s) => s.trim()).filter(Boolean);
    const filtered = parts.filter((p) => {
      // strip `type` keyword and whitespace: e.g. `type Foo`, `Foo as Bar`
      const base = p.replace(/^type\s+/, '').split(/\s+as\s+/)[0].trim();
      return base !== sym;
    });
    if (filtered.length === parts.length) return full; // nothing matched
    if (filtered.length === 0 && !def) {
      // No remaining names and no default — drop the whole import.
      return '';
    }
    const newNames = filtered.length > 0 ? `{ ${filtered.join(', ')} }` : '';
    const joined = [def?.trim().replace(/,$/, ''), newNames].filter(Boolean).join(', ');
    const fromIdx = full.indexOf('from');
    return `import ${joined} ${full.slice(fromIdx)}`;
  });
}

function prefixParam(source, sym) {
  // Prefix `{ sym }` or `{ sym:` or `sym:` etc. in params with `_`.
  // Only rewrite standalone identifier occurrences inside `({...})` patterns.
  // Fallback: rename all occurrences of the bare identifier in the whole
  // file — these are unused-param warnings so the binding is local.
  // Safer: rewrite the destructure keys.
  const re = new RegExp(`\\b${sym}\\b`);
  if (!re.test(source)) return source;
  // Match within the first matching destructure/param scope.
  // Simple strategy: replace `{ sym }` -> `{ sym: _${sym} }` and
  // `{ sym,` -> `{ sym: _${sym},` and `, sym }` -> `, sym: _${sym} }`
  let out = source;
  out = out.replace(new RegExp(`(\\{\\s*)${sym}(\\s*\\})`, 'g'), `$1${sym}: _${sym}$2`);
  out = out.replace(new RegExp(`(\\{\\s*)${sym}(\\s*,)`, 'g'), `$1${sym}: _${sym}$2`);
  out = out.replace(new RegExp(`(,\\s*)${sym}(\\s*\\})`, 'g'), `$1${sym}: _${sym}$2`);
  out = out.replace(new RegExp(`(,\\s*)${sym}(\\s*,)`, 'g'), `$1${sym}: _${sym}$2`);
  return out;
}

let touched = 0;
for (const [relPath, items] of byFile) {
  const full = relPath.replaceAll('/', '/');
  const abs = `H:/BigBlueBam/${full}`;
  let src;
  try {
    src = readFileSync(abs, 'utf8');
  } catch (err) {
    console.error(`skip (no file): ${relPath}`);
    continue;
  }
  let orig = src;
  for (const { sym, kind } of items) {
    if (kind === 'import') {
      src = removeNamedImport(src, sym);
    } else if (kind === 'param') {
      src = prefixParam(src, sym);
    }
  }
  if (src !== orig) {
    writeFileSync(abs, src);
    touched++;
    console.log(`wrote ${relPath}`);
  } else {
    console.log(`no-op: ${relPath}`);
  }
}
console.log(`\n${touched} file(s) rewritten out of ${byFile.size}`);
