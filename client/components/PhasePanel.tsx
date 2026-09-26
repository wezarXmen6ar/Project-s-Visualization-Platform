import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router';
import { addDays, countWorkingDays, dayOfWeek, todayLocal, type ISODate, type WorkCalendar } from '../../shared/calendar';
import type { MessageKey } from '../../shared/i18n/en';
import type {
  AttachmentRecord, EntryRecord, EntryType, ListValue, Me, PhaseRecord, ProjectRecord, ResourceRecord, SubPhaseRecord,
  ToDoRecord,
} from '../../shared/types';
import { api } from '../api';
import { FileIcon } from '../icons';
import { useFormat } from '../i18n/format';
import { useLang, useT } from '../i18n/LanguageProvider';
import { listName } from '../i18n/listNames';
import { weekLabel } from '../overloads';
import { ASSIGNMENT_ROLE_KEY } from '../pages/manage/labels';
import { useAsync } from '../useAsync';
import type { PhaseNameFor } from '../todos';
import { EntryForm } from './EntryForm';
import { EntryItem } from './EntryItem';
import { FilePreview } from './FilePreview';
import { ToDoForm } from './ToDoForm';
import { ToDoRow } from './ToDoRow';
import { Uploader } from './Uploader';

/**
 * The open phase kept in the URL as `?phase=<id>`, so reload and Back work. `open` remembers what had focus (the
 * clicked bar), and `close` gives focus back to it.
 */
export function usePhaseParam() {
  const [searchParams, setSearchParams] = useSearchParams();
  const raw = searchParams.get('phase');
  const phaseId = raw !== null && /^\d+$/.test(raw) ? Number(raw) : null;
  const triggerRef = useRef<HTMLElement | null>(null);

  const open = useCallback(
    (id: number) => {
      const active = document.activeElement;
      triggerRef.current = active instanceof Element && active !== document.body ? (active as HTMLElement) : null;
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set('phase', String(id));
        return next;
      });
    },
    [setSearchParams],
  );

  const close = useCallback(() => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('phase');
      return next;
    });
    const trigger = triggerRef.current;
    triggerRef.current = null;
    if (trigger?.isConnected) trigger.focus();
  }, [setSearchParams]);

  return { phaseId, open, close };
}

type ItemKind = 'meeting' | 'update' | 'todo' | 'file';

interface HistoryItem {
  key: string;
  kind: ItemKind;
  /** What the list sorts and groups by: an entry's date, a to-do's due (or created) date, a file's document (or upload) date. */
  date: ISODate;
  id: number;
  entry?: EntryRecord;
  todo?: ToDoRecord;
  attachment?: AttachmentRecord;
}

const TYPE_ORDER: ItemKind[] = ['meeting', 'update', 'todo', 'file'];
const TYPE_LABEL: Record<ItemKind, MessageKey> = {
  meeting: 'phasePanel.meetings',
  update: 'phasePanel.updates',
  todo: 'phasePanel.todos',
  file: 'phasePanel.files',
};

type Grouping = 'week' | 'type';

/** Monday of the week `d` falls in. */
function weekStartOf(d: ISODate): ISODate {
  return addDays(d, -((dayOfWeek(d) + 6) % 7));
}

function findPhase(project: ProjectRecord, id: number): { top: PhaseRecord; sub: SubPhaseRecord | null } | null {
  for (const top of project.phases) {
    if (top.id === id) return { top, sub: null };
    const sub = top.subPhases.find((s) => s.id === id);
    if (sub) return { top, sub };
  }
  return null;
}

