import { useEffect, useRef, useState, type DragEvent, type FormEvent, type KeyboardEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { DEFAULT_CALENDAR, isISODate, todayLocal } from '../../../shared/calendar';
import { newProjectSchema, toIssues, type ValidationIssue } from '../../../shared/schemas';
import { schedulePhases, type PhaseInput } from '../../../shared/scheduler';
import { AlertIcon, ArrowLeftIcon, PlusIcon, TrashIcon } from '../../icons';
import { ApiError, api } from '../../api';
import { Gantt } from '../../gantt/Gantt';
import { phaseRows, rangeFor } from '../../gantt/rows';
import { useElementWidth } from '../../gantt/useElementWidth';
import { useAsync } from '../../useAsync';

function DragHandleIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <circle cx="9" cy="6" r="1.3" fill="currentColor" />
      <circle cx="9" cy="12" r="1.3" fill="currentColor" />
      <circle cx="9" cy="18" r="1.3" fill="currentColor" />
      <circle cx="15" cy="6" r="1.3" fill="currentColor" />
      <circle cx="15" cy="12" r="1.3" fill="currentColor" />
      <circle cx="15" cy="18" r="1.3" fill="currentColor" />
    </svg>
  );
}

const DEFAULT_PHASES: PhaseInput[] = [
  { name: 'Requirements gathering', durationDays: 10 },
  { name: 'Business analysis', durationDays: 10 },
  { name: 'Design', durationDays: 10 },
  { name: 'Development', durationDays: 40 },
  { name: 'QA', durationDays: 15 },
  { name: 'UAT', durationDays: 10 },
  { name: 'Go-live', durationDays: 2 },
];

