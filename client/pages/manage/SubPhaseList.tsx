import { GripIcon, TrashIcon } from '../../icons';
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
          <button {...handleProps(i, `Reorder phase ${phaseNumber} sub-phase ${i + 1}`)}>
            <GripIcon />
          </button>
          <input
            aria-label={`Phase ${phaseNumber} sub-phase ${i + 1} name`}
            placeholder="e.g. Increment 1 – Sign-in"
            value={sub.name}
            onChange={(e) => update(i, { name: e.target.value })}
          />
          <input
            aria-label={`Phase ${phaseNumber} sub-phase ${i + 1} working days`}
            type="number"
            min={1}
            value={Number.isNaN(sub.durationDays) ? '' : sub.durationDays}
            onChange={(e) => update(i, { durationDays: e.target.valueAsNumber })}
          />
          {i === 0 ? (
            <span className="muted">Starts with the phase</span>
          ) : (
            <select
              aria-label={`Phase ${phaseNumber} sub-phase ${i + 1} starts`}
              value={sub.withPrevious ? 'with' : 'after'}
              onChange={(e) => update(i, { withPrevious: e.target.value === 'with' })}
            >
              <option value="after">After the ones above</option>
              <option value="with">With the one above</option>
            </select>
          )}
          <button
            type="button"
            className="button ghost-icon"
            aria-label={`Remove phase ${phaseNumber} sub-phase ${i + 1}`}
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
        aria-label={`Add sub-phase to phase ${phaseNumber}`}
        onClick={() => onChange([...subs, { name: '', durationDays: 5, withPrevious: false }])}
      >
        + Add sub-phase
      </button>
    </div>
  );
}
