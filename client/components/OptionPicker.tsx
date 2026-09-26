import { useState } from 'react';
import type { ListName, ListValue } from '../../shared/types';
import { api } from '../api';
import { messagesOf } from '../errors';
import { useLang, useT } from '../i18n/LanguageProvider';
import { listName } from '../i18n/listNames';

const NONE = '';
const ADD = '__add__';

interface OptionPickerProps {
  label: string;
  list: ListName;
  options: ListValue[];
  value: number | null;
  onChange: (id: number | null) => void;
  /** Called with a value created inline, so the parent can show it straight away. */
  onAdded: (value: ListValue) => void;
  /** Text of the empty choice, e.g. "Not set" or "Standalone (no main project)". Ignored when `required`. */
  noneLabel: string;
  /** Hides the empty choice, for a field that must have a value (e.g. an outsourced person's company). The
   * inline "+ Add new …" choice stays. */
  required?: boolean;
  /** Text of the choice that opens the inline add, e.g. "+ Add new department…" or "Other…". */
  addLabel: string;
  /** Keep the label for screen readers and tests but don't show it (e.g. inside a table-like row). */
  hideLabel?: boolean;
  /** The inline add box's label. Defaults to "New <label>" ("New main project"). */
  newLabel?: string;
}

/** A dropdown over one of the editable lists, with an inline way to add a new value. */
export function OptionPicker({
  label, list, options, value, onChange, onAdded, noneLabel, addLabel, hideLabel = false, newLabel, required = false,
}: OptionPickerProps) {
  const t = useT();
  const { lang } = useLang();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const labelText = hideLabel ? <span className="visually-hidden">{label}</span> : label;

  function closeAdd() {
    setAdding(false);
    setName('');
    setError(null);
  }

  async function save() {
    const trimmed = name.trim();
    if (!trimmed) return;
    setSaving(true);
    setError(null);
    try {
      const created = await api.addListValue(list, trimmed);
      onAdded(created);
      onChange(created.id);
      closeAdd();
    } catch (err) {
      setError(messagesOf(err, t)[0]);
    } finally {
      setSaving(false);
    }
  }

  if (adding) {
    return (
      <div className="option-add">
        <label>
          {labelText}
          <input
            autoFocus
            aria-label={newLabel ?? t('picker.new', { label: lang === 'en' ? label.toLowerCase() : label })}
            dir="auto"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void save();
              } else if (e.key === 'Escape') {
                closeAdd();
              }
            }}
          />
        </label>
        <div className="option-add-actions">
          <button type="button" className="button" onClick={() => void save()} disabled={saving || !name.trim()}>
            {t('common.add')}
          </button>
          <button type="button" className="button secondary" onClick={closeAdd}>
            {t('common.cancel')}
          </button>
        </div>
        {error ? <p className="field-error" role="alert">{error}</p> : null}
      </div>
    );
  }

  return (
    <label>
      {labelText}
      <select
        value={value === null ? NONE : String(value)}
        onChange={(e) => {
          if (e.target.value === ADD) setAdding(true);
          else onChange(e.target.value === NONE ? null : Number(e.target.value));
        }}
      >
        {required ? null : <option value={NONE}>{noneLabel}</option>}
        {options.map((o) => (
          <option key={o.id} value={String(o.id)}>{listName(o, lang)}</option>
        ))}
        <option value={ADD}>{addLabel}</option>
      </select>
    </label>
  );
}