export function CreateProjectPage() {
  const navigate = useNavigate();
  const calendar = useAsync(() => api.getCalendar(), []);
  const [name, setName] = useState('');
  const [jiraKey, setJiraKey] = useState('');
  const [color, setColor] = useState('#3b82f6');
  const [startDate, setStartDate] = useState(todayLocal());
  const [phases, setPhases] = useState<PhaseInput[]>(DEFAULT_PHASES);
  const [issues, setIssues] = useState<ValidationIssue[]>([]);
  const [saving, setSaving] = useState(false);
  const [chartRef, chartWidth] = useElementWidth<HTMLDivElement>();
  const dragIndexRef = useRef<number | null>(null);
  const handleRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [pendingFocusIndex, setPendingFocusIndex] = useState<number | null>(null);

  useEffect(() => {
    if (pendingFocusIndex === null) return;
    handleRefs.current[pendingFocusIndex]?.focus();
    setPendingFocusIndex(null);
  }, [pendingFocusIndex]);

  const cal = calendar.data ?? DEFAULT_CALENDAR;
  const previewPhases = phases.filter((p) => p.name.trim() !== '' && Number.isInteger(p.durationDays) && p.durationDays >= 1);
  const scheduled = isISODate(startDate) ? schedulePhases(startDate, previewPhases, cal) : [];
  const rows = phaseRows({ phases: scheduled });
  const range = rangeFor(rows, isISODate(startDate) ? startDate : todayLocal());

  function updatePhase(index: number, patch: Partial<PhaseInput>) {
    setPhases((ps) => ps.map((p, i) => (i === index ? { ...p, ...patch } : p)));
  }

  function movePhase(from: number, to: number) {
    if (from === to) return;
    setPhases((ps) => {
      const next = [...ps];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }

  function onPhaseDragStart(index: number) {
    return (e: DragEvent<HTMLButtonElement>) => {
      dragIndexRef.current = index;
      e.dataTransfer.setData('text/plain', String(index));
      e.dataTransfer.effectAllowed = 'move';
    };
  }

  function onPhaseDragOver(e: DragEvent<HTMLDivElement>) {
    if (dragIndexRef.current !== null) {
      e.preventDefault();
    }
  }

  function onPhaseDrop(index: number) {
    return (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      const from = dragIndexRef.current;
      dragIndexRef.current = null;
      if (from === null) return;
      movePhase(from, index);
    };
  }

  function onHandleKeyDown(index: number) {
    return (e: KeyboardEvent<HTMLButtonElement>) => {
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (index === 0) return;
        movePhase(index, index - 1);
        setPendingFocusIndex(index - 1);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (index === phases.length - 1) return;
        movePhase(index, index + 1);
        setPendingFocusIndex(index + 1);
      }
    };
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const parsed = newProjectSchema.safeParse({ name, jiraKey, color, startDate, phases });
    if (!parsed.success) {
      setIssues(toIssues(parsed.error));
      return;
    }
    setIssues([]);
    setSaving(true);
    try {
      const project = await api.createProject(parsed.data);
      navigate(`/manage/projects/${project.id}`);
    } catch (err) {
      if (err instanceof ApiError && err.issues.length > 0) setIssues(err.issues);
      else setIssues([{ path: '', message: err instanceof Error ? err.message : String(err) }]);
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="page">
      <div className="page-header">
        <div>
          <Link to="/manage" className="crumb"><ArrowLeftIcon />Projects</Link>
          <h1>New project</h1>
        </div>
      </div>

      <form onSubmit={onSubmit} noValidate>
        {issues.length > 0 ? (
          <div className="errors" role="alert">
            <AlertIcon />
            <ul>{issues.map((i) => <li key={`${i.path}-${i.message}`}>{i.message}</li>)}</ul>
          </div>
        ) : null}

        <section className="card">
          <h2>Details</h2>
          <div className="form-grid">
            <label>Project name<input value={name} onChange={(e) => setName(e.target.value)} /></label>
            <label>Jira key<input value={jiraKey} onChange={(e) => setJiraKey(e.target.value)} placeholder="PRJ-123" /></label>
            <label>Start date<input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></label>
            <label>Colour<input type="color" value={color} onChange={(e) => setColor(e.target.value)} /></label>
          </div>
        </section>

        <section className="card">
          <h2>Phases</h2>
          <p className="field-hint">Durations are in working days. Dates are calculated from the working calendar.</p>
          {phases.map((phase, i) => (
            <div
              className="phase-row"
              key={i}
              onDragOver={onPhaseDragOver}
              onDrop={onPhaseDrop(i)}
              onDragEnd={() => { dragIndexRef.current = null; }}
            >
              <button
                type="button"
                className="drag-handle"
                aria-label={`Reorder phase ${i + 1}`}
                draggable
                onDragStart={onPhaseDragStart(i)}
                onKeyDown={onHandleKeyDown(i)}
                ref={(el) => { handleRefs.current[i] = el; }}
              >
                <DragHandleIcon />
              </button>
              <input
                aria-label={`Phase ${i + 1} name`}
                placeholder="Phase name"
                value={phase.name}
                onChange={(e) => updatePhase(i, { name: e.target.value })}
              />
              <input
                aria-label={`Phase ${i + 1} working days`}
                type="number"
                min={1}
                value={Number.isNaN(phase.durationDays) ? '' : phase.durationDays}
                onChange={(e) => updatePhase(i, { durationDays: e.target.valueAsNumber })}
              />
              <button
                type="button"
                className="button ghost-icon"
                aria-label={`Remove phase ${i + 1}`}
                onClick={() => setPhases((ps) => ps.filter((_, j) => j !== i))}
              >
                <TrashIcon />
              </button>
            </div>
          ))}
          <button type="button" className="button secondary" onClick={() => setPhases((ps) => [...ps, { name: '', durationDays: 5 }])}>
            <PlusIcon />Add phase
          </button>
        </section>

        <section className="card">
          <h2>Preview</h2>
          <div className="chart-scroll" ref={chartRef}>
            <Gantt rows={rows} range={range} width={chartWidth} />
          </div>
        </section>

        <button type="submit" className="button" disabled={saving}>
          {saving ? 'Saving…' : 'Create project'}
        </button>
      </form>
    </main>
  );
}
