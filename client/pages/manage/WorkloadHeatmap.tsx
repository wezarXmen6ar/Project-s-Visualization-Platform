import { Link } from 'react-router';
import type { WorkCalendar } from '../../../shared/calendar';
import type { CapacityResource, PersonLoad } from '../../../shared/capacity';
import type { Lang } from '../../../shared/i18n/types';
import type { OverloadDecision } from '../../../shared/types';
import { useLang, useT } from '../../i18n/LanguageProvider';
import { dayDate, leaveDaysInWeek, leaveInWeek, shortWeekLabel, weekLabel } from '../../overloads';
import { heatLevel, isAccepted, isoWeek, LEVEL_TEXT } from './heatmap';

interface WorkloadHeatmapProps {
  loads: PersonLoad[];
  decisions: OverloadDecision[];
  calendar: WorkCalendar;
  resources: CapacityResource[];
  selected: { resourceId: number; weekStart: string } | null;
  onSelect: (resourceId: number, weekStart: string) => void;
}

/** "Mon 19 Oct – Wed 21 Oct" for a leave range, or "Tue 13 Oct" when it is a single day. */
function leaveRangeLabel(lang: Lang, l: { start: string; end: string }): string {
  return l.start === l.end ? dayDate(l.start, lang) : `${dayDate(l.start, lang)} – ${dayDate(l.end, lang)}`;
}

/** People by weeks, each cell coloured by how much of that week is booked, with a row of day squares showing leave. */
export function WorkloadHeatmap({ loads, decisions, calendar, resources, selected, onSelect }: WorkloadHeatmapProps) {
  const { lang } = useLang();
  const t = useT();
  if (loads.length === 0) return <p className="muted">No active tech-team people yet.</p>;
  const weeks = loads[0].weeks.map((w) => w.weekStart);

  return (
    <div className="heatmap-scroll">
      <table className="heatmap heatmap-weeks" aria-label="Workload">
        <thead>
          <tr>
            <th scope="col" className="heatmap-person">Person</th>
            {weeks.map((w) => (
              <th key={w} scope="col">
                <span className="week-number">{t('heatmap.week', { number: isoWeek(w) })}</span>
                <span className="week-dates">{shortWeekLabel(w, calendar, lang)}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loads.map((person) => {
            const leave = resources.find((r) => r.id === person.resourceId)?.leave ?? [];
            return (
              <tr key={person.resourceId}>
                <th scope="row" className="heatmap-person"><Link to={`/manage/resources/${person.resourceId}`}>{person.name}</Link></th>
                {person.weeks.map((w) => {
                  const level = heatLevel(w, isAccepted(decisions, person.resourceId, w.weekStart));
                  const isSelected = selected?.resourceId === person.resourceId && selected.weekStart === w.weekStart;
                  const classes = ['heat', `heat-${level}`, isSelected ? 'selected' : ''].filter(Boolean).join(' ');
                  const days = leaveDaysInWeek(leave, w.weekStart, calendar);
                  const ranges = leaveInWeek(leave, w.weekStart);
                  const leaveNote = ranges.length > 0 ? `, on leave ${ranges.map((r) => leaveRangeLabel(lang, r)).join(', ')}` : '';
                  return (
                    <td key={w.weekStart}>
                      <button
                        type="button"
                        className={classes}
                        aria-pressed={isSelected}
                        aria-label={`${person.name}, ${weekLabel(w.weekStart, calendar, lang)}: ${Math.round(w.load)}% booked of ${Math.round(w.available)}% available, ${LEVEL_TEXT[level]}${leaveNote}`}
                        onClick={() => onSelect(person.resourceId, w.weekStart)}
                      >
                        <span className="week-load">{level === 'off' ? '—' : w.load > 0 ? `${Math.round(w.load)}%` : ''}</span>
                        <span className="leave-strip day-squares" aria-hidden="true">
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
