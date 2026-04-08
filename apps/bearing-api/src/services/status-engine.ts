// ---------------------------------------------------------------------------
// Status auto-computation engine
// ---------------------------------------------------------------------------

export type GoalStatus = 'draft' | 'on_track' | 'at_risk' | 'behind' | 'achieved' | 'missed';

export interface StatusInput {
  progress: number;
  starts_at: string;
  ends_at: string;
  now?: Date;
}

/**
 * Compute auto-status based on progress vs elapsed time.
 *
 * ```
 * expected = days_elapsed / total_days
 * if actual >= 1.0 → achieved
 * if actual >= expected * 0.8 → on_track
 * if actual >= expected * 0.5 → at_risk
 * else → behind
 * ```
 */
export function computeAutoStatus(input: StatusInput): GoalStatus {
  const now = input.now ?? new Date();
  const startDate = new Date(input.starts_at);
  const endDate = new Date(input.ends_at);

  const actual = input.progress / 100;

  // Period hasn't started yet
  if (now < startDate) {
    return actual >= 1.0 ? 'achieved' : 'draft';
  }

  // Period has ended
  if (now > endDate) {
    return actual >= 1.0 ? 'achieved' : 'missed';
  }

  // Period is active
  const totalDays = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
  const elapsedDays = (now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);

  if (totalDays <= 0) {
    return actual >= 1.0 ? 'achieved' : 'behind';
  }

  const expected = elapsedDays / totalDays;

  if (actual >= 1.0) return 'achieved';
  if (actual >= expected * 0.8) return 'on_track';
  if (actual >= expected * 0.5) return 'at_risk';
  return 'behind';
}
