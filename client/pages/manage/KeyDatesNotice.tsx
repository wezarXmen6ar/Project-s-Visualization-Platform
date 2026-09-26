import { useState } from 'react';
import { Link } from 'react-router';
import { daysUntilExpiry } from '../../../shared/expiry';
import type { UpcomingKeyDate } from '../../../shared/types';
import { api } from '../../api';
import { AlertIcon } from '../../icons';
import { useFormat } from '../../i18n/format';
import { useLang, useT } from '../../i18n/LanguageProvider';
import { listName } from '../../i18n/listNames';
import { useAsync } from '../../useAsync';

export interface KeyDatesNoticeProps {
  today: string;
}

/**
 * The dashboard's notice for a project's key dates that are due soon or have recently passed (M7 Task 9). One date
 * links straight to that project's Details tab; several expand into a list of every project and key date.
 */
export function KeyDatesNotice({ today }: KeyDatesNoticeProps) {
  const t = useT();
  const { lang } = useLang();
  const { shortDate } = useFormat();
  const [expanded, setExpanded] = useState(false);
  const loaded = useAsync(() => api.listUpcomingKeyDates(30), [today]);
  const items = loaded.data ?? [];
  if (items.length === 0) return null;

  const typeText = (item: UpcomingKeyDate): string => (item.type ? listName(item.type, lang) : t('keyDates.noType'));

  function singleText(item: UpcomingKeyDate): string {
    const days = daysUntilExpiry(item.date, today);
    const params = { project: item.project.name, type: typeText(item), count: Math.abs(days) };
    if (item.state === 'expired') return t('dashboard.keyDateOnePassed', params);
    return days === 0 ? t('dashboard.keyDateOneToday', params) : t('dashboard.keyDateOne', params);
  }

  return (
    <div className="notice" role="status">
      <AlertIcon />
      <span>{items.length === 1 ? singleText(items[0]) : t('dashboard.keyDatesMany', { count: items.length })}</span>
      {items.length === 1 ? (
        <Link to={`/manage/projects/${items[0].project.id}?tab=details`}>{t('dashboard.seeKeyDates')}</Link>
      ) : (
        <button type="button" className="button-link" aria-expanded={expanded} onClick={() => setExpanded((v) => !v)}>
          {t('dashboard.seeKeyDates')}
        </button>
      )}
      {expanded && items.length > 1 ? (
        <ul className="notice-expanded">
          {items.map((item) => (
            <li key={item.id}>
              <Link to={`/manage/projects/${item.project.id}?tab=details`} dir="auto" data-user-content="">{item.project.name}</Link>
              {' · '}
              <span dir="auto" data-user-content="">{typeText(item)}</span>
              {' · '}
              {shortDate(item.date)}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
