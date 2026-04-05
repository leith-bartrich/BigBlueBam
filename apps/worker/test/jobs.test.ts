import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Job } from 'bullmq';
import type { Logger } from 'pino';
import { processEmailJob, type EmailJobData } from '../src/jobs/email.job.js';
import { processNotificationJob, type NotificationJobData } from '../src/jobs/notification.job.js';
import { processSprintCloseJob, type SprintCloseJobData } from '../src/jobs/sprint-close.job.js';

// Mock nodemailer
vi.mock('nodemailer', () => ({
  default: {
    createTransport: vi.fn(() => ({
      sendMail: vi.fn().mockResolvedValue({ messageId: 'test-message-id' }),
    })),
  },
}));

// Mock the db module
vi.mock('../src/utils/db.js', () => ({
  getDb: vi.fn(),
}));

import { getDb } from '../src/utils/db.js';

const mockLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
} as unknown as Logger;

function createMockJob<T>(data: T, id = 'test-job-1'): Job<T> {
  return { id, data, name: 'test' } as unknown as Job<T>;
}

describe('Email Job', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should log email when SMTP is not configured', async () => {
    const jobData: EmailJobData = {
      to: 'user@example.com',
      subject: 'Test Subject',
      html: '<p>Hello</p>',
      text: 'Hello',
    };

    const env = {
      SMTP_HOST: undefined,
      SMTP_PORT: 587,
      SMTP_USER: undefined,
      SMTP_PASS: undefined,
      EMAIL_FROM: 'noreply@bigbluebam.com',
    } as any;

    await processEmailJob(createMockJob(jobData), env, mockLogger);

    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'user@example.com', subject: 'Test Subject' }),
      expect.stringContaining('SMTP not configured'),
    );
  });

  it('should process valid email job data', async () => {
    const jobData: EmailJobData = {
      to: 'recipient@example.com',
      subject: 'Welcome',
      html: '<h1>Welcome</h1>',
    };

    const env = {
      SMTP_HOST: undefined,
      SMTP_PORT: 587,
      SMTP_USER: undefined,
      SMTP_PASS: undefined,
      EMAIL_FROM: 'noreply@bigbluebam.com',
    } as any;

    // Without SMTP, should just log
    await expect(processEmailJob(createMockJob(jobData), env, mockLogger)).resolves.not.toThrow();

    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'recipient@example.com', subject: 'Welcome' }),
      expect.stringContaining('Processing email job'),
    );
  });
});

describe('Notification Job', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should insert notification into database', async () => {
    const mockExecute = vi.fn().mockResolvedValue([]);
    vi.mocked(getDb).mockReturnValue({ execute: mockExecute } as any);

    const jobData: NotificationJobData = {
      user_id: 'user-123',
      project_id: 'project-456',
      task_id: 'task-789',
      type: 'task_assigned',
      title: 'Task Assigned',
      body: 'You have been assigned to task BBB-42',
    };

    await processNotificationJob(createMockJob(jobData), mockLogger);

    expect(mockExecute).toHaveBeenCalledTimes(1);
    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'user-123', type: 'task_assigned' }),
      expect.stringContaining('Notification created successfully'),
    );
  });
});

describe('Sprint Close Job', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should calculate velocity and update sprint record', async () => {
    const mockExecute = vi
      .fn()
      // First call: velocity query
      .mockResolvedValueOnce([{ velocity: 21 }])
      // Second call: update sprint
      .mockResolvedValueOnce([]);

    vi.mocked(getDb).mockReturnValue({ execute: mockExecute } as any);

    const jobData: SprintCloseJobData = {
      sprint_id: 'sprint-100',
      project_id: 'project-456',
    };

    await processSprintCloseJob(createMockJob(jobData), mockLogger);

    expect(mockExecute).toHaveBeenCalledTimes(2);
    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.objectContaining({ sprint_id: 'sprint-100', velocity: 21 }),
      expect.stringContaining('Sprint closed successfully'),
    );
  });

  it('should handle zero velocity when no tasks are completed', async () => {
    const mockExecute = vi
      .fn()
      .mockResolvedValueOnce([{ velocity: 0 }])
      .mockResolvedValueOnce([]);

    vi.mocked(getDb).mockReturnValue({ execute: mockExecute } as any);

    const jobData: SprintCloseJobData = {
      sprint_id: 'sprint-empty',
      project_id: 'project-456',
    };

    await processSprintCloseJob(createMockJob(jobData), mockLogger);

    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.objectContaining({ velocity: 0 }),
      expect.stringContaining('Sprint closed successfully'),
    );
  });
});
