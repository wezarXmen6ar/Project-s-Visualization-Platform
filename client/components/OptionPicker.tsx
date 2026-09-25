import { useState } from 'react';
import type { ListName, ListValue } from '../../shared/types';
import { api } from '../api';
import { messagesOf } from '../errors';
import { useT } from '../i18n/LanguageProvider';

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
  /** Text of the empty choice, e.g. "Not set" or "Standalone (no main project)". */
  noneLabel: string;
  /** Text of the choice that opens the inline add, e.g. "+ Add new department…" or "Other…". */
  addLabel: string;
  /** Keep the label for screen readers and tests but don't show it (e.g. inside a table-like row). */
  hideLabel?: boolean;
}

/** A dropdown over one of the editable lists, with an inline way to add a new value. */
export function OptionPicker({
  label, list, options, value, onChange, onAdded, noneLabel, addLabel, hideLabel = false,
}: OptionPickerProps) {
  const t = useT();
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
            aria-label={`New ${label.toLowerCase()}`}
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
            Add
          </button>
          <button type="button" className="button secondary" onClick={closeAdd}>
            Cancel
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
        <option value={NONE}>{noneLabel}</option>
        {options.map((o) => (
          <option key={o.id} value={String(o.id)}>{o.name}</option>
        ))}
        <option value={ADD}>{addLabel}</option>
      </select>
    </label>
  );
}
