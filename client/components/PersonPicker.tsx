import { useState, type KeyboardEvent } from 'react';
import type { ResourceRecord, Side } from '../../shared/types';
import { api } from '../api';
import { messagesOf } from '../errors';
import { useLang, useT } from '../i18n/LanguageProvider';

const NONE = '';
const ADD = '__add__';

interface PersonPickerProps {
  label: string;
  side: Side;
  /** Everyone in Resources; the picker offers this side's active people plus whoever is already chosen. */
  people: ResourceRecord[];
  value: number | null;
  onChange: (id: number | null) => void;
  /** Called with a person created inline, so the parent can show them straight away. */
  onAdded: (person: ResourceRecord) => void;
  noneLabel: string;
  /** Role given to someone added from here (tech side only), e.g. the "Project manager" role. */
  newPersonRoleId?: number | null;
}

/** A dropdown of people from Resources, with an inline way to add someone (and a business contact's phone and email). */
export function PersonPicker({ label, side, people, value, onChange, onAdded, noneLabel, newPersonRoleId = null }: PersonPickerProps) {
  const t = useT();
  const { lang } = useLang();
  // English lower-cases the field label inside a sentence ("New project manager (tech)"); Arabic has no case.
  const inSentence = lang === 'en' ? label.toLowerCase() : label;
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const options = people
    .filter((p) => p.side === side && (p.active || p.id === value))
    .sort((a, b) => a.name.localeCompare(b.name));

  function closeAdd() {
    setAdding(false);
    setName('');
    setPhone('');
    setEmail('');
    setErrors([]);
  }

  async function save() {
    if (!name.trim()) return;
    setSaving(true);
    setErrors([]);
    try {
      const created = await api.createResource(
        side === 'business'
          ? { name, side, roleId: null, phone, email }
          : { name, side, roleId: newPersonRoleId, phone: '', email: '' },
      );
      onAdded(created);
      onChange(created.id);
      closeAdd();
    } catch (err) {
      setErrors(messagesOf(err, t));
    } finally {
      setSaving(false);
    }
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      void save();
    } else if (e.key === 'Escape') {
      closeAdd();
    }
  }

  if (adding) {
    return (
      <div className="option-add">
        <label>
          {t('picker.new', { label: inSentence })}
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} onKeyDown={onKeyDown} dir="auto" data-user-content="" />
        </label>
        {side === 'business' ? (
          <>
            <label>
              {t('picker.phone', { label })}
              <input type="tel" dir="ltr" value={phone} onChange={(e) => setPhone(e.target.value)} onKeyDown={onKeyDown} placeholder="+971 50 123 4567" />
            </label>
            <label>
              {t('picker.email', { label })}
              <input type="email" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={onKeyDown} placeholder="name@example.com" />
            </label>
          </>
        ) : null}
        <div className="option-add-actions">
          <button type="button" className="button" onClick={() => void save()} disabled={saving || !name.trim()}>
            {t('common.add')}
          </button>
          <button type="button" className="button secondary" onClick={closeAdd}>
            {t('common.cancel')}
          </button>
        </div>
        {errors.length > 0 ? (
          <ul className="field-error" role="alert">
            {errors.map((m) => <li key={m}>{m}</li>)}
          </ul>
        ) : null}
      </div>
    );
  }

  return (
    <label>
      {label}
      <select
        value={value === null ? NONE : String(value)}
        onChange={(e) => {
          if (e.target.value === ADD) setAdding(true);
          else onChange(e.target.value === NONE ? null : Number(e.target.value));
        }}
      >
        <option value={NONE}>{noneLabel}</option>
        {options.map((p) => (
          <option key={p.id} value={String(p.id)}>{p.active ? p.name : t('common.inactive', { name: p.name })}</option>
        ))}
        <option value={ADD}>{t('common.addNewPerson')}</option>
      </select>
    </label>
  );
}
