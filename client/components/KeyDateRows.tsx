import type { KeyDateRecord, ListValue } from '../../shared/types';
import { useLang, useT } from '../i18n/LanguageProvider';
import { listName } from '../i18n/listNames';
import { PlusIcon, TrashIcon } from '../icons';

/** One not-yet-saved key date row, edited by the Attachments tab's upload/edit row and the Key dates card's own form. */
export interface KeyDateDraft {
  /** A stable local key for React and for `onChange`; never sent to the server. */
  key: string;
  typeId: number | null;
  date: string;
  note: string;
  /** Set when this row is an already-saved key date being edited, so the caller can PUT instead of POST it. */
  existingId?: number;
}

let seq = 0;

export function newKeyDateDraft(overrides: Partial<KeyDateDraft> = {}): KeyDateDraft {
  seq += 1;
  return { key: `kd-${Date.now()}-${seq}`, typeId: null, date: '', note: '', ...overrides };
}

/**
 * A draft row for an already-saved key date (M7 review fix — shared by the Attachments tab and the Key dates
 * card, which each used to keep their own copy of this).
 */
export function draftFrom(k: KeyDateRecord): KeyDateDraft {
  return newKeyDateDraft({ typeId: k.type?.id ?? null, date: k.date, note: k.note ?? '', existingId: k.id });
}

/**
 * A draft row's payload for the server, normalised the same way everywhere (M7 review fix): a blank type or note
 * becomes `undefined` rather than an empty value, and the row's `existingId`, when set, becomes `id` — the shape
 * `PUT /api/attachments/:id/key-dates` takes for an existing row. Harmless as an extra field on the single-row
 * `POST`/`PUT /api/key-dates` calls, which simply ignore a key they don't declare.
 */
export function toKeyDateInput(draft: KeyDateDraft): { id?: number; typeId?: number; date: string; note?: string } {
  return {
    ...(draft.existingId !== undefined ? { id: draft.existingId } : {}),
    typeId: draft.typeId ?? undefined,
    date: draft.date,
    note: draft.note === '' ? undefined : draft.note,
  };
}

export interface KeyDateRowsProps {
  types: ListValue[];
  rows: KeyDateDraft[];
  onChange: (rows: KeyDateDraft[]) => void;
  /** Offers "+ Add key date" below the rows. Off for the Key dates card's own single-row add/edit form. */
  allowAdd?: boolean;
  /** Offers a remove button on each row. Off for the Key dates card's own single-row edit form. */
  allowRemove?: boolean;
}

/**
 * The editable rows for a project's key dates (M7 Task 9): a type, a date and an optional note per row, with
 * "+ Add key date" to add more. Shared by the Attachments tab's upload and edit rows, and the Key dates card's own
 * add/edit form (as a single row, with `allowAdd`/`allowRemove` both false).
 */
export function KeyDateRows({ types, rows, onChange, allowAdd = true, allowRemove = true }: KeyDateRowsProps) {
  const t = useT();
  const { lang } = useLang();

  function update(key: string, patch: Partial<KeyDateDraft>) {
    onChange(rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }
  function remove(key: string) {
    onChange(rows.filter((r) => r.key !== key));
  }

  return (
    <div className="key-date-rows">
      {rows.map((row, i) => (
        <div className="key-date-row" key={row.key}>
          <label>
            {t('keyDates.colType')}
            <select
              value={row.typeId === null ? '' : String(row.typeId)}
              onChange={(e) => update(row.key, { typeId: e.target.value === '' ? null : Number(e.target.value) })}
            >
              <option value="">{t('keyDates.noType')}</option>
              {types.map((v) => <option key={v.id} value={String(v.id)}>{listName(v, lang)}</option>)}
            </select>
          </label>
          <label>
            {t('keyDates.dateField')}
            <input type="date" value={row.date} onChange={(e) => update(row.key, { date: e.target.value })} />
          </label>
          <label>
            {t('keyDates.noteField')}
            <input dir="auto" value={row.note} onChange={(e) => update(row.key, { note: e.target.value })} />
          </label>
          {allowRemove ? (
            <button
              type="button" className="button ghost-icon" aria-label={t('keyDates.removeRowAria', { n: i + 1 })}
              onClick={() => remove(row.key)}
            >
              <TrashIcon />
            </button>
          ) : null}
        </div>
      ))}
      {allowAdd ? (
        <button type="button" className="button secondary" onClick={() => onChange([...rows, newKeyDateDraft()])}>
          <PlusIcon />{t('keyDates.addKeyDate')}
        </button>
      ) : null}
    </div>
  );
}
