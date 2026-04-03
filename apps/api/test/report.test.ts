import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------- mocks ----------
const { mockDb } = vi.hoisted(() => {
  const mockDb = {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    transaction: vi.fn(),
    execute: vi.fn(),
  };
  return { mockDb };
});

vi.mock('../src/db/index.js', () => ({
  db: mockDb,
  connection: { end: vi.fn() },
}));

vi.mock('../src/services/realtime.service.js', () => ({
  broadcastToProject: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../src/services/activity.service.js', () => ({
  logActivity: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../src/env.js', () => ({
  env: {
    SESSION_TTL_SECONDS: 604800,
    DATABASE_URL: 'postgres://test:test@localhost:5432/test',
    NODE_ENV: 'test',
    PORT: 4000,
    HOST: '0.0.0.0',
    SESSION_SECRET: 'a'.repeat(32),
    REDIS_URL: 'redis://localhost:6379',
    CORS_ORIGIN: 'http://localhost:3000',
    LOG_LEVEL: 'info',
    RATE_LIMIT_MAX: 100,
    RATE_LIMIT_WINDOW_MS: 60000,
    UPLOAD_MAX_FILE_SIZE: 10485760,
    UPLOAD_ALLOWED_TYPES: 'image/*',
    COOKIE_SECURE: false,
  },
}));

// ---------- types ----------
interface Task {
  id: string;
  title: string;
  phase_id: string;
  phase_name: string;
  assignee_id: string | null;
  assignee_name: string | null;
  story_points: number | null;
  due_date: string | null;
  completed_at: string | null;
}

interface OverdueResult {
  tasks: Task[];
  total: number;
}

interface WorkloadEntry {
  user_id: string;
  name: string;
  task_count: number;
  story_points: number;
}

interface StatusDistEntry {
  phase_name: string;
  count: number;
}

// ---------- report logic ----------

function getOverdueTasks(tasks: Task[], now: Date): OverdueResult {
  const overdue = tasks.filter((t) => {
    if (t.completed_at) return false;
    if (!t.due_date) return false;
    return new Date(t.due_date) < now;
  });

  return { tasks: overdue, total: overdue.length };
}

function getWorkloadReport(tasks: Task[]): WorkloadEntry[] {
  const map = new Map<string, WorkloadEntry>();

  for (const task of tasks) {
    if (task.completed_at) continue;
    if (!task.assignee_id) continue;

    const existing = map.get(task.assignee_id);
    if (existing) {
      existing.task_count++;
      existing.story_points += task.story_points ?? 0;
    } else {
      map.set(task.assignee_id, {
        user_id: task.assignee_id,
        name: task.assignee_name ?? 'Unknown',
        task_count: 1,
        story_points: task.story_points ?? 0,
      });
    }
  }

  return Array.from(map.values()).sort((a, b) => b.task_count - a.task_count);
}

function getStatusDistribution(tasks: Task[]): StatusDistEntry[] {
  const map = new Map<string, number>();

  for (const task of tasks) {
    const count = map.get(task.phase_name) ?? 0;
    map.set(task.phase_name, count + 1);
  }

  return Array.from(map.entries())
    .map(([phase_name, count]) => ({ phase_name, count }))
    .sort((a, b) => b.count - a.count);
}

