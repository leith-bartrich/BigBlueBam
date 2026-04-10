#!/usr/bin/env node
/**
 * extract-mcp-tool-schemas.mjs
 *
 * Parses every apps/mcp-server/src/tools/*-tools.ts file and extracts each
 * `server.tool('name', 'desc', { ...zod schema }, handler)` registration so
 * the Bolt action editor can present a typed parameter picker instead of
 * forcing users to free-type MCP arguments.
 *
 * Output: stdout, JSON. Pipe to a file.
 *
 *   node scripts/extract-mcp-tool-schemas.mjs > apps/bolt-api/src/services/mcp-tool-schemas.generated.ts
 *
 * Re-run whenever a tool's schema changes. The output is checked in.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TOOLS_DIR = join(ROOT, 'apps/mcp-server/src/tools');

// ---------------------------------------------------------------------------
// Brace-balanced extraction
// ---------------------------------------------------------------------------

/**
 * Find every server.tool(...) invocation in the file and return the raw text
 * of the third argument (the zod schema object).
 */
function extractToolBlocks(source) {
  const blocks = [];
  const re = /server\.tool\(\s*/g;
  let match;
  while ((match = re.exec(source)) !== null) {
    const start = match.index + match[0].length;
    // Parse arg 1: tool name (string literal)
    const arg1 = parseStringLiteral(source, start);
    if (!arg1) continue;
    // Skip whitespace + comma
    let i = arg1.end;
    i = skipWsAndComma(source, i);
    // Parse arg 2: description (string literal — may be template literal or multi-line)
    const arg2 = parseStringLiteral(source, i);
    if (!arg2) continue;
    i = skipWsAndComma(source, arg2.end);
    // Parse arg 3: object literal { ... } — track brace depth
    if (source[i] !== '{') continue;
    const obj = readBalancedBlock(source, i, '{', '}');
    blocks.push({
      name: arg1.value,
      description: arg2.value,
      schemaText: source.slice(obj.start + 1, obj.end - 1),
    });
  }
  return blocks;
}

function parseStringLiteral(source, start) {
  let i = start;
  while (i < source.length && /\s/.test(source[i])) i++;
  const quote = source[i];
  if (quote !== "'" && quote !== '"' && quote !== '`') return null;
  let j = i + 1;
  let value = '';
  while (j < source.length) {
    const c = source[j];
    if (c === '\\') { value += source[j + 1]; j += 2; continue; }
    if (c === quote) return { value, end: j + 1 };
    value += c;
    j++;
  }
  return null;
}

function skipWsAndComma(source, start) {
  let i = start;
  while (i < source.length && /[\s,]/.test(source[i])) i++;
  return i;
}

function readBalancedBlock(source, start, open, close) {
  let depth = 0;
  let inString = null;
  for (let i = start; i < source.length; i++) {
    const c = source[i];
    if (inString) {
      if (c === '\\') { i++; continue; }
      if (c === inString) inString = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') { inString = c; continue; }
    if (c === open) depth++;
    else if (c === close) {
      depth--;
      if (depth === 0) return { start, end: i + 1 };
    }
  }
  throw new Error(`Unbalanced ${open}${close} starting at ${start}`);
}

// ---------------------------------------------------------------------------
// Schema parsing
// ---------------------------------------------------------------------------

/**
 * Split a comma-separated parameter list at depth 0, ignoring commas inside
 * nested ()/{}/[] groups and string literals. Each fragment is "key: zod-expr".
 */
function splitTopLevelCommas(text) {
  const out = [];
  let depth = 0;
  let inString = null;
  let buf = '';
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inString) {
      buf += c;
      if (c === '\\') { buf += text[i + 1]; i++; continue; }
      if (c === inString) inString = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') { inString = c; buf += c; continue; }
    if (c === '(' || c === '[' || c === '{') depth++;
    else if (c === ')' || c === ']' || c === '}') depth--;
    if (c === ',' && depth === 0) {
      const t = buf.trim();
      if (t) out.push(t);
      buf = '';
      continue;
    }
    buf += c;
  }
  const t = buf.trim();
  if (t) out.push(t);
  return out;
}

function parseParameter(line) {
  // line looks like "name: z.string().describe('...')" or "name: z.array(z.string()).optional()"
  // Split off the key
  const colonIdx = findUnquotedColon(line);
  if (colonIdx < 0) return null;
  const rawKey = line.slice(0, colonIdx).trim();
  // Strip surrounding quotes if present
  const key = rawKey.replace(/^['"]|['"]$/g, '');
  const expr = line.slice(colonIdx + 1).trim();
  if (!expr.startsWith('z.')) return null;

  const optional = /\.optional\(\)/.test(expr);
  const nullable = /\.nullable\(\)/.test(expr);

  // Type detection — first z.<head>(...) call
  const headMatch = expr.match(/^z\.(\w+)\s*\(([^)]*)\)/);
  if (!headMatch) return null;
  const head = headMatch[1];
  const headArgs = headMatch[2];

  let type;
  let enumValues;
  let format;
  switch (head) {
    case 'string':
      type = 'string';
      if (/\.uuid\(\)/.test(expr)) format = 'uuid';
      else if (/\.email\(\)/.test(expr)) format = 'email';
      else if (/\.url\(\)/.test(expr)) format = 'url';
      else if (/\.datetime\(\)/.test(expr)) format = 'datetime';
      break;
    case 'number':
      type = 'number';
      if (/\.int\(\)/.test(expr)) format = 'integer';
      break;
    case 'boolean':
      type = 'boolean';
      break;
    case 'array':
      type = 'array';
      // Try to detect element type from arg
      if (/z\.string\(\)/.test(headArgs)) format = 'string[]';
      else if (/z\.number\(\)/.test(headArgs)) format = 'number[]';
      else if (/uuid/.test(headArgs)) format = 'uuid[]';
      break;
    case 'enum': {
      type = 'enum';
      // Parse the enum values inline — array of string literals
      const enumMatch = expr.match(/z\.enum\(\s*\[([^\]]*)\]/);
      if (enumMatch) {
        enumValues = enumMatch[1]
          .split(',')
          .map((s) => s.trim().replace(/^['"`]|['"`]$/g, ''))
          .filter(Boolean);
      }
      break;
    }
    case 'object':
      type = 'object';
      break;
    case 'record':
      type = 'object';
      break;
    case 'literal':
      type = 'string';
      break;
    case 'union':
      type = 'union';
      break;
    case 'any':
    case 'unknown':
      type = 'any';
      break;
    default:
      type = head;
  }

  // Description — last .describe('...') call
  let description = '';
  const descMatch = expr.match(/\.describe\(\s*['"`]((?:[^'"`\\]|\\.)*)['"`]\s*\)/);
  if (descMatch) {
    description = descMatch[1].replace(/\\'/g, "'").replace(/\\"/g, '"');
  }

  return {
    name: key,
    type,
    format,
    enum: enumValues,
    required: !optional,
    nullable,
    description,
  };
}

function findUnquotedColon(text) {
  let inString = null;
  let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inString) {
      if (c === '\\') { i++; continue; }
      if (c === inString) inString = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') { inString = c; continue; }
    if (c === '(' || c === '[' || c === '{') depth++;
    else if (c === ')' || c === ']' || c === '}') depth--;
    if (c === ':' && depth === 0) return i;
  }
  return -1;
}

function parseSchema(schemaText) {
  const lines = splitTopLevelCommas(schemaText);
  const params = [];
  for (const line of lines) {
    const p = parseParameter(line);
    if (p) params.push(p);
  }
  return params;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function deriveSourceFromFilename(filename) {
  // Map "task-tools.ts" → "bam" (Bam tools live in many files)
  // Use the convention: file stem before "-tools" is the source, with a few
  // overrides for the Bam-aggregated files.
  const stem = filename.replace(/-tools\.ts$/, '');
  const bamStems = new Set([
    'task', 'sprint', 'project', 'comment', 'member', 'report',
    'template', 'import', 'utility', 'me', 'platform',
  ]);
  if (bamStems.has(stem)) return 'bam';
  return stem;
}

const files = readdirSync(TOOLS_DIR).filter((f) => f.endsWith('-tools.ts'));
const allTools = [];

for (const file of files.sort()) {
  const source = readFileSync(join(TOOLS_DIR, file), 'utf8');
  const blocks = extractToolBlocks(source);
  const sourceName = deriveSourceFromFilename(file);
  for (const block of blocks) {
    const params = parseSchema(block.schemaText);
    allTools.push({
      mcp_tool: block.name,
      description: block.description,
      source: sourceName,
      parameters: params,
    });
  }
}

// Sort: by source, then by tool name
allTools.sort((a, b) => {
  if (a.source !== b.source) return a.source.localeCompare(b.source);
  return a.mcp_tool.localeCompare(b.mcp_tool);
});

// Emit a TypeScript module so the bolt-api can import it directly without
// runtime JSON parsing or extra build configuration.
const header = `// AUTO-GENERATED by scripts/extract-mcp-tool-schemas.mjs — do not edit by hand.
// Re-run the script whenever an MCP tool schema changes:
//   node scripts/extract-mcp-tool-schemas.mjs > apps/bolt-api/src/services/mcp-tool-schemas.generated.ts

export interface McpToolParameter {
  name: string;
  type: string;
  format?: string;
  enum?: string[];
  required: boolean;
  nullable: boolean;
  description: string;
}

export interface McpToolSchema {
  mcp_tool: string;
  description: string;
  source: string;
  parameters: McpToolParameter[];
}

export const MCP_TOOL_SCHEMAS: McpToolSchema[] = `;

process.stdout.write(header);
process.stdout.write(JSON.stringify(allTools, null, 2));
process.stdout.write(';\n');
