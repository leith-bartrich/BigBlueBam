/**
 * Embedding service — generates dense and sparse vector embeddings for text.
 *
 * Replace with actual embedding API call (Voyage, OpenAI, etc.) when ready.
 * The stub returns zero vectors of the correct dimension so the full pipeline
 * works end-to-end with Qdrant without requiring an external embedding API.
 */

const DENSE_DIMENSION = 1024;

/**
 * Generate dense embeddings for an array of texts.
 * Returns one 1024-dimensional vector per input text.
 *
 * Replace with actual embedding API call (Voyage, OpenAI, etc.) when ready.
 */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  // Stub: return zero vectors of dimension 1024
  return texts.map(() => new Array(DENSE_DIMENSION).fill(0));
}

/**
 * Generate sparse (BM25/SPLADE) embeddings for an array of texts.
 * Returns one sparse vector per input text.
 *
 * Replace with actual embedding API call (Voyage, OpenAI, etc.) when ready.
 */
export async function embedSparse(
  texts: string[],
): Promise<{ indices: number[]; values: number[] }[]> {
  // Stub: return empty sparse vectors
  return texts.map(() => ({ indices: [], values: [] }));
}

export { DENSE_DIMENSION };
