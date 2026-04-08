// Deployment state persistence — zero dependencies (node:fs, node:path only).

import * as fs from 'node:fs';
import * as path from 'node:path';

const STATE_FILE = path.resolve(process.cwd(), '.deploy-state.json');

/**
 * Load saved deployment state. Returns {} if no state file exists.
 */
export function loadState() {
  try {
    const raw = fs.readFileSync(STATE_FILE, 'utf8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

/**
 * Persist deployment state to disk.
 */
export function saveState(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2) + '\n', 'utf8');
}

/**
 * Check whether a given phase has been completed.
 */
export function isPhaseComplete(state, phase) {
  return !!(state.phases && state.phases[phase] && state.phases[phase].completed);
}

/**
 * Mark a phase as complete with a timestamp.
 */
export function markPhaseComplete(state, phase) {
  if (!state.phases) state.phases = {};
  state.phases[phase] = {
    completed: true,
    completedAt: new Date().toISOString(),
  };
}

/**
 * Reset state entirely (for fresh re-deploy).
 */
export function resetState() {
  try {
    fs.unlinkSync(STATE_FILE);
  } catch {
    // ignore if file doesn't exist
  }
}
