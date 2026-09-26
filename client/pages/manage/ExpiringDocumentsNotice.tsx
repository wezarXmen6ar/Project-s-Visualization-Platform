import { useState } from 'react';
import { Link } from 'react-router';
import { daysUntilExpiry } from '../../../shared/expiry';
import type { ExpiringItem } from '../../../shared/types';
import { api } from '../../api';
import { AlertIcon } from '../../icons';
import { useFormat } from '../../i18n/format';
import { useLang, useT } from '../../i18n/LanguageProvider';
import { useAsync } from '../../useAsync';

/**
 * "Jira", a product name, keeps its capital letter like any other proper noun — the general lower-casing rule below
 * would otherwise lower it too, since (like "Passport") the rest of its first word is already lower-case.
 */
const KEEP_CAPITALISED = new Set(['Jira']);

/**
 * "Passport" → "passport" mid-sentence in English, but "NDA" and "UAE ID" (real acronyms — the rest of their first
 * word is upper-case) and "Jira" (a product name) keep their capital letters. Arabic needs no such change.
 */
function englishTypeText(name: string): string {
  const firstWord = name.match(/^\S+/)?.[0] ?? '';
  if (KEEP_CAPITALISED.has(firstWord)) return name;
  const restOfFirstWord = firstWord.slice(1);
  const isAcronym = restOfFirstWord.length === 0 || restOfFirstWord !== restOfFirstWord.toLowerCase();
  return isAcronym ? name : name[0].toLowerCase() + name.slice(1);
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

  // The type name as it reads in a list, e.g. the expanded list's own line: falls back to the file name for a
  // document with no type, or a generic "document"/"account" word (an account, unlike a document, has no file name).
  const displayType = (item: ExpiringItem): string => {
    if (item.type) return lang === 'ar' ? item.type.nameAr ?? item.type.name : item.type.name;
    if (item.kind === 'document') return item.name ?? t('dashboard.genericDocument');
    return t('dashboard.genericAccount');
  };

  // The type name as it reads mid-sentence in the single-item notice: English lower-cases an ordinary word
  // ("passport") but not an acronym or product name ("NDA", "Jira").
  const sentenceType = (item: ExpiringItem): string => {
    if (!item.type) return displayType(item);
    return lang === 'ar' ? item.type.nameAr ?? item.type.name : englishTypeText(item.type.name);
  };

  function singleText(item: ExpiringItem): string {
    const days = daysUntilExpiry(item.expiryDate, today);
    const params = { name: item.person.name, type: sentenceType(item), count: days };
    if (item.kind === 'document') {
      if (item.state === 'expired') return t('dashboard.expiringOneDocumentExpired', params);
      return days === 0 ? t('dashboard.expiringOneDocumentToday', params) : t('dashboard.expiringOneDocument', params);
    }
    if (item.state === 'expired') return t('dashboard.expiringOneAccountExpired', params);
    return days === 0 ? t('dashboard.expiringOneAccountToday', params) : t('dashboard.expiringOneAccount', params);
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
              <span dir="auto" data-user-content="">{displayType(item)}</span>
              {' · '}
              {shortDate(item.expiryDate)}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
