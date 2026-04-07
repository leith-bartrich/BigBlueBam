import { QdrantClient } from '@qdrant/js-client-rest';
import { env } from '../env.js';

let client: QdrantClient | null = null;

export function getQdrantClient(): QdrantClient {
  if (!client) {
    client = new QdrantClient({
      url: env.QDRANT_URL,
      ...(env.QDRANT_API_KEY ? { apiKey: env.QDRANT_API_KEY } : {}),
    });
  }
  return client;
}

/**
 * Check Qdrant connectivity. Returns true if reachable, false otherwise.
 */
export async function checkQdrantHealth(): Promise<boolean> {
  try {
    const qdrant = getQdrantClient();
    await qdrant.getCollections();
    return true;
  } catch (err) {
    console.warn('Qdrant health check failed:', (err as Error).message);
    return false;
  }
}
