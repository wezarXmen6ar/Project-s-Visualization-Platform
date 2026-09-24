import type { ISODate } from './calendar';
import type { PortfolioStats } from './portfolio';

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