// ---------- tests ----------
describe('Report Logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const now = new Date('2025-06-15T12:00:00Z');

  const tasks: Task[] = [
    {
      id: 'task-1', title: 'Overdue task', phase_id: 'p1', phase_name: 'To Do',
      assignee_id: 'user-1', assignee_name: 'Alice',
      story_points: 5, due_date: '2025-06-10', completed_at: null,
    },
    {
      id: 'task-2', title: 'Another overdue', phase_id: 'p2', phase_name: 'In Progress',
      assignee_id: 'user-2', assignee_name: 'Bob',
      story_points: 3, due_date: '2025-06-01', completed_at: null,
    },
    {
      id: 'task-3', title: 'Not yet due', phase_id: 'p1', phase_name: 'To Do',
      assignee_id: 'user-1', assignee_name: 'Alice',
      story_points: 8, due_date: '2025-07-01', completed_at: null,
    },
    {
      id: 'task-4', title: 'Completed task', phase_id: 'p3', phase_name: 'Done',
      assignee_id: 'user-1', assignee_name: 'Alice',
      story_points: 2, due_date: '2025-06-05', completed_at: '2025-06-04T10:00:00Z',
    },
    {
      id: 'task-5', title: 'No due date', phase_id: 'p2', phase_name: 'In Progress',
      assignee_id: 'user-2', assignee_name: 'Bob',
      story_points: null, due_date: null, completed_at: null,
    },
    {
      id: 'task-6', title: 'Unassigned task', phase_id: 'p1', phase_name: 'To Do',
      assignee_id: null, assignee_name: null,
      story_points: 3, due_date: '2025-06-20', completed_at: null,
    },
  ];

  describe('getOverdueTasks', () => {
    it('returns tasks past due date that are not completed', () => {
      const result = getOverdueTasks(tasks, now);

      expect(result.total).toBe(2);
      expect(result.tasks.map((t) => t.id)).toEqual(['task-1', 'task-2']);
    });

    it('does not include completed tasks even if past due', () => {
      const result = getOverdueTasks(tasks, now);

      // task-4 is completed and past due - should not appear
      const ids = result.tasks.map((t) => t.id);
      expect(ids).not.toContain('task-4');
    });

    it('does not include tasks with no due date', () => {
      const result = getOverdueTasks(tasks, now);

      const ids = result.tasks.map((t) => t.id);
      expect(ids).not.toContain('task-5');
    });

    it('does not include tasks due in the future', () => {
      const result = getOverdueTasks(tasks, now);

      const ids = result.tasks.map((t) => t.id);
      expect(ids).not.toContain('task-3');
      expect(ids).not.toContain('task-6');
    });

    it('returns empty for no overdue tasks', () => {
      const futureTasks: Task[] = [
        {
          id: 'task-f', title: 'Future', phase_id: 'p1', phase_name: 'To Do',
          assignee_id: 'user-1', assignee_name: 'Alice',
          story_points: 1, due_date: '2099-01-01', completed_at: null,
        },
      ];
      const result = getOverdueTasks(futureTasks, now);
      expect(result.total).toBe(0);
      expect(result.tasks).toHaveLength(0);
    });
  });

  describe('getWorkloadReport', () => {
    it('aggregates task counts and story points per user', () => {
      const result = getWorkloadReport(tasks);

      // Alice: task-1 (5sp) + task-3 (8sp) = 2 tasks, 13sp (task-4 is completed, excluded)
      // Bob: task-2 (3sp) + task-5 (null sp -> 0) = 2 tasks, 3sp
      expect(result).toHaveLength(2);

      const alice = result.find((e) => e.name === 'Alice')!;
      expect(alice.task_count).toBe(2);
      expect(alice.story_points).toBe(13);

      const bob = result.find((e) => e.name === 'Bob')!;
      expect(bob.task_count).toBe(2);
      expect(bob.story_points).toBe(3);
    });

    it('excludes completed tasks from workload', () => {
      const result = getWorkloadReport(tasks);

      // task-4 is completed, should not count
      const alice = result.find((e) => e.name === 'Alice')!;
      expect(alice.task_count).toBe(2); // only task-1 and task-3
    });

    it('excludes unassigned tasks from workload', () => {
      const result = getWorkloadReport(tasks);

      // task-6 has no assignee
      const userIds = result.map((e) => e.user_id);
      expect(userIds).not.toContain(null);
    });

    it('handles null story points as 0', () => {
      const result = getWorkloadReport(tasks);

      const bob = result.find((e) => e.name === 'Bob')!;
      // task-5 has null story_points, should contribute 0
      expect(bob.story_points).toBe(3); // only from task-2
    });

    it('returns empty array when all tasks are completed', () => {
      const completedTasks: Task[] = [
        {
          id: 'task-c', title: 'Done', phase_id: 'p3', phase_name: 'Done',
          assignee_id: 'user-1', assignee_name: 'Alice',
          story_points: 5, due_date: null, completed_at: '2025-06-01',
        },
      ];
      const result = getWorkloadReport(completedTasks);
      expect(result).toHaveLength(0);
    });

    it('sorts by task count descending', () => {
      const heavyTasks: Task[] = [
        ...tasks,
        {
          id: 'task-extra', title: 'Extra', phase_id: 'p1', phase_name: 'To Do',
          assignee_id: 'user-2', assignee_name: 'Bob',
          story_points: 1, due_date: null, completed_at: null,
        },
      ];
      const result = getWorkloadReport(heavyTasks);

      // Bob now has 3 tasks, Alice has 2
      expect(result[0]!.name).toBe('Bob');
      expect(result[0]!.task_count).toBe(3);
    });
  });

  describe('getStatusDistribution', () => {
    it('counts tasks per phase', () => {
      const result = getStatusDistribution(tasks);

      // To Do: task-1, task-3, task-6 = 3
      // In Progress: task-2, task-5 = 2
      // Done: task-4 = 1
      expect(result).toHaveLength(3);

      const todo = result.find((e) => e.phase_name === 'To Do')!;
      expect(todo.count).toBe(3);

      const inProgress = result.find((e) => e.phase_name === 'In Progress')!;
      expect(inProgress.count).toBe(2);

      const done = result.find((e) => e.phase_name === 'Done')!;
      expect(done.count).toBe(1);
    });

    it('includes completed tasks in distribution', () => {
      const result = getStatusDistribution(tasks);

      // task-4 is completed but should still count in Done phase
      const done = result.find((e) => e.phase_name === 'Done')!;
      expect(done.count).toBe(1);
    });

    it('sorts by count descending', () => {
      const result = getStatusDistribution(tasks);

      expect(result[0]!.phase_name).toBe('To Do');
      expect(result[0]!.count).toBe(3);
      expect(result[1]!.phase_name).toBe('In Progress');
      expect(result[1]!.count).toBe(2);
    });

    it('returns empty for empty task list', () => {
      const result = getStatusDistribution([]);
      expect(result).toHaveLength(0);
    });

    it('handles single phase', () => {
      const singlePhaseTasks: Task[] = [
        {
          id: 't1', title: 'T1', phase_id: 'p1', phase_name: 'Backlog',
          assignee_id: null, assignee_name: null,
          story_points: null, due_date: null, completed_at: null,
        },
        {
          id: 't2', title: 'T2', phase_id: 'p1', phase_name: 'Backlog',
          assignee_id: null, assignee_name: null,
          story_points: null, due_date: null, completed_at: null,
        },
      ];
      const result = getStatusDistribution(singlePhaseTasks);
      expect(result).toHaveLength(1);
      expect(result[0]!.phase_name).toBe('Backlog');
      expect(result[0]!.count).toBe(2);
    });
  });
});
