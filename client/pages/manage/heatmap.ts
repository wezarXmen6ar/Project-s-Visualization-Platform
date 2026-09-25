import { addDays, dayOfWeek, daysBetween, type ISODate } from '../../../shared/calendar';
import type { DayLoad, WeekLoad } from '../../../shared/capacity';
import type { MessageKey } from '../../../shared/i18n/en';
import type { OverloadDecision } from '../../../shared/types';

export type HeatLevel = 'none' | 'off' | 'low' | 'mid' | 'full' | 'over' | 'accepted';

/** Catalogue keys for how each level reads in a cell's aria-label. */
export const LEVEL_KEY: Record<HeatLevel, MessageKey> = {
  none: 'heatmap.levelNone',
  off: 'heatmap.levelOff',
  low: 'heatmap.levelLow',
  mid: 'heatmap.levelMid',
  full: 'heatmap.levelFull',
  over: 'heatmap.levelOver',
  accepted: 'heatmap.levelAccepted',
};

/** True when the latest decision about this person's week is to accept the overbooking. */
export function isAccepted(decisions: OverloadDecision[], resourceId: number, weekStart: string): boolean {
  const latest = decisions.filter((d) => d.resourceId === resourceId && d.weekStart === weekStart).at(-1);
  return latest?.decision === 'accept';
}

/** How a week's cell is coloured: by how much of what the person can give is booked. */
export function heatLevel(week: WeekLoad, accepted: boolean): HeatLevel {
  if (week.overloaded) return accepted ? 'accepted' : 'over';
  if (week.workingDays === 0 || week.available === 0) return 'off';
  return band(week.load, week.available);
}

/** How a day's block is coloured, with the same bands as a week. A leave day is not working, unless work is booked on it. */
export function dayLevel(day: DayLoad, accepted: boolean): HeatLevel {
  if (!day.working) return 'off';
  if (day.overloaded) return accepted ? 'accepted' : 'over';
  if (day.onLeave) return day.load > 0 ? 'over' : 'off';
  if (day.available === 0) return 'off';
  return band(day.load, day.available);
}

function band(load: number, available: number): HeatLevel {
  if (load === 0) return 'none';
  const share = load / available;
  if (share <= 0.5) return 'low';
  return share < 1 ? 'mid' : 'full';
}

/** The ISO-8601 week number: weeks start on Monday, and week 1 holds the year's first Thursday. */
export function isoWeek(d: ISODate): number {
  const thursday = addDays(d, 3 - ((dayOfWeek(d) + 6) % 7));
  return Math.floor(daysBetween(`${thursday.slice(0, 4)}-01-01`, thursday) / 7) + 1;
}
