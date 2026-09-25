import { DEFAULT_CALENDAR, isISODate } from '../../../shared/calendar';
import { schedulePhases, type ScheduledPhase } from '../../../shared/scheduler';
import type { ResourceRecord, WorkloadData } from '../../../shared/types';
import { AssignmentsEditor } from '../../components/AssignmentsEditor';
import { dayDate, overloadsWith, phaseWarnings, plannedFrom } from '../../overloads';
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
  // Typed as ScheduledPhase: the generic intersection loses the draft's `assignments` type on `.subPhases`, so
  // sub-phase assignments are read from the draft (phases[i].subPhases[j]) by index instead, below.
  const scheduled: ScheduledPhase[] = isISODate(startDate) ? schedulePhases(startDate, phases, cal) : [];
  const name = projectName.trim() || 'This project';
  // Every phase and sub-phase of this new project counts together, so two of them booking the same person in one
  // week add up — including two parallel sub-phases.
  const planned = scheduled.flatMap((s, i) => [
    ...plannedFrom(phases[i].assignments ?? [], s, name, s.name),
    ...s.subPhases.flatMap((sub, j) =>
      plannedFrom(phases[i].subPhases?.[j]?.assignments ?? [], sub, name, `${s.name} › ${sub.name}`),
    ),
  ]);
  const overloads = workload ? overloadsWith(workload, planned) : new Map();

  return (
    <section className="card">
      <h2>People</h2>
      <p className="field-hint">Who works on each phase, and how much of their week. Anyone who would be overbooked is flagged straight away.</p>
      {scheduled.map((s, i) => (
        <div key={i}>
          <AssignmentsEditor
            phaseName={s.name}
            dates={`${dayDate(s.start)} – ${dayDate(s.end)}`}
            people={people}
            value={phases[i].assignments ?? []}
            onChange={(value) => onPhases(phases.map((p, j) => (j === i ? { ...p, assignments: value } : p)))}
            warnings={phaseWarnings(overloads, s, cal)}
          />
          {s.subPhases.map((sub, j) => (
            <div className="sub-phase-people" key={j}>
              <AssignmentsEditor
                phaseName={`${s.name} › ${sub.name}`}
                dates={`${dayDate(sub.start)} – ${dayDate(sub.end)}`}
                people={people}
                value={phases[i].subPhases?.[j]?.assignments ?? []}
                onChange={(value) =>
                  onPhases(
                    phases.map((p, pi) =>
                      pi === i
                        ? { ...p, subPhases: (p.subPhases ?? []).map((sp, spi) => (spi === j ? { ...sp, assignments: value } : sp)) }
                        : p,
                    ),
                  )
                }
                warnings={phaseWarnings(overloads, sub, cal)}
              />
            </div>
          ))}
        </div>
      ))}
    </section>
  );
}
