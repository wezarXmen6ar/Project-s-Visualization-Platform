import { Link } from 'react-router';
import type { PersonLoad } from '../../../shared/capacity';
import type { OverloadDecision } from '../../../shared/types';
import { shortDate } from '../../overloads';
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
  selected: { resourceId: number; weekStart: string } | null;
  onSelect: (resourceId: number, weekStart: string) => void;
}

/** People by weeks, each cell coloured by how much of that week is booked. */
export function WorkloadHeatmap({ loads, decisions, selected, onSelect }: WorkloadHeatmapProps) {
  if (loads.length === 0) return <p className="muted">No active tech-team people yet.</p>;
  const weeks = loads[0].weeks.map((w) => w.weekStart);

  return (
    <div className="heatmap-scroll">
      <table className="heatmap" aria-label="Workload">
        <thead>
          <tr>
            <th scope="col">Person</th>
            {weeks.map((w) => <th key={w} scope="col">{shortDate(w)}</th>)}
          </tr>
        </thead>
        <tbody>
          {loads.map((person) => (
            <tr key={person.resourceId}>
              <th scope="row"><Link to={`/manage/resources/${person.resourceId}`}>{person.name}</Link></th>
              {person.weeks.map((w) => {
                const level = heatLevel(w, isAccepted(decisions, person.resourceId, w.weekStart));
                const isSelected = selected?.resourceId === person.resourceId && selected.weekStart === w.weekStart;
                const classes = ['heat', `heat-${level}`, w.leaveDays > 0 ? 'has-leave' : '', isSelected ? 'selected' : '']
                  .filter(Boolean)
                  .join(' ');
                return (
                  <td key={w.weekStart}>
                    <button
                      type="button"
                      className={classes}
                      aria-pressed={isSelected}
                      aria-label={`${person.name}, week of ${shortDate(w.weekStart)}: ${Math.round(w.load)}% booked of ${Math.round(w.available)}% available, ${LEVEL_TEXT[level]}`}
                      onClick={() => onSelect(person.resourceId, w.weekStart)}
                    >
                      {level === 'off' ? '—' : w.load > 0 ? `${Math.round(w.load)}%` : ''}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
