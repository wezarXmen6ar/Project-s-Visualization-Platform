import { useState } from 'react';
import { Link } from 'react-router';
import { daysUntilExpiry } from '../../../shared/expiry';
import type { ExpiringItem } from '../../../shared/types';
import { api } from '../../api';
import { AlertIcon } from '../../icons';
import { useFormat } from '../../i18n/format';
import { useLang, useT } from '../../i18n/LanguageProvider';
import { useAsync } from '../../useAsync';

/** "Passport" → "passport": the type name reads lower-case mid-sentence in English; Arabic needs no change. */
function lowerFirst(s: string): string {
  return s.length === 0 ? s : s[0].toLowerCase() + s.slice(1);
}

export interface ExpiringDocumentsNoticeProps {
  today: string;
}

/**
 * The dashboard's notice for documents and accounts that are expired or expire within 30 days (M7 Task 8). One
 * item links straight to that person's page; several expand into a list of every person and document/account.
 */
export function ExpiringDocumentsNotice({ today }: ExpiringDocumentsNoticeProps) {
  const t = useT();
  const { lang } = useLang();
  const { shortDate } = useFormat();
  const [expanded, setExpanded] = useState(false);
  const loaded = useAsync(() => api.listExpiring(30), [today]);
  const items = loaded.data ?? [];
  if (items.length === 0) return null;

  const typeText = (item: ExpiringItem) => {
    if (!item.type) return '';
    return lang === 'ar' ? item.type.nameAr ?? item.type.name : lowerFirst(item.type.name);
  };

  function singleText(item: ExpiringItem): string {
    const params = { name: item.person.name, type: typeText(item), count: daysUntilExpiry(item.expiryDate, today) };
    if (item.kind === 'document') {
      return item.state === 'expired' ? t('dashboard.expiringOneDocumentExpired', params) : t('dashboard.expiringOneDocument', params);
    }
    return item.state === 'expired' ? t('dashboard.expiringOneAccountExpired', params) : t('dashboard.expiringOneAccount', params);
  }

  return (
    <div className="notice" role="status">
      <AlertIcon />
      <span>{items.length === 1 ? singleText(items[0]) : t('dashboard.expiringMany', { count: items.length })}</span>
      {items.length === 1 ? (
        <Link to={`/manage/resources/${items[0].person.id}`}>{t('dashboard.seeDocuments')}</Link>
      ) : (
        <button type="button" className="button-link" aria-expanded={expanded} onClick={() => setExpanded((v) => !v)}>
          {t('dashboard.seeDocuments')}
        </button>
      )}
      {expanded && items.length > 1 ? (
        <ul className="notice-expanded">
          {items.map((item) => (
            <li key={`${item.kind}-${item.id}`}>
              <Link to={`/manage/resources/${item.person.id}`} dir="auto" data-user-content="">{item.person.name}</Link>
              {' · '}
              <span dir="auto" data-user-content="">{item.name ?? (item.type ? (lang === 'ar' ? item.type.nameAr ?? item.type.name : item.type.name) : '')}</span>
              {' · '}
              {shortDate(item.expiryDate)}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
