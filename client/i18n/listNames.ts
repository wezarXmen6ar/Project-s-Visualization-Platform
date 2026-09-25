import type { Lang } from '../../shared/i18n/types';
import type { Lists } from '../../shared/types';

/** Anything with an English name and an optional Arabic one: a ListValue, or a Ref to one. */
export interface Named {
  name: string;
  nameAr?: string | null;
}

/** A list value's (or list-backed Ref's) name in `lang`: the Arabic name in Arabic (falling back to the English
 * name when none is set), and always the English name in English. */
export function listName(value: Named | null | undefined, lang: Lang): string {
  if (!value) return '';
  if (lang !== 'ar') return value.name;
  return value.nameAr ?? value.name;
}

/**
 * A phase's display name: in Arabic, when `name` matches a Phases-list value's name ignoring case, that value's
 * name in Arabic; otherwise (or in English) the stored text unchanged. Sub-phase names are never looked up.
 */
export function phaseName(name: string, lists: Lists, lang: Lang): string {
  if (lang !== 'ar') return name;
  const match = lists.phase.find((p) => p.name.localeCompare(name, undefined, { sensitivity: 'base' }) === 0);
  return match ? listName(match, lang) : name;
}
