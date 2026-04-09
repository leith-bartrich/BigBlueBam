import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ElementType = 'sticky' | 'shape' | 'text' | 'image' | 'frame' | 'connector' | 'embed';
export type EmbedType = 'task' | 'document' | 'link' | 'video' | null;

export interface BoardElement {
  id: string;
  board_id: string;
  element_type: ElementType;
  text_content: string | null;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string | null;
  frame_id: string | null;
  embed_type: EmbedType;
  embed_ref_id: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

interface ElementsResponse {
  data: BoardElement[];
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

export function useElements(boardId: string | undefined) {
  return useQuery({
    queryKey: ['boards', boardId, 'elements'],
    queryFn: () => api.get<ElementsResponse>(`/boards/${boardId}/elements`),
    enabled: !!boardId,
  });
}

export function useStickies(boardId: string | undefined) {
  return useQuery({
    queryKey: ['boards', boardId, 'elements', 'stickies'],
    queryFn: () =>
      api.get<ElementsResponse>(`/boards/${boardId}/elements`, {
        'filter[element_type]': 'sticky',
      }),
    enabled: !!boardId,
  });
}

export function useFrames(boardId: string | undefined) {
  return useQuery({
    queryKey: ['boards', boardId, 'elements', 'frames'],
    queryFn: () =>
      api.get<ElementsResponse>(`/boards/${boardId}/elements`, {
        'filter[element_type]': 'frame',
      }),
    enabled: !!boardId,
  });
}
