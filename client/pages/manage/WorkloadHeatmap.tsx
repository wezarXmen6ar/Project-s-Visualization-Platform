import { Link } from 'react-router';
import type { WorkCalendar } from '../../../shared/calendar';
import type { CapacityResource, PersonLoad } from '../../../shared/capacity';
import type { OverloadDecision } from '../../../shared/types';
import { dayDate, leaveDaysInWeek, leaveInWeek, weekLabel } from '../../overloads';
import { heatLevel, isAccepted, type HeatLevel } from './heatmap';

const LEVEL_TEXT: Record<HeatLevel, string> = {
  none: 'free',
  off: 'not working',
  low: 'lightly booked',
  mid: 'booked',
  full: 'fully booked',
  over: 'overbooked',
  accepted: 'overbooked (accepted)',
};

interface WorkloadHeatmapProps {
  loads: PersonLoad[];
  decisions: OverloadDecision[];
  calendar: WorkCalendar;
  resources: CapacityResource[];
  selected: { resourceId: number; weekStart: string } | null;
  onSelect: (resourceId: number, weekStart: string) => void;
}

/** "Mon 19 Oct – Wed 21 Oct" for a leave range, or "Tue 13 Oct" when it is a single day. */
function leaveRangeLabel(l: { start: string; end: string }): string {
  return l.start === l.end ? dayDate(l.start) : `${dayDate(l.start)} – ${dayDate(l.end)}`;
}

/** People by weeks, each cell coloured by how much of that week is booked, with a strip of leave day slices. */
export function WorkloadHeatmap({ loads, decisions, calendar, resources, selected, onSelect }: WorkloadHeatmapProps) {
  if (loads.length === 0) return <p className="muted">No active tech-team people yet.</p>;
  const weeks = loads[0].weeks.map((w) => w.weekStart);

  return (
    <div className="heatmap-scroll">
      <table className="heatmap" aria-label="Workload">
        <thead>
          <tr>
            <th scope="col">Person</th>
            {weeks.map((w) => {
              const [first, second] = weekLabel(w, calendar).split(' – ');
              return (
                <th key={w} scope="col">
                  {first}
                  {second ? <><br />– {second}</> : null}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {loads.map((person) => {
            const leave = resources.find((r) => r.id === person.resourceId)?.leave ?? [];
            return (
              <tr key={person.resourceId}>
                <th scope="row"><Link to={`/manage/resources/${person.resourceId}`}>{person.name}</Link></th>
                {person.weeks.map((w) => {
                  const level = heatLevel(w, isAccepted(decisions, person.resourceId, w.weekStart));
                  const isSelected = selected?.resourceId === person.resourceId && selected.weekStart === w.weekStart;
                  const classes = ['heat', `heat-${level}`, isSelected ? 'selected' : ''].filter(Boolean).join(' ');
                  const days = leaveDaysInWeek(leave, w.weekStart, calendar);
                  const ranges = leaveInWeek(leave, w.weekStart);
                  const leaveNote = ranges.length > 0 ? `, on leave ${ranges.map(leaveRangeLabel).join(', ')}` : '';
                  return (
                    <td key={w.weekStart}>
                      <button
                        type="button"
                        className={classes}
                        aria-pressed={isSelected}
                        aria-label={`${person.name}, ${weekLabel(w.weekStart, calendar)}: ${Math.round(w.load)}% booked of ${Math.round(w.available)}% available, ${LEVEL_TEXT[level]}${leaveNote}`}
                        onClick={() => onSelect(person.resourceId, w.weekStart)}
                      >
                        {level === 'off' ? '—' : w.load > 0 ? `${Math.round(w.load)}%` : ''}
                        <span className="leave-strip" aria-hidden="true">
                          {days.map((d) => (
                            <span key={d.date} className={`leave-slice${d.onLeave ? ' on-leave' : ''}`} />
                          ))}
                        </span>
                      </button>
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
