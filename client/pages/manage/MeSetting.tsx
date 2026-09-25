import { useEffect, useState } from 'react';
import type { ResourceRecord } from '../../../shared/types';
import { api } from '../../api';
import { useMe } from '../../useMe';

interface MeSettingProps {
  people: ResourceRecord[];
}

/** Who "I am": an active tech-team person, used for Mine, Next up and My next steps. */
export function MeSetting({ people }: MeSettingProps) {
  const { me, reload } = useMe();
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (saved) {
      const t = setTimeout(() => setSaved(false), 2000);
      return () => clearTimeout(t);
    }
  }, [saved]);

  const options = people.filter((p) => p.side === 'tech' && p.active).sort((a, b) => a.name.localeCompare(b.name));

  async function onChange(value: string) {
    const resourceId = value === '' ? null : Number(value);
    await api.setMe(resourceId);
    setSaved(true);
    reload();
  }

  return (
    <section className="card">
      <h2>I am</h2>
      <p className="field-hint">Used for Mine, Next up and My next steps.</p>
      <label>
        I am
        <select value={me?.resourceId === null || me?.resourceId === undefined ? '' : String(me.resourceId)} onChange={(e) => void onChange(e.target.value)}>
          <option value="">Not set</option>
          {options.map((p) => <option key={p.id} value={String(p.id)}>{p.name}</option>)}
        </select>
      </label>
      {saved ? <span role="status">Saved</span> : null}
    </section>
  );
}
