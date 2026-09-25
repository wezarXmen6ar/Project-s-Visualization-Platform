import { Link } from 'react-router';
import { todayLocal, type ISODate } from '../../../shared/calendar';
import { weekStartOf, type DayLoad, type PersonDays } from '../../../shared/capacity';
import type { Lang } from '../../../shared/i18n/types';
import type { OverloadDecision } from '../../../shared/types';
import { translate } from '../../../shared/i18n/translate';
import { useLang, useT } from '../../i18n/LanguageProvider';
import { dayDate, dayRange, weekdayLetter } from '../../i18n/format';
import { dayLevel, isAccepted, LEVEL_KEY, type HeatLevel } from './heatmap';

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

function dayText(lang: Lang, day: DayLoad): string {
  if (day.load > 0) return String(Math.round(day.load));
  return day.onLeave ? translate(lang, 'heatmap.legendLeave') : '';
}

function dayAria(lang: Lang, name: string, day: DayLoad, level: HeatLevel): string {
  const when = dayDate(lang, day.date);
  if (day.onLeave && day.load === 0) return translate(lang, 'heatmap.cellOnLeave', { name, when });
  return translate(lang, 'heatmap.cell', {
    name,
    when,
    load: Math.round(day.load),
    available: Math.round(day.available),
    level: translate(lang, LEVEL_KEY[level]),
    leave: day.onLeave ? translate(lang, 'heatmap.onLeave') : '',
  });
}

/** People by working days, grouped into weeks: one block per day, so leave covers exactly the days it falls on. */
export function DayHeatmap({ people, decisions, selected, onSelect }: DayHeatmapProps) {
  const { lang } = useLang();
  const t = useT();
  if (people.length === 0) return <p className="muted">{t('heatmap.noPeople')}</p>;
  const groups = weekGroups(people[0].days);
  const today = todayLocal();
  const todayClass = (date: ISODate) => (date === today ? ' today' : '');

  return (
    <div className="heatmap-scroll">
      <table className="heatmap heatmap-days" aria-label={t('resources.workload')}>
        <thead>
          <tr>
            <th scope="col" rowSpan={2} className="heatmap-person">{t('heatmap.person')}</th>
            {groups.map((g) => (
              <th key={g.weekStart} scope="colgroup" colSpan={g.dates.length} className="week-group">
                {dayRange(lang, g.dates[0], g.dates[g.dates.length - 1])}
              </th>
            ))}
          </tr>
          <tr>
            {groups.flatMap((g) =>
              g.dates.map((date) => (
                <th key={date} scope="col" aria-label={dayDate(lang, date)} className={`day-head${todayClass(date)}`}>
                  <span className="day-letter">{weekdayLetter(lang, date)}</span>
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
                <Link to={`/manage/resources/${person.resourceId}`} dir="auto" data-user-content="">{person.name}</Link>
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
                      aria-label={dayAria(lang, person.name, day, level)}
                      onClick={() => onSelect(person.resourceId, weekStart)}
                    >
                      {dayText(lang, day)}
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
