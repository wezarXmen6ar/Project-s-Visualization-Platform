import { DEFAULT_CALENDAR, isISODate, todayLocal } from '../../../shared/calendar';
import { schedulePhases, type PhaseInput } from '../../../shared/scheduler';
import { GripIcon, PlusIcon, TrashIcon } from '../../icons';
import { api } from '../../api';
import { Gantt } from '../../gantt/Gantt';
import { phaseRows, rangeFor } from '../../gantt/rows';
import { useElementWidth } from '../../gantt/useElementWidth';
import { useAsync } from '../../useAsync';
import { moveItem, useReorder } from '../../useReorder';

export const DEFAULT_PHASES: PhaseInput[] = [
  { name: 'Requirements gathering', durationDays: 10 },
  { name: 'Business analysis', durationDays: 10 },
  { name: 'Design', durationDays: 10 },
  { name: 'Development', durationDays: 40 },
  { name: 'QA', durationDays: 15 },
  { name: 'UAT', durationDays: 10 },
  { name: 'Go-live', durationDays: 2 },
];

interface PhasesFieldsProps {
  startDate: string;
  onStartDate: (date: string) => void;
  phases: PhaseInput[];
  onPhases: (phases: PhaseInput[]) => void;
}

/** Wizard Step 3: start date, ordered phases with working-day durations, and a live Gantt preview. */
export function PhasesFields({ startDate, onStartDate, phases, onPhases }: PhasesFieldsProps) {
  const calendar = useAsync(() => api.getCalendar(), []);
  const [chartRef, chartWidth] = useElementWidth<HTMLDivElement>();
  const { handleProps, rowProps } = useReorder(phases.length, (from, to) => onPhases(moveItem(phases, from, to)));

  const cal = calendar.data ?? DEFAULT_CALENDAR;
  const previewPhases = phases.filter((p) => p.name.trim() !== '' && Number.isInteger(p.durationDays) && p.durationDays >= 1);
  const scheduled = isISODate(startDate) ? schedulePhases(startDate, previewPhases, cal) : [];
  const rows = phaseRows({ phases: scheduled });
  const range = rangeFor(rows, isISODate(startDate) ? startDate : todayLocal());

  function update(index: number, patch: Partial<PhaseInput>) {
    onPhases(phases.map((p, i) => (i === index ? { ...p, ...patch } : p)));
  }

  return (
    <>
      <section className="card">
        <h2>Phases</h2>
        <p className="field-hint">Durations are in working days. Dates are calculated from the working calendar.</p>
        <div className="phase-start">
          <label>
            Start date
            <input type="date" value={startDate} onChange={(e) => onStartDate(e.target.value)} />
          </label>
        </div>
        {phases.map((phase, i) => (
          <div className="phase-row" key={i} {...rowProps(i)}>
            <button {...handleProps(i, `Reorder phase ${i + 1}`)}>
              <GripIcon />
            </button>
            <input
              aria-label={`Phase ${i + 1} name`}
              placeholder="Phase name"
              value={phase.name}
              onChange={(e) => update(i, { name: e.target.value })}
            />
            <input
              aria-label={`Phase ${i + 1} working days`}
              type="number"
              min={1}
              value={Number.isNaN(phase.durationDays) ? '' : phase.durationDays}
              onChange={(e) => update(i, { durationDays: e.target.valueAsNumber })}
            />
            <button
              type="button"
              className="button ghost-icon"
              aria-label={`Remove phase ${i + 1}`}
              onClick={() => onPhases(phases.filter((_, j) => j !== i))}
            >
              <TrashIcon />
            </button>
          </div>
        ))}
        <button type="button" className="button secondary" onClick={() => onPhases([...phases, { name: '', durationDays: 5 }])}>
          <PlusIcon />Add phase
        </button>
      </section>

      <section className="card">
        <h2>Preview</h2>
        <div className="chart-scroll" ref={chartRef}>
          <Gantt rows={rows} range={range} width={chartWidth} />
        </div>
      </section>
    </>
  );
}
