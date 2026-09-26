import { useState } from 'react';
import { Link } from 'react-router';
import type { AttachmentRecord, EntryRecord, ToDoRecord } from '../../shared/types';
import { MeetingIcon, UpdateIcon } from '../icons';
import { useFormat } from '../i18n/format';
import { useT } from '../i18n/LanguageProvider';
import { phaseRefLabel, type PhaseNameFor } from '../todos';
import { AttachmentList } from './AttachmentList';

const NOTE_LINES = 3;

interface EntryItemProps {
  entry: EntryRecord;
  /** Maps a top-level phase's stored name to its display name (e.g. its Arabic name). */
  nameFor?: PhaseNameFor;
  /** The to-dos this entry's `followUpToDoIds` point to, in the same order. */
  followUps?: ToDoRecord[];
  onToggleFollowUp?: (todo: ToDoRecord) => void;
  /** The attachments this entry's `attachmentIds` point to; shown read-only with Preview and Download. */
  attachments?: AttachmentRecord[];
  /**
   * Edit and delete controls, and the follow-ups' done checkbox, are shown only when this is given. Left out for a
   * read-only list, e.g. the phase side panel (M7 Task 6) or the presentation view.
   */
  actions?: {
    onEdit: () => void;
    onDelete: () => void;
  };
  /** Briefly marks this entry, e.g. right after the Attachments tab's "From" column linked to it. */
  highlighted?: boolean;
  /**
   * For stakeholders (the presentation's phase side panel): no people's names (attendees), no follow-up to-dos, no
   * "Shown in presentation" badge, and the whole note with no Show more button.
   */
  presentation?: boolean;
}

/** One meeting or update in the History tab's list: its icon, title, date, phase, attendees, notes and follow-ups. */
export function EntryItem({
  entry, nameFor, followUps = [], onToggleFollowUp, attachments = [], actions, highlighted, presentation = false,
}: EntryItemProps) {
  const t = useT();
  const { formatDate } = useFormat();
  const [expanded, setExpanded] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const bodyLines = entry.body.split('\n');
  const isLong = !presentation && bodyLines.length > NOTE_LINES;
  const shownBody = expanded || !isLong ? entry.body : bodyLines.slice(0, NOTE_LINES).join('\n');

  return (
    <li id={`entry-${entry.id}`} className={`entry-item${highlighted ? ' entry-highlight' : ''}`}>
      <div className="entry-item-head">
        {entry.type === 'meeting' ? <MeetingIcon /> : <UpdateIcon />}
        <div className="entry-item-title-block">
          <span className="entry-item-title" dir="auto" data-user-content="">{entry.title}</span>
          {entry.highlight && !presentation ? <span className="badge">{t('history.shownBadge')}</span> : null}
          <div className="entry-item-meta">
            <span>{formatDate(entry.effectiveDate)}</span>
            {entry.phase ? <span> · {phaseRefLabel(entry.phase, nameFor)}</span> : null}
          </div>
          {!presentation && entry.type === 'meeting' && (entry.attendees.length > 0 || entry.guests.length > 0) ? (
            <div className="entry-item-meta">
              {t('history.attendeesLabel')}:{' '}
              {entry.attendees.map((a, i) => (
                <span key={a.id}>
                  {i > 0 ? ', ' : ''}
                  <Link to={`/manage/resources/${a.id}`} dir="auto" data-user-content="">{a.name}</Link>
                </span>
              ))}
              {entry.guests.map((g, i) => (
                <span key={`guest-${i}`}>
                  {entry.attendees.length > 0 || i > 0 ? ', ' : ''}
                  <span dir="auto" data-user-content="">{g}</span> <span>{t('history.guestMarker')}</span>
                </span>
              ))}
            </div>
          ) : null}
        </div>
        {actions ? (
          confirming ? (
            <div className="option-add-actions">
              <span>{t(entry.type === 'meeting' ? 'history.confirmDeleteMeeting' : 'history.confirmDeleteUpdate')}</span>
              <button type="button" className="button danger" onClick={() => { setConfirming(false); actions.onDelete(); }}>
                {t('common.delete')}
              </button>
              <button type="button" className="button secondary" onClick={() => setConfirming(false)}>{t('common.keep')}</button>
            </div>
          ) : (
            <div className="option-add-actions">
              <button
                type="button"
                className="button secondary"
                aria-label={t('history.editAria', { title: entry.title })}
                onClick={actions.onEdit}
              >
                {t('common.edit')}
              </button>
              <button
                type="button"
                className="button secondary"
                aria-label={t('history.deleteAria', { title: entry.title })}
                onClick={() => setConfirming(true)}
              >
                {t('common.delete')}
              </button>
            </div>
          )
        ) : null}
      </div>

      {entry.body ? (
        <>
          <p className="entry-item-body" dir="auto" data-user-content="">{shownBody}</p>
          {isLong ? (
            <button type="button" className="button-link" onClick={() => setExpanded((v) => !v)}>
              {expanded ? t('history.showLess') : t('history.showMore')}
            </button>
          ) : null}
        </>
      ) : null}

      {attachments.length > 0 ? (
        <AttachmentList
          attachments={attachments}
          nameFor={nameFor}
          columns={{ type: false, phase: false, documentDate: false, uploaded: false, from: false }}
          ariaLabel={t('tabs.attachments')}
        />
      ) : null}

      {!presentation && followUps.length > 0 ? (
        <ul className="entry-followups">
          {followUps.map((f) => (
            <li key={f.id}>
              <input
                type="checkbox"
                aria-label={t('todo.doneAria', { title: f.title })}
                checked={f.done}
                disabled={!actions}
                onChange={() => onToggleFollowUp?.(f)}
              />
              <span dir="auto" data-user-content="">{f.title}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  );
}
