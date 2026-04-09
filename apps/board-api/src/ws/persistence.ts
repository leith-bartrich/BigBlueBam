import { eq, and } from 'drizzle-orm';
import { db } from '../db/index.js';
import { boards } from '../db/schema/index.js';

export interface SceneData {
  elements: unknown[];
  appState?: Record<string, unknown>;
  files?: Record<string, unknown>;
}

/**
 * Save an Excalidraw scene JSON to the boards.yjs_state column as a Buffer.
 * Also bumps boards.updated_at.
 */
export async function saveScene(boardId: string, sceneJson: SceneData): Promise<void> {
  const buf = Buffer.from(JSON.stringify(sceneJson), 'utf-8');
  await db
    .update(boards)
    .set({
      yjs_state: buf,
      updated_at: new Date(),
    })
    .where(eq(boards.id, boardId));
}

/**
 * Load an Excalidraw scene from boards.yjs_state.
 * Returns parsed { elements, appState, files } or null if no scene is stored.
 */
export async function loadScene(
  boardId: string,
  orgId: string,
): Promise<SceneData | null> {
  const [row] = await db
    .select({
      yjs_state: boards.yjs_state,
    })
    .from(boards)
    .where(and(eq(boards.id, boardId), eq(boards.organization_id, orgId)))
    .limit(1);

  if (!row || !row.yjs_state) return null;

  try {
    const parsed = JSON.parse(row.yjs_state.toString('utf-8'));
    return {
      elements: parsed.elements ?? [],
      appState: parsed.appState ?? {},
      files: parsed.files ?? {},
    };
  } catch {
    return null;
  }
}
