import { GripIcon, TrashIcon } from '../../icons';
import { useT } from '../../i18n/LanguageProvider';
import { moveItem, useReorder } from '../../useReorder';
import type { SubPhaseDraft } from './projectDraft';

interface SubPhaseListProps {
  phaseNumber: number;
  subs: SubPhaseDraft[];
  onChange: (subs: SubPhaseDraft[]) => void;
}

/**
 * One phase's sub-phase rows plus "+ Add sub-phase". Owns its own reorder hook (separate from the phase list's, and
 * from every other phase's), so dragging or arrow-keying a sub-phase's handle only reorders within this phase.
 */
export function SubPhaseList({ phaseNumber, subs, onChange }: SubPhaseListProps) {
  const t = useT();
  const { handleProps, rowProps } = useReorder(subs.length, (from, to) => onChange(moveItem(subs, from, to)));

  function update(index: number, patch: Partial<SubPhaseDraft>) {
    onChange(subs.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  }

  return (
    <div className="sub-phases">
      {subs.map((sub, i) => {
        const { className: rowClassName, ...rowRest } = rowProps(i);
        return (
        <div className={`sub-phase-row ${rowClassName}`.trim()} key={i} {...rowRest}>
          <button {...handleProps(i, t('wizard.reorderSub', { phase: phaseNumber, sub: i + 1 }))}>
            <GripIcon />
          </button>
          <input
            aria-label={t('wizard.subName', { phase: phaseNumber, sub: i + 1 })}
            placeholder={t('wizard.subPlaceholder')}
            value={sub.name}
            dir="auto"
            data-user-content=""
            onChange={(e) => update(i, { name: e.target.value })}
          />
          <input
            aria-label={t('wizard.subDays', { phase: phaseNumber, sub: i + 1 })}
            type="number"
            min={1}
            value={Number.isNaN(sub.durationDays) ? '' : sub.durationDays}
            onChange={(e) => update(i, { durationDays: e.target.valueAsNumber })}
          />
          {i === 0 ? (
            <span className="muted">{t('wizard.startsWithPhase')}</span>
          ) : (
            <select
              aria-label={t('wizard.subStarts', { phase: phaseNumber, sub: i + 1 })}
              value={sub.withPrevious ? 'with' : 'after'}
              onChange={(e) => update(i, { withPrevious: e.target.value === 'with' })}
            >
              <option value="after">{t('wizard.afterAbove')}</option>
              <option value="with">{t('wizard.withAbove')}</option>
            </select>
          )}
          <button
            type="button"
            className="button ghost-icon"
            aria-label={t('wizard.removeSub', { phase: phaseNumber, sub: i + 1 })}
            onClick={() => onChange(subs.filter((_, j) => j !== i))}
          >
            <TrashIcon />
          </button>
        </div>
        );
      })}
      <button
        type="button"
        className="button secondary"
        aria-label={t('wizard.addSubTo', { phase: phaseNumber })}
        onClick={() => onChange([...subs, { name: '', durationDays: 5, withPrevious: false }])}
      >
        {t('wizard.addSub')}
      </button>
    </div>
  );
}
