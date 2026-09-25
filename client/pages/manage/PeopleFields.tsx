import { DEFAULT_CALENDAR, isISODate } from '../../../shared/calendar';
import { schedulePhases } from '../../../shared/scheduler';
import type { ResourceRecord, WorkloadData } from '../../../shared/types';
import { AssignmentsEditor } from '../../components/AssignmentsEditor';
import { overloadsWith, phaseWarnings, plannedFrom, shortDate } from '../../overloads';
import type { PhaseDraft } from './projectDraft';

interface PeopleFieldsProps {
  projectName: string;
  startDate: string;
  phases: PhaseDraft[];
  onPhases: (phases: PhaseDraft[]) => void;
  people: ResourceRecord[];
  workload: WorkloadData | undefined;
}

/** Wizard Step 4: who works on each phase, with overbooking flagged against everything already booked. */
export function PeopleFields({ projectName, startDate, phases, onPhases, people, workload }: PeopleFieldsProps) {
  const cal = workload?.calendar ?? DEFAULT_CALENDAR;
  const scheduled = isISODate(startDate) ? schedulePhases(startDate, phases, cal) : [];
  const name = projectName.trim() || 'This project';
  // Every phase of this new project counts together, so two phases booking the same person in one week add up.
  const planned = scheduled.flatMap((s, i) => plannedFrom(phases[i].assignments ?? [], s, name, s.name));
  const overloads = workload ? overloadsWith(workload, planned) : new Map();

  return (
    <section className="card">
      <h2>People</h2>
      <p className="field-hint">Who works on each phase, and how much of their week. Anyone who would be overbooked is flagged straight away.</p>
      {scheduled.map((s, i) => (
        <AssignmentsEditor
          key={i}
          phaseName={s.name}
          dates={`${shortDate(s.start)} – ${shortDate(s.end)}`}
          people={people}
          value={phases[i].assignments ?? []}
          onChange={(value) => onPhases(phases.map((p, j) => (j === i ? { ...p, assignments: value } : p)))}
          warnings={phaseWarnings(overloads, s)}
        />
      ))}
    </section>
  );
}
