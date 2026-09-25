import { Link } from 'react-router';
import { todayLocal, type ISODate } from '../../../shared/calendar';
import { weekStartOf, type DayLoad, type PersonDays } from '../../../shared/capacity';
import type { OverloadDecision } from '../../../shared/types';
import { dayDate, dayRangeLabel } from '../../overloads';
import { dayLevel, isAccepted, LEVEL_TEXT, type HeatLevel } from './heatmap';

interface DayHeatmapProps {
  people: PersonDays[];
  decisions: OverloadDecision[];
  /** The selected person's week; clicking a day selects its week. */
  selected: { resourceId: number; weekStart: string } | null;
  onSelect: (resourceId: number, weekStart: string) => void;
}

/** The working days of the range, grouped by the Monday of their week. */
function weekGroups(days: DayLoad[]): { weekStart: ISODate; dates: ISODate[] }[] {
  const groups: { weekStart: ISODate; dates: ISODate[] }[] = [];
  for (const d of days) {
    if (!d.working) continue;
    const weekStart = weekStartOf(d.date);
    const last = groups.at(-1);
    if (last?.weekStart === weekStart) last.dates.push(d.date);
    else groups.push({ weekStart, dates: [d.date] });
  }
  return groups;
}

function dayText(day: DayLoad): string {
  if (day.load > 0) return String(Math.round(day.load));
  return day.onLeave ? 'Leave' : '';
}

function dayAria(name: string, day: DayLoad, level: HeatLevel): string {
  const when = `${name}, ${dayDate(day.date)}`;
  if (day.onLeave && day.load === 0) return `${when}: on leave`;
  const leave = day.onLeave ? ', on leave' : '';
  return `${when}: ${Math.round(day.load)}% booked of ${Math.round(day.available)}% available, ${LEVEL_TEXT[level]}${leave}`;
}

/** People by working days, grouped into weeks: one block per day, so leave covers exactly the days it falls on. */
export function DayHeatmap({ people, decisions, selected, onSelect }: DayHeatmapProps) {
  if (people.length === 0) return <p className="muted">No active tech-team people yet.</p>;
  const groups = weekGroups(people[0].days);
  const today = todayLocal();
  const todayClass = (date: ISODate) => (date === today ? ' today' : '');

  return (
    <div className="heatmap-scroll">
      <table className="heatmap heatmap-days" aria-label="Workload">
        <thead>
          <tr>
            <th scope="col" rowSpan={2} className="heatmap-person">Person</th>
            {groups.map((g) => (
              <th key={g.weekStart} scope="colgroup" colSpan={g.dates.length} className="week-group">
                {dayRangeLabel(g.dates[0], g.dates[g.dates.length - 1])}
              </th>
            ))}
          </tr>
          <tr>
            {groups.flatMap((g) =>
              g.dates.map((date) => (
                <th key={date} scope="col" aria-label={dayDate(date)} className={`day-head${todayClass(date)}`}>
                  <span className="day-letter">{dayDate(date)[0]}</span>
                  <span className="day-number">{Number(date.slice(8, 10))}</span>
                </th>
              )),
            )}
          </tr>
        </thead>
        <tbody>
          {people.map((person) => (
            <tr key={person.resourceId}>
              <th scope="row" className="heatmap-person">
                <Link to={`/manage/resources/${person.resourceId}`}>{person.name}</Link>
              </th>
              {person.days.filter((d) => d.working).map((day) => {
                const weekStart = weekStartOf(day.date);
                const level = dayLevel(day, isAccepted(decisions, person.resourceId, weekStart));
                const isSelected = selected?.resourceId === person.resourceId && selected.weekStart === weekStart;
                const classes = ['heat', 'day', `heat-${level}`, day.onLeave ? 'leave' : '', isSelected ? 'selected' : '']
                  .filter(Boolean)
                  .join(' ');
                return (
                  <td key={day.date} className={todayClass(day.date).trim() || undefined}>
                    <button
                      type="button"
                      className={classes}
                      aria-pressed={isSelected}
                      aria-label={dayAria(person.name, day, level)}
                      onClick={() => onSelect(person.resourceId, weekStart)}
                    >
                      {dayText(day)}
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
