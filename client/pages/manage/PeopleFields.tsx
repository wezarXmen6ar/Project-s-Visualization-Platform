import { DEFAULT_CALENDAR, isISODate } from '../../../shared/calendar';
import { schedulePhases, type ScheduledPhase } from '../../../shared/scheduler';
import type { ListValue, ResourceRecord, WorkloadData } from '../../../shared/types';
import { AssignmentsEditor } from '../../components/AssignmentsEditor';
import { dayDate, overloadsWith, phaseWarnings, plannedFrom } from '../../overloads';
import { useLang, useT } from '../../i18n/LanguageProvider';
import { subPhaseLabel, type PhaseNameFor } from '../../todos';
import type { PhaseDraft } from './projectDraft';

interface PeopleFieldsProps {
  projectName: string;
  startDate: string;
  phases: PhaseDraft[];
  onPhases: (phases: PhaseDraft[]) => void;
  people: ResourceRecord[];
  workload: WorkloadData | undefined;
  /** Maps a phase's stored name to its display name (e.g. its Arabic name). Sub-phase names never change. */
  nameFor?: PhaseNameFor;
  /** The Roles list, for each person's role name in Arabic. */
  roles?: ListValue[];
}

/** Wizard Step 4: who works on each phase, with overbooking flagged against everything already booked. */
export function PeopleFields({
  projectName, startDate, phases, onPhases, people, workload, nameFor = (name) => name, roles = [],
}: PeopleFieldsProps) {
  const t = useT();
  const { lang } = useLang();
  const cal = workload?.calendar ?? DEFAULT_CALENDAR;
  // Typed as ScheduledPhase: the generic intersection loses the draft's `assignments` type on `.subPhases`, so
  // sub-phase assignments are read from the draft (phases[i].subPhases[j]) by index instead, below.
  const scheduled: ScheduledPhase[] = isISODate(startDate) ? schedulePhases(startDate, phases, cal) : [];
  const name = projectName.trim() || t('wizard.thisProject');
  // Every phase and sub-phase of this new project counts together, so two of them booking the same person in one
  // week add up — including two parallel sub-phases.
  const planned = scheduled.flatMap((s, i) => [
    ...plannedFrom(phases[i].assignments ?? [], s, name, s.name),
    ...s.subPhases.flatMap((sub, j) =>
      plannedFrom(phases[i].subPhases?.[j]?.assignments ?? [], sub, name, subPhaseLabel(s.name, sub.name)),
    ),
  ]);
  const overloads = workload ? overloadsWith(workload, planned) : new Map();

  return (
    <section className="card">
      <h2>{t('project.people')}</h2>
      <p className="field-hint">{t('wizard.peopleHint')}</p>
      {scheduled.map((s, i) => (
        <div key={i}>
          <AssignmentsEditor
            phaseName={nameFor(s.name)}
            dates={`${dayDate(s.start, lang)} – ${dayDate(s.end, lang)}`}
            people={people}
            roles={roles}
            value={phases[i].assignments ?? []}
            onChange={(value) => onPhases(phases.map((p, j) => (j === i ? { ...p, assignments: value } : p)))}
            warnings={phaseWarnings(overloads, s, cal, lang)}
          />
          {s.subPhases.map((sub, j) => (
            <div className="sub-phase-people" key={j}>
              <AssignmentsEditor
                phaseName={subPhaseLabel(nameFor(s.name), sub.name)}
                dates={`${dayDate(sub.start, lang)} – ${dayDate(sub.end, lang)}`}
                people={people}
                roles={roles}
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
                warnings={phaseWarnings(overloads, sub, cal, lang)}
              />
            </div>
          ))}
        </div>
      ))}
    </section>
  );
}
