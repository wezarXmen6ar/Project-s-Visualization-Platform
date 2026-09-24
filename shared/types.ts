import type { ISODate } from './calendar';

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
