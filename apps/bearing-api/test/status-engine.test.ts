import { describe, it, expect } from 'vitest';
import { computeAutoStatus } from '../src/services/status-engine.js';

// ---------------------------------------------------------------------------
// computeAutoStatus
// ---------------------------------------------------------------------------

describe('computeAutoStatus', () => {
  // Period: 2026-01-01 to 2026-12-31 (365 days)
  const starts_at = '2026-01-01';
  const ends_at = '2026-12-31';

  it('should return achieved when progress >= 100', () => {
    const result = computeAutoStatus({
      progress: 100,
      starts_at,
      ends_at,
      now: new Date('2026-06-01'),
    });

    expect(result).toBe('achieved');
  });

  it('should return on_track when progress >= expected * 0.8', () => {
    // At midpoint (June 1): expected ~0.414, so 0.414*0.8 = 0.331
    // 40% progress => 0.40 >= 0.331 => on_track
    const result = computeAutoStatus({
      progress: 40,
      starts_at,
      ends_at,
      now: new Date('2026-06-01'),
    });

    expect(result).toBe('on_track');
  });

  it('should return at_risk when progress >= expected * 0.5 but < expected * 0.8', () => {
    // At midpoint: expected ~0.414, 0.414*0.5 = 0.207, 0.414*0.8 = 0.331
    // 25% progress => 0.25 >= 0.207 but < 0.331 => at_risk
    const result = computeAutoStatus({
      progress: 25,
      starts_at,
      ends_at,
      now: new Date('2026-06-01'),
    });

    expect(result).toBe('at_risk');
  });

  it('should return behind when progress < expected * 0.5', () => {
    // At midpoint: expected ~0.414, 0.414*0.5 = 0.207
    // 10% progress => 0.10 < 0.207 => behind
    const result = computeAutoStatus({
      progress: 10,
      starts_at,
      ends_at,
      now: new Date('2026-06-01'),
    });

    expect(result).toBe('behind');
  });

  it('should return draft when period has not started yet and progress < 100', () => {
    const result = computeAutoStatus({
      progress: 30,
      starts_at: '2026-07-01',
      ends_at: '2026-12-31',
      now: new Date('2026-06-01'),
    });

    expect(result).toBe('draft');
  });

  it('should return achieved when period has not started but progress is 100', () => {
    const result = computeAutoStatus({
      progress: 100,
      starts_at: '2026-07-01',
      ends_at: '2026-12-31',
      now: new Date('2026-06-01'),
    });

    expect(result).toBe('achieved');
  });

  it('should return missed when period has ended and progress < 100', () => {
    const result = computeAutoStatus({
      progress: 80,
      starts_at: '2025-01-01',
      ends_at: '2025-12-31',
      now: new Date('2026-06-01'),
    });

    expect(result).toBe('missed');
  });

  it('should return achieved when period has ended and progress >= 100', () => {
    const result = computeAutoStatus({
      progress: 100,
      starts_at: '2025-01-01',
      ends_at: '2025-12-31',
      now: new Date('2026-06-01'),
    });

    expect(result).toBe('achieved');
  });

  it('should return behind when total_days is zero and progress < 100', () => {
    const result = computeAutoStatus({
      progress: 50,
      starts_at: '2026-06-01',
      ends_at: '2026-06-01',
      now: new Date('2026-06-01'),
    });

    expect(result).toBe('behind');
  });

  it('should return achieved when total_days is zero and progress >= 100', () => {
    const result = computeAutoStatus({
      progress: 100,
      starts_at: '2026-06-01',
      ends_at: '2026-06-01',
      now: new Date('2026-06-01'),
    });

    expect(result).toBe('achieved');
  });

  it('should handle progress at exactly 0%', () => {
    const result = computeAutoStatus({
      progress: 0,
      starts_at,
      ends_at,
      now: new Date('2026-06-01'),
    });

    expect(result).toBe('behind');
  });

  it('should return on_track at start of period with 0% progress', () => {
    // At day 1: expected ~0.003, 0.003*0.8 = 0.002
    // 0% >= 0.002? No => depends on rounding but very start of period
    // Actually 0 < 0.002 => behind, but elapsed is tiny
    // Let's test with a known value: at start, expected ~0, so 0 >= 0*0.8 => on_track
    const result = computeAutoStatus({
      progress: 0,
      starts_at: '2026-06-01',
      ends_at: '2026-12-31',
      now: new Date('2026-06-01'),
    });

    // elapsed=0 days => expected=0 => 0 >= 0*0.8 => on_track
    expect(result).toBe('on_track');
  });
});
