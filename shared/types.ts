import type { ISODate } from './calendar';
import type { PortfolioStats } from './portfolio';

/** The editable dropdown lists (managed in Settings). A main project is just a name, so it is a list too. */
export const LIST_NAMES = ['mainProject', 'projectType', 'goal', 'department'] as const;
export type ListName = (typeof LIST_NAMES)[number];

export interface ListValue {
  id: number;
  list: ListName;
  name: string;
  order: number;
}

export type Lists = Record<ListName, ListValue[]>;

export interface PhaseRecord {
  id: number;
  name: string;
  order: number;
  durationDays: number;
  start: ISODate;
  end: ISODate;
}

export interface ProjectRecord {
  id: number;
  name: string;
  jiraKey: string | null;
  color: string;
  startDate: ISODate;
  phases: PhaseRecord[];
}

export interface PortfolioResponse {
  year: number;
  today: ISODate;
  stats: PortfolioStats;
  projects: ProjectRecord[];
}
