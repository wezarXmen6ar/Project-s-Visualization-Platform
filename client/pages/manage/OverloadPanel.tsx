import { useId, useState } from 'react';
import { addDays } from '../../../shared/calendar';
import { computeDailyLoad, computeWorkload, type PersonLoad, type WeekLoad } from '../../../shared/capacity';
import type { AssignmentInput } from '../../../shared/schemas';
import type { OverloadDecisionKind, WorkloadAssignment, WorkloadData } from '../../../shared/types';
import { AlertIcon } from '../../icons';
import { api } from '../../api';
import { messagesOf } from '../../errors';
import { useT } from '../../i18n/LanguageProvider';
import { dayDate, leaveInWeek, weekLabel } from '../../overloads';
import { isAccepted } from './heatmap';

interface OverloadPanelProps {
  data: WorkloadData;
  person: PersonLoad;
  week: WeekLoad;
  onClose: () => void;
  /** Called after a change is saved, so the page reloads the workload. */
  onChanged: () => void;
}

type Mode = 'split' | 'reassign' | 'accept' | null;

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
const keep = (a: WorkloadAssignment): AssignmentInput => ({ resourceId: a.resourceId, allocation: a.allocation, role: a.role });

/** One person's week: what is booked, and, when it is overbooked, a prompt to split, reassign or accept. */
export function OverloadPanel({ data, person, week, onClose, onChanged }: OverloadPanelProps) {
  const t = useT();
  const [mode, setMode] = useState<Mode>(null);
  const [allocations, setAllocations] = useState<Record<number, number>>({});
  const [moving, setMoving] = useState<number | null>(null);
  const [to, setTo] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const accepted = isAccepted(data.decisions, person.resourceId, week.weekStart);
  const personResource = data.resources.find((r) => r.id === person.resourceId);
  const leaveThisWeek = personResource ? leaveInWeek(personResource.leave, week.weekStart) : [];
  const weekRange = { start: week.weekStart, end: addDays(week.weekStart, 6) };
  // Days booked above what the person can give that day, which the weekly average can hide.
  const dayClashes = personResource
    ? computeDailyLoad([personResource], data.assignments, weekRange, data.calendar)[0].days.filter((d) => d.overloaded)
    : [];
  const clashesId = useId();
  // Who is already on the phase the moving work belongs to - the server would reject reassigning to them anyway.
  const movingItem = week.items.find((i) => i.assignmentId === moving);
  const alreadyOnPhase = new Set(
    movingItem ? data.assignments.filter((a) => a.phaseId === movingItem.phaseId).map((a) => a.resourceId) : [],
  );
  // Everyone else's load this week, to help choose who to reassign to.
  const others = computeWorkload(
    data.resources.filter((r) => r.id !== person.resourceId && !alreadyOnPhase.has(r.id)),
    data.assignments,
    weekRange,
    data.calendar,
  );

  /** The whole phase's people as the API expects them, with one assignment changed. */
  const phaseList = (phaseId: number, change: (a: WorkloadAssignment) => AssignmentInput) =>
    data.assignments.filter((a) => a.phaseId === phaseId).map(change);

  const decide = (decision: OverloadDecisionKind, reason?: string) =>
    api.recordOverloadDecision({ resourceId: person.resourceId, weekStart: week.weekStart, decision, note: reason });

  async function run(action: () => Promise<unknown>) {
    setSaving(true);
    setErrors([]);
    try {
      await action();
      setMode(null);
      onChanged();
    } catch (err) {
      setErrors(messagesOf(err, t));
    } finally {
      setSaving(false);
    }
  }

  const saveSplit = () =>
    run(async () => {
      for (const item of week.items) {
        const next = allocations[item.assignmentId];
        if (next === undefined || next === item.allocation) continue;
        await api.setPhaseAssignments(
          item.phaseId,
          phaseList(item.phaseId, (a) => (a.id === item.assignmentId ? { ...keep(a), allocation: next } : keep(a))),
        );
      }
      await decide('split');
    });

  const saveReassign = () =>
    run(async () => {
      const item = week.items.find((i) => i.assignmentId === moving);
      if (!item || to === null) return;
      await api.setPhaseAssignments(
        item.phaseId,
        phaseList(item.phaseId, (a) => (a.id === item.assignmentId ? { ...keep(a), resourceId: to } : keep(a))),
      );
      await decide('reassign');
    });

  const saveAccept = () => run(() => decide('accept', note));

  return (
    <aside className="card overload-panel">
      <div className="panel-head">
        <h2>{person.name} · {weekLabel(week.weekStart, data.calendar)}</h2>
        <button type="button" className="button secondary" onClick={onClose}>Close</button>
      </div>
      <p>
        {Math.round(week.load)}% booked of {Math.round(week.available)}% available
        {week.leaveDays > 0 ? ` · ${plural(week.leaveDays, 'day')} of leave` : ''}
      </p>
      {leaveThisWeek.map((l) => (
        <p key={`${l.start}-${l.end}`} className="muted">
          On leave {l.start === l.end ? dayDate(l.start) : `${dayDate(l.start)} – ${dayDate(l.end)}`}
          {l.note ? ` · ${l.note}` : ''}
        </p>
      ))}
      {week.items.length === 0 ? (
        <p className="muted">Nothing booked this week.</p>
      ) : (
        <ul className="people-list">
          {week.items.map((i) => (
            <li key={i.assignmentId}>{i.projectName} · {i.phaseName}: {i.allocation}% for {plural(i.days, 'day')}</li>
          ))}
        </ul>
      )}

      {dayClashes.length > 0 ? (
        <>
          <h3 id={clashesId}>Days overbooked on their own</h3>
          <ul className="people-list" aria-labelledby={clashesId}>
            {dayClashes.map((d) => (
              <li key={d.date}>{`${dayDate(d.date)}: ${Math.round(d.load)}% booked, ${Math.round(d.available)}% available`}</li>
            ))}
          </ul>
        </>
      ) : null}

      {errors.length > 0 ? (
        <div className="errors" role="alert">
          <AlertIcon />
          <ul>{errors.map((m) => <li key={m}>{m}</li>)}</ul>
        </div>
      ) : null}

      {week.overloaded ? (
        <div className="decision">
          <h3>{accepted ? 'Overbooked, and accepted' : 'This week is overbooked. What do you want to do?'}</h3>
          <div className="decision-options">
            <button type="button" className="button secondary" aria-pressed={mode === 'split'} onClick={() => setMode('split')}>
              Split the time
            </button>
            <button
              type="button"
              className="button secondary"
              aria-pressed={mode === 'reassign'}
              disabled={week.items.length === 0}
              onClick={() => setMode('reassign')}
            >
              Reassign work
            </button>
            <button type="button" className="button secondary" aria-pressed={mode === 'accept'} onClick={() => setMode('accept')}>
              Accept the risk
            </button>
            <button type="button" className="button secondary" disabled>Pause a project</button>
            <button type="button" className="button secondary" disabled>Delay a phase</button>
          </div>
          <p className="muted">Pausing a project and delaying a phase arrive with holds and phase changes in later milestones.</p>

          {mode === 'split' ? (
            <div className="decision-form">
              {week.items.map((i) => (
                <label key={i.assignmentId}>
                  Allocation for {i.projectName} · {i.phaseName} (%)
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={Number.isNaN(allocations[i.assignmentId]) ? '' : allocations[i.assignmentId] ?? i.allocation}
                    onChange={(e) => setAllocations((s) => ({ ...s, [i.assignmentId]: e.target.valueAsNumber }))}
                  />
                </label>
              ))}
              <button type="button" className="button" disabled={saving} onClick={() => void saveSplit()}>Save new allocations</button>
            </div>
          ) : null}

          {mode === 'reassign' ? (
            <div className="decision-form">
              <label>
                Work to move
                <select value={moving ?? ''} onChange={(e) => setMoving(e.target.value === '' ? null : Number(e.target.value))}>
                  <option value="">Choose…</option>
                  {week.items.map((i) => (
                    <option key={i.assignmentId} value={i.assignmentId}>{i.projectName} · {i.phaseName} ({i.allocation}%)</option>
                  ))}
                </select>
              </label>
              <label>
                Give it to
                <select value={to ?? ''} onChange={(e) => setTo(e.target.value === '' ? null : Number(e.target.value))}>
                  <option value="">Choose a person…</option>
                  {others.map((o) => (
                    <option key={o.resourceId} value={o.resourceId}>
                      {o.name} ({Math.round(o.weeks[0]?.load ?? 0)}% booked this week)
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className="button"
                disabled={saving || moving === null || to === null}
                onClick={() => void saveReassign()}
              >
                Reassign
              </button>
            </div>
          ) : null}

          {mode === 'accept' ? (
            <div className="decision-form">
              <label>
                Why is this OK? (optional)
                <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
              </label>
              <button type="button" className="button" disabled={saving} onClick={() => void saveAccept()}>Record the decision</button>
            </div>
          ) : null}
        </div>
      ) : null}
    </aside>
  );
}
