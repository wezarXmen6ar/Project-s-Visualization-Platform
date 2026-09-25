import { useState, type KeyboardEvent } from 'react';
import { GripIcon, PlusIcon, TrashIcon } from '../icons';
import { useT } from '../i18n/LanguageProvider';
import { moveItem, useReorder } from '../useReorder';

export interface DraftItem {
  /** Set for an item that is already saved, so the server keeps its date added. */
  id?: number;
  text: string;
}

interface ItemTableProps {
  title: string;
  /** Singular name used in labels, e.g. "Scope item" → "Scope item 1", "Remove scope item 1". */
  noun: string;
  items: DraftItem[];
  onChange: (items: DraftItem[]) => void;
}

/** An auto-numbered list of short texts: add, edit in place, remove, and reorder by dragging or with the arrow keys. */
export function ItemTable({ title, noun, items, onChange }: ItemTableProps) {
  const t = useT();
  const [draft, setDraft] = useState('');
  const { handleProps, rowProps } = useReorder(items.length, (from, to) => onChange(moveItem(items, from, to)));
  const lower = noun.toLowerCase();

  function add() {
    const text = draft.trim();
    setDraft('');
    if (!text) return;
    onChange([...items, { text }]);
  }

  function onDraftKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter') return;
    e.preventDefault(); // Enter must add the item, not submit the surrounding form.
    add();
  }

  // Leaving the box (Tab, clicking Next/Save/Create, etc.) shouldn't silently drop typed text.
  function onDraftBlur() {
    if (draft.trim()) add();
  }

  return (
    <div className="item-table">
      <h3>{title}</h3>
      {items.length === 0 ? (
        <p className="muted item-empty">{t('item.none')}</p>
      ) : (
        <ol className="item-list">
          {items.map((item, i) => {
            const { className: rowClassName, ...rowRest } = rowProps(i);
            return (
            <li key={i} className={`item-row ${rowClassName}`.trim()} {...rowRest}>
              <button {...handleProps(i, t('item.reorder', { noun: lower, number: i + 1 }))}>
                <GripIcon />
              </button>
              <span className="item-number" aria-hidden="true">{i + 1}.</span>
              <input
                aria-label={t('item.label', { noun, number: i + 1 })}
                value={item.text}
                dir="auto"
                data-user-content=""
                onChange={(e) => onChange(items.map((it, j) => (j === i ? { ...it, text: e.target.value } : it)))}
              />
              <button
                type="button"
                className="button ghost-icon"
                aria-label={t('item.remove', { noun: lower, number: i + 1 })}
                onClick={() => onChange(items.filter((_, j) => j !== i))}
              >
                <TrashIcon />
              </button>
            </li>
            );
          })}
        </ol>
      )}
      <div className="item-add">
        <input
          aria-label={t('item.new', { noun: lower })}
          placeholder={t('item.addPlaceholder', { noun: lower })}
          value={draft}
          dir="auto"
          data-user-content=""
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onDraftKeyDown}
          onBlur={onDraftBlur}
        />
        <button type="button" className="button secondary" aria-label={t('item.add', { noun: lower })} onClick={add} disabled={!draft.trim()}>
          <PlusIcon />{t('common.add')}
        </button>
      </div>
    </div>
  );
}
