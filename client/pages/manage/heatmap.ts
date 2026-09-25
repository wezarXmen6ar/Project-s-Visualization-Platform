import type { WeekLoad } from '../../../shared/capacity';
import type { OverloadDecision } from '../../../shared/types';

export type HeatLevel = 'none' | 'off' | 'low' | 'mid' | 'full' | 'over' | 'accepted';

/** True when the latest decision about this person's week is to accept the overbooking. */
export function isAccepted(decisions: OverloadDecision[], resourceId: number, weekStart: string): boolean {
  const latest = decisions.filter((d) => d.resourceId === resourceId && d.weekStart === weekStart).at(-1);
  return latest?.decision === 'accept';
}

/** How a week's cell is coloured: by how much of what the person can give is booked. */
export function heatLevel(week: WeekLoad, accepted: boolean): HeatLevel {
  if (week.overloaded) return accepted ? 'accepted' : 'over';
  if (week.workingDays === 0 || week.available === 0) return 'off';
  if (week.load === 0) return 'none';
  const share = week.load / week.available;
  if (share <= 0.5) return 'low';
  return share < 1 ? 'mid' : 'full';
}