export interface PhasePanelProps {
  project: ProjectRecord;
  /** A top-level phase or a sub-phase. A top-level phase's history includes its sub-phases'. */
  phaseId: number;
  /** 'present' is read-only for stakeholders: only highlighted entries and their files, no to-dos, names or buttons. */
  mode: 'manage' | 'present';
  calendar: WorkCalendar;
  /** Maps a top-level phase's stored name to its display name (e.g. its Arabic name). */
  nameFor?: PhaseNameFor;
  onClose: () => void;
  /** Manage mode: who "I am", for the to-do form's assignee default. */
  me?: Me;
  /** Manage mode: everyone in Resources, for the meeting form's attendees. */
  people?: ResourceRecord[];
  /** Manage mode: the project's to-dos (the panel shows the ones on this phase). */
  todos?: ToDoRecord[];
  onToggleToDo?: (todo: ToDoRecord) => void;
  /** Manage mode: for the meeting form's "Attach files" type default. */
  attachmentTypes?: ListValue[];
  /** Manage mode: called after something was added from the panel, so the page can reload too. */
  onChanged?: () => void;
}

/**
 * The phase side panel, opened from a Gantt bar: a non-modal dialog fixed to the viewport's inline end (the right in
 * English, the left in Arabic). It shows the phase's dates, its people (manage mode) and its history — meetings,
 * updates, to-dos and files in one newest-first list, grouped by week or by type.
 */
