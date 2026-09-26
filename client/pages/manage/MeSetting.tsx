import { useEffect, useState } from 'react';
import type { ResourceRecord } from '../../../shared/types';
import { api } from '../../api';
import { messagesOf } from '../../errors';
import { useT } from '../../i18n/LanguageProvider';
import { AlertIcon } from '../../icons';
import { useMe } from '../../useMe';

interface MeSettingProps {
  people: ResourceRecord[];
}

/** Who "I am": an active tech-team person, used for Mine and My next steps. */
export function MeSetting({ people }: MeSettingProps) {
  const t = useT();
  const { me, reload } = useMe();
  const [saved, setSaved] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    if (saved) {
      const t = setTimeout(() => setSaved(false), 2000);
      return () => clearTimeout(t);
    }
  }, [saved]);

  const options = people
    .filter((p) => p.side === 'tech' && p.employment === 'staff' && p.active)
    .sort((a, b) => a.name.localeCompare(b.name));

  async function onChange(value: string) {
    const resourceId = value === '' ? null : Number(value);
    setErrors([]);
    try {
      await api.setMe(resourceId);
      setSaved(true);
      reload();
    } catch (err) {
      setErrors(messagesOf(err, t));
    }
  }

  return (
    <section className="card">
      <h2>{t('me.title')}</h2>
      <p className="field-hint">{t('me.hint')}</p>
      {errors.length > 0 ? (
        <div className="errors" role="alert">
          <AlertIcon />
          <ul>{errors.map((m) => <li key={m}>{m}</li>)}</ul>
        </div>
      ) : null}
      <label>
        {t('me.title')}
        <select value={me?.resourceId === null || me?.resourceId === undefined ? '' : String(me.resourceId)} onChange={(e) => void onChange(e.target.value)}>
          <option value="">{t('common.notSet')}</option>
          {options.map((p) => <option key={p.id} value={String(p.id)}>{p.name}</option>)}
        </select>
      </label>
      {saved ? <span role="status">{t('common.saved')}</span> : null}
    </section>
  );
}
