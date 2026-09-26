// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import type { EntryRecord, ToDoRecord } from '../../shared/types';
import { LanguageProvider } from '../i18n/LanguageProvider';
import { EntryItem } from './EntryItem';

function entry(overrides: Partial<EntryRecord> = {}): EntryRecord {
  return {
    id: 1,
    projectId: 1,
    type: 'meeting',
    effectiveDate: '2026-10-07',
    createdAt: '2026-10-07T09:00:00.000Z',
    title: 'Kickoff',
    body: 'Discussed scope.',
    highlight: false,
    phase: null,
    attendees: [],
    guests: [],
    attachmentIds: [],
    followUpToDoIds: [1],
    ...overrides,
  };
}

function followUp(overrides: Partial<ToDoRecord> = {}): ToDoRecord {
  return {
    id: 1,
    projectId: 1,
    projectName: 'Test Project',
    title: 'Book the room',
    note: null,
    assignee: null,
    dueDate: null,
    done: false,
    doneDate: null,
    phase: null,
    formerPhase: null,
    sourceEntry: null,
    createdAt: '2026-10-07T09:00:00.000Z',
    ...overrides,
  };
}

function renderItem(element: React.ReactElement) {
  return render(
    <LanguageProvider lang="en">
      <MemoryRouter>{element}</MemoryRouter>
    </LanguageProvider>,
  );
}

describe('EntryItem', () => {
  it('without actions: no Edit/Delete buttons and a disabled follow-up checkbox', () => {
    renderItem(<EntryItem entry={entry()} followUps={[followUp()]} onToggleFollowUp={vi.fn()} />);

    expect(screen.queryByRole('button', { name: /edit/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument();
    expect(screen.getByRole('checkbox')).toBeDisabled();
  });

  it('with actions: Edit and Delete buttons are present, and the follow-up checkbox is enabled', () => {
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    renderItem(
      <EntryItem
        entry={entry()}
        followUps={[followUp()]}
        onToggleFollowUp={vi.fn()}
        actions={{ onEdit, onDelete }}
      />,
    );

    expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument();
    expect(screen.getByRole('checkbox')).not.toBeDisabled();
  });

  it('lists typed-in attendees after the people, as plain text (not a link)', () => {
    renderItem(
      <EntryItem
        entry={entry({ attendees: [{ id: 70, name: 'Sara Ahmed' }], guests: ['Visiting Consultant'] })}
      />,
    );
    expect(screen.getByRole('link', { name: 'Sara Ahmed' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Visiting Consultant' })).not.toBeInTheDocument();
    expect(screen.getByText('Visiting Consultant')).toBeInTheDocument();
  });

  it('presentation mode hides both attendees and guests', () => {
    renderItem(
      <EntryItem
        entry={entry({ attendees: [{ id: 70, name: 'Sara Ahmed' }], guests: ['Visiting Consultant'] })}
        presentation
      />,
    );
    expect(screen.queryByText('Sara Ahmed')).not.toBeInTheDocument();
    expect(screen.queryByText('Visiting Consultant')).not.toBeInTheDocument();
  });

  it('renders a typed-in attendee in Arabic', () => {
    render(
      <LanguageProvider lang="ar">
        <MemoryRouter>
          <EntryItem entry={entry({ guests: ['زائر'] })} />
        </MemoryRouter>
      </LanguageProvider>,
    );
    expect(screen.getByText('زائر')).toHaveAttribute('dir', 'auto');
  });
});
