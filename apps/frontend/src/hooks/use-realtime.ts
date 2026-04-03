import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ws, type RealtimeEvent } from '@/lib/websocket';
import { useAuthStore } from '@/stores/auth.store';
import { useBoardStore } from '@/stores/board.store';
import type { Task } from '@bigbluebam/shared';

/**
 * Hook that manages the WebSocket lifecycle:
 * - Connects when the user is authenticated, disconnects on logout
 * - Subscribes to the given project room when projectId is provided
 * - Handles realtime events by invalidating query caches and
 *   updating the board store for instant UI updates
 */
export function useRealtime(projectId?: string) {
  const queryClient = useQueryClient();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const currentUser = useAuthStore((s) => s.user);

  const addTaskToPhase = useBoardStore((s) => s.addTaskToPhase);
  const updateTaskInBoard = useBoardStore((s) => s.updateTaskInBoard);
  const removeTaskFromBoard = useBoardStore((s) => s.removeTaskFromBoard);
  const moveTask = useBoardStore((s) => s.moveTask);

  // Keep a ref to the current projectId so the event handler always
  // sees the latest value without needing to re-register.
  const projectIdRef = useRef(projectId);
  projectIdRef.current = projectId;

  // Connect / disconnect based on auth state
  useEffect(() => {
    if (isAuthenticated) {
      ws.connect();
    } else {
      ws.disconnect();
    }
    return () => {
      // Don't disconnect on unmount if still authenticated —
      // only disconnect if the auth state caused this cleanup.
      // The disconnect on logout is handled by the else branch above.
    };
  }, [isAuthenticated]);

  // Subscribe to project room
  useEffect(() => {
    if (!projectId || !isAuthenticated) return;

    const room = `project:${projectId}`;
    ws.joinRoom(room);

    return () => {
      ws.leaveRoom(room);
    };
  }, [projectId, isAuthenticated]);

  // Register event handlers
  useEffect(() => {
    if (!isAuthenticated) return;

    const unsubs: Array<() => void> = [];

    // task.created — add to board store + invalidate queries
    unsubs.push(
      ws.on('task.created', (event: RealtimeEvent) => {
        const task = event.payload as Task;
        // Don't apply our own optimistic create again
        if (event.triggeredBy === currentUser?.id) return;

        if (task.phase_id) {
          addTaskToPhase(task.phase_id, task);
        }
        if (projectIdRef.current) {
          queryClient.invalidateQueries({ queryKey: ['board', projectIdRef.current] });
          queryClient.invalidateQueries({ queryKey: ['tasks', projectIdRef.current] });
        }
      }),
    );

    // task.updated — update in board store + invalidate queries
    unsubs.push(
      ws.on('task.updated', (event: RealtimeEvent) => {
        const payload = event.payload as { id: string; changes: Partial<Task>; task: Task };
        if (event.triggeredBy === currentUser?.id) return;

        updateTaskInBoard(payload.id, payload.task);
        if (projectIdRef.current) {
          queryClient.invalidateQueries({ queryKey: ['board', projectIdRef.current] });
          queryClient.invalidateQueries({ queryKey: ['tasks', 'detail', payload.id] });
        }
      }),
    );

    // task.moved — move in board store for instant visual update
    unsubs.push(
      ws.on('task.moved', (event: RealtimeEvent) => {
        const payload = event.payload as {
          id: string;
          phase_id: string;
          position: number;
          task: Task;
        };
        if (event.triggeredBy === currentUser?.id) return;

        moveTask(payload.id, payload.phase_id, payload.position);
        if (projectIdRef.current) {
          queryClient.invalidateQueries({ queryKey: ['board', projectIdRef.current] });
        }
      }),
    );

    // task.deleted — remove from board store
    unsubs.push(
      ws.on('task.deleted', (event: RealtimeEvent) => {
        const payload = event.payload as { id: string };
        if (event.triggeredBy === currentUser?.id) return;

        removeTaskFromBoard(payload.id);
        if (projectIdRef.current) {
          queryClient.invalidateQueries({ queryKey: ['board', projectIdRef.current] });
          queryClient.invalidateQueries({ queryKey: ['tasks', projectIdRef.current] });
        }
      }),
    );

    // sprint.status_changed — refetch sprints and board
    unsubs.push(
      ws.on('sprint.status_changed', () => {
        if (projectIdRef.current) {
          queryClient.invalidateQueries({ queryKey: ['board', projectIdRef.current] });
          queryClient.invalidateQueries({ queryKey: ['sprints', projectIdRef.current] });
        }
      }),
    );

    // comment.added — invalidate task detail
    unsubs.push(
      ws.on('comment.added', (event: RealtimeEvent) => {
        const payload = event.payload as { task_id?: string };
        if (payload.task_id) {
          queryClient.invalidateQueries({ queryKey: ['tasks', 'detail', payload.task_id] });
          queryClient.invalidateQueries({ queryKey: ['comments', payload.task_id] });
        }
      }),
    );

    return () => {
      for (const unsub of unsubs) {
        unsub();
      }
    };
  }, [
    isAuthenticated,
    currentUser?.id,
    queryClient,
    addTaskToPhase,
    updateTaskInBoard,
    removeTaskFromBoard,
    moveTask,
  ]);
}