export function PhasePanel({
  project, phaseId, mode, calendar, nameFor = (n) => n, onClose, me, people = [], todos = [], onToggleToDo,
  attachmentTypes = [], onChanged,
}: PhasePanelProps) {
  const t = useT();
  const { lang, dir } = useLang();
  const { formatDate } = useFormat();
  const headingId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const manage = mode === 'manage';

  const [version, setVersion] = useState(0);
  const entriesLoaded = useAsync(() => api.listEntries(project.id, phaseId), [project.id, phaseId, version]);
  const attachmentsLoaded = useAsync(() => api.listAttachments(project.id), [project.id, version]);
  const [grouping, setGrouping] = useState<Grouping>('week');
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState<EntryType | 'todo' | 'file' | null>(null);

  // A different phase starts afresh, with focus on the panel.
  useEffect(() => {
    setAdding(null);
    closeRef.current?.focus();
  }, [phaseId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented) onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const found = findPhase(project, phaseId);
  if (!found) return null;
  const { top, sub } = found;
  const piece = sub ?? top;
  const ids = new Set<number>(sub ? [sub.id] : [top.id, ...top.subPhases.map((s) => s.id)]);

  const saved = () => {
    setAdding(null);
    setVersion((v) => v + 1);
    onChanged?.();
  };

  // The history, in one list.
  const loaded = entriesLoaded.data !== undefined && attachmentsLoaded.data !== undefined;
  const allEntries = entriesLoaded.data ?? [];
  const entries = manage ? allEntries : allEntries.filter((e) => e.highlight);
  const entryIds = new Set(entries.map((e) => e.id));
  const attachments = attachmentsLoaded.data ?? [];
  const attachmentsByEntry = new Map<number, AttachmentRecord[]>();
  for (const a of attachments) {
    if (a.entryId !== null && entryIds.has(a.entryId)) {
      attachmentsByEntry.set(a.entryId, [...(attachmentsByEntry.get(a.entryId) ?? []), a]);
    }
  }
  const todoById = new Map(todos.map((x) => [x.id, x]));
  const items: HistoryItem[] = [
    ...entries.map((e): HistoryItem => ({ key: `entry-${e.id}`, kind: e.type, date: e.effectiveDate, id: e.id, entry: e })),
    ...(manage
      ? todos
          .filter((x) => x.phase !== null && ids.has(x.phase.id))
          .map((x): HistoryItem => ({ key: `todo-${x.id}`, kind: 'todo', date: x.dueDate ?? x.createdAt.slice(0, 10), id: x.id, todo: x }))
      : []),
    // A file on an entry shown here is listed under that entry, not again on its own. Stakeholders see only files of
    // the highlighted entries.
    ...(manage
      ? attachments
          .filter((a) => a.phase !== null && ids.has(a.phase.id) && !(a.entryId !== null && entryIds.has(a.entryId)))
          .map((a): HistoryItem => ({
            key: `file-${a.id}`, kind: 'file', date: a.documentDate ?? a.uploadedAt.slice(0, 10), id: a.id, attachment: a,
          }))
      : []),
  ].sort((a, b) => (a.date !== b.date ? (a.date < b.date ? 1 : -1) : b.id - a.id));

  const groups: { key: string; label: string; items: HistoryItem[] }[] = [];
  if (grouping === 'week') {
    const byWeek = new Map<ISODate, HistoryItem[]>();
    for (const item of items) {
      const week = weekStartOf(item.date);
      byWeek.set(week, [...(byWeek.get(week) ?? []), item]);
    }
    for (const [week, weekItems] of byWeek) {
      groups.push({ key: `week-${week}`, label: weekLabel(week, calendar, lang), items: weekItems });
    }
  } else {
    for (const kind of TYPE_ORDER) {
      const kindItems = items.filter((x) => x.kind === kind);
      if (kindItems.length > 0) groups.push({ key: `type-${kind}`, label: t(TYPE_LABEL[kind]), items: kindItems });
    }
  }

  function toggleGroup(key: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function renderItem(item: HistoryItem): ReactNode {
    if (item.entry) {
      const entry = item.entry;
      return (
        <EntryItem
          key={item.key}
          entry={entry}
          nameFor={nameFor}
          attachments={attachmentsByEntry.get(entry.id) ?? []}
          followUps={manage ? entry.followUpToDoIds.map((id) => todoById.get(id)).filter((x): x is ToDoRecord => x !== undefined) : []}
          presentation={!manage}
        />
      );
    }
    if (item.todo) {
      return <ToDoRow key={item.key} todo={item.todo} today={todayLocal()} onToggle={(x) => onToggleToDo?.(x)} nameFor={nameFor} />;
    }
    return item.attachment ? <PanelFile key={item.key} attachment={item.attachment} /> : null;
  }

  const topName = nameFor(top.name);
  const phasePeople = manage ? project.assignments.filter((a) => a.phaseId === piece.id) : [];

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-labelledby={headingId}
      className="phase-panel"
      dir={dir}
    >
      <div className="phase-panel-head">
        <h2 id={headingId}>
          {topName}
          {sub ? (
            <>
              {' › '}
              <span dir="auto" data-user-content="">{sub.name}</span>
            </>
          ) : null}
        </h2>
        <button ref={closeRef} type="button" className="phase-panel-close" aria-label={t('common.close')} onClick={onClose}>
          ×
        </button>
      </div>

      <div className="phase-panel-body">
        <div className="phase-panel-summary">
          <p>
            {t('project.pieceDates', {
              start: formatDate(piece.start),
              end: formatDate(piece.end),
              count: countWorkingDays(piece.start, piece.end, calendar),
            })}
          </p>
          {manage ? (
            <div className="phase-panel-people">
              <h3>{t('phasePanel.people')}</h3>
              {phasePeople.length === 0 ? (
                <p className="muted">{t('project.noOneAssigned')}</p>
              ) : (
                <ul>
                  {phasePeople.map((a) => (
                    <li key={a.id}>
                      <Link to={`/manage/resources/${a.resource.id}`} dir="auto" data-user-content="">{a.resource.name}</Link>
                      {` · ${a.allocation}% · `}
                      {t(ASSIGNMENT_ROLE_KEY[a.role])}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}
        </div>

        {manage && me ? (
          adding === 'meeting' || adding === 'update' ? (
            <EntryForm
              project={project}
              me={me}
              people={people}
              type={adding}
              nameFor={nameFor}
              attachmentTypes={attachmentTypes}
              presetPhaseId={phaseId}
              onSave={async (input) => {
                await api.createEntry(project.id, input);
                saved();
              }}
              onCancel={() => setAdding(null)}
            />
          ) : adding === 'todo' ? (
            <ToDoForm
              project={project}
              me={me}
              nameFor={nameFor}
              presetPhaseId={phaseId}
              onSave={async (input) => {
                await api.createToDo(project.id, input);
                saved();
              }}
              onCancel={() => setAdding(null)}
            />
          ) : adding === 'file' ? (
            <div className="upload-row">
              <Uploader
                projectId={project.id}
                phaseId={phaseId}
                buttonLabel={t('attachments.uploadFile')}
                onUploaded={() => {
                  setVersion((v) => v + 1);
                  onChanged?.();
                }}
              />
              <button type="button" className="button secondary" onClick={() => setAdding(null)}>
                {t('phasePanel.doneUploading')}
              </button>
            </div>
          ) : (
            <div className="phase-panel-actions">
              <button type="button" className="button secondary" onClick={() => setAdding('meeting')}>{t('history.addMeeting')}</button>
              <button type="button" className="button secondary" onClick={() => setAdding('update')}>{t('history.addUpdate')}</button>
              <button type="button" className="button secondary" onClick={() => setAdding('todo')}>{t('todo.add')}</button>
              <button type="button" className="button secondary" onClick={() => setAdding('file')}>{t('attachments.uploadFile')}</button>
            </div>
          )
        ) : null}

        <section className="phase-panel-history" aria-labelledby={`${headingId}-history`}>
          <div className="phase-panel-history-head">
            <h3 id={`${headingId}-history`}>{t('phasePanel.history')}</h3>
            {items.length > 0 ? <div role="radiogroup" aria-label={t('phasePanel.groupBy')} className="segmented">
              {(['week', 'type'] as const).map((g) => (
                <label key={g} className={grouping === g ? 'active' : undefined}>
                  <input
                    type="radio"
                    name={`${headingId}-grouping`}
                    className="visually-hidden"
                    checked={grouping === g}
                    onChange={() => setGrouping(g)}
                  />
                  {t(g === 'week' ? 'phasePanel.byWeek' : 'phasePanel.byType')}
                </label>
              ))}
            </div> : null}
          </div>

          {!loaded ? (
            <p className="muted">{t('common.loading')}</p>
          ) : items.length === 0 ? (
            <p className="muted">{t(manage ? 'phasePanel.nothingYet' : 'phasePanel.nothingToShow')}</p>
          ) : (
            groups.map((group) => {
              const open = !collapsed.has(group.key);
              return (
                <details key={group.key} className="phase-panel-group" open={open}>
                  <summary
                    onClick={(e) => {
                      e.preventDefault();
                      toggleGroup(group.key);
                    }}
                  >
                    <span className="phase-panel-group-name">{group.label}</span>
                    <span className="phase-panel-group-count">{group.items.length}</span>
                  </summary>
                  {open ? <ul className="phase-panel-items">{group.items.map(renderItem)}</ul> : null}
                </details>
              );
            })
          )}
        </section>
      </div>
    </div>
  );
}

/** A file on its own in the panel's history: its name, type and date, with Preview (when possible) and Download. */
function PanelFile({ attachment: a }: { attachment: AttachmentRecord }) {
  const t = useT();
  const { lang } = useLang();
  const { formatDate } = useFormat();
  const [previewing, setPreviewing] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const date = a.documentDate ?? a.uploadedAt.slice(0, 10);

  return (
    <li className="phase-panel-file">
      <FileIcon />
      <div className="phase-panel-file-text">
        <span className="phase-panel-file-name" dir="auto" data-user-content="">{a.name}</span>
        <div className="entry-item-meta">
          {a.type ? listName(a.type, lang) : t('attachments.noType')}
          {' · '}
          {formatDate(date)}
        </div>
      </div>
      <div className="option-add-actions">
        {a.previewable ? (
          <button
            ref={triggerRef}
            type="button"
            className="button secondary"
            dir="auto"
            data-user-content=""
            aria-label={t('attachments.previewAria', { name: a.name })}
            onClick={() => setPreviewing(true)}
          >
            {t('common.preview')}
          </button>
        ) : null}
        <a
          className="button secondary"
          href={api.attachmentFileUrl(a.id)}
          download
          dir="auto"
          data-user-content=""
          aria-label={t('attachments.downloadAria', { name: a.name })}
        >
          {t('common.download')}
        </a>
      </div>
      {previewing ? <FilePreview attachment={a} onClose={() => setPreviewing(false)} returnFocusTo={triggerRef.current} /> : null}
    </li>
  );
}
