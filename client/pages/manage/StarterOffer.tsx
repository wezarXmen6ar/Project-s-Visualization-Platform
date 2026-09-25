import { useEffect, useState } from 'react';
import type { StarterSuggestion } from '../../../shared/types';
import { api } from '../../api';
import { messagesOf } from '../../errors';
import { useLang, useT } from '../../i18n/LanguageProvider';
import { phaseName } from '../../i18n/listNames';
import { useLists } from '../../useLists';
import { AlertIcon } from '../../icons';
import { useAsync } from '../../useAsync';

/** "all" means every top-level phase; otherwise a comma-separated list of phase ids, positive integers only. */
function parsePhaseIds(param: string): number[] | undefined {
  if (param === 'all') return undefined;
  return param
    .split(',')
    .map(Number)
    .filter((n) => Number.isInteger(n) && n > 0);
}

interface StarterOfferProps {
  projectId: number;
  /** The raw `starter` query value: "all" or a comma-separated list of phase ids. */
  starterParam: string;
  /** Called after the ticked items are added: reloads the project's to-dos and removes the parameter. */
  onAdded: () => void;
  /** Called on Skip, or quietly when there turn out to be no suggestions: removes the parameter only. */
  onSkip: () => void;
}

/** Offered right after a project is created or gets new phases: starter checklists for its (new) top-level phases. */
export function StarterOffer({ projectId, starterParam, onAdded, onSkip }: StarterOfferProps) {
  const t = useT();
  const { lang } = useLang();
  const { lists } = useLists();
  const phaseIds = parsePhaseIds(starterParam);
  const suggestions = useAsync(() => api.starterSuggestions(projectId, phaseIds), [projectId, starterParam]);
  const [checked, setChecked] = useState<Set<number> | null>(null);
  const [adding, setAdding] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    if (suggestions.data && checked === null) {
      if (suggestions.data.length === 0) {
        onSkip();
      } else {
        setChecked(new Set(suggestions.data.map((_, i) => i)));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suggestions.data]);

  if (!suggestions.data || suggestions.data.length === 0 || checked === null) return null;

  function toggle(index: number) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  async function onAccept() {
    if (!suggestions.data) return;
    const items = suggestions.data
      .filter((_, i) => checked!.has(i))
      .map((s) => ({ phaseId: s.phaseId, title: s.title }));
    setAdding(true);
    setErrors([]);
    try {
      await api.acceptStarters(projectId, items);
      onAdded();
    } catch (err) {
      setErrors(messagesOf(err, t));
    } finally {
      setAdding(false);
    }
  }

  const groups: { phaseId: number; phaseName: string; items: { index: number; title: string }[] }[] = [];
  suggestions.data.forEach((s: StarterSuggestion, i) => {
    let group = groups.find((g) => g.phaseId === s.phaseId);
    if (!group) {
      group = { phaseId: s.phaseId, phaseName: s.phaseName, items: [] };
      groups.push(group);
    }
    group.items.push({ index: i, title: s.title });
  });

  const n = checked.size;

  return (
    <section className="card">
      <h2>Starter to-dos</h2>
      <p className="field-hint">From your checklists in Settings. Untick any you don't need.</p>
      {errors.length > 0 ? (
        <div className="errors" role="alert">
          <AlertIcon />
          <ul>{errors.map((m) => <li key={m}>{m}</li>)}</ul>
        </div>
      ) : null}
      {groups.map((g) => (
        <div key={g.phaseId}>
          <h3>{phaseName(g.phaseName, lists, lang)}</h3>
          <ul className="check-group-list">
            {g.items.map((item) => (
              <li key={item.index}>
                <label className="check">
                  <input type="checkbox" checked={checked.has(item.index)} onChange={() => toggle(item.index)} />
                  {item.title}
                </label>
              </li>
            ))}
          </ul>
        </div>
      ))}
      <div className="wizard-actions">
        <button type="button" className="button" disabled={n === 0 || adding} onClick={() => void onAccept()}>
          {adding ? 'Adding…' : `Add ${n} to-do${n === 1 ? '' : 's'}`}
        </button>
        <button type="button" className="button secondary" onClick={onSkip}>Skip</button>
      </div>
    </section>
  );
}
