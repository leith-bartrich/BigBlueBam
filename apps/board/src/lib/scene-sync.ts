/**
 * Element diffing and reconciliation utilities for real-time collaboration.
 *
 * These functions compare Excalidraw element arrays to determine what changed
 * and merge remote updates into the local scene without clobbering newer local edits.
 */

/**
 * Compare two element arrays, returning only elements that are new or have changed.
 * Uses Excalidraw's `version` and `versionNonce` fields to detect mutations.
 */
export function diffElements(
  prev: readonly any[],
  next: readonly any[],
): any[] {
  const prevMap = new Map(prev.map((e) => [e.id, e]));
  return next.filter((e) => {
    const old = prevMap.get(e.id);
    if (!old) return true; // new element
    return old.version !== e.version || old.versionNonce !== e.versionNonce;
  });
}

/**
 * Merge remote elements into the local scene.
 * For each element, the copy with the higher `version` wins.
 * Ties are broken by `versionNonce` (higher nonce wins) to provide
 * deterministic last-writer-wins semantics.
 */
export function reconcileElements(
  local: readonly any[],
  remote: readonly any[],
): any[] {
  const merged = new Map(local.map((e) => [e.id, e]));
  for (const re of remote) {
    const le = merged.get(re.id);
    if (
      !le ||
      re.version > le.version ||
      (re.version === le.version && re.versionNonce > le.versionNonce)
    ) {
      merged.set(re.id, re);
    }
  }
  return Array.from(merged.values());
}
