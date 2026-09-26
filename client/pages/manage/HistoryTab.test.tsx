// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { EntryRecord, Me } from '../../../shared/types';
import { mockFetch, sampleEntries, samplePeople, sampleProject, sampleToDos } from '../../testing/mockFetch';
import { LanguageProvider } from '../../i18n/LanguageProvider';
import { HistoryTab } from './HistoryTab';

const me: Me = { resourceId: 70, name: 'Sara Ahmed' };

function project() {
  return sampleProject({
    projectManager: { id: 70, name: 'Sara Ahmed' },
    phases: [
      { id: 11, name: 'Requirements', order: 0, durationDays: 2, start: '2026-09-24', end: '2026-09-25', subPhases: [] },
      {
        id: 12, name: 'Development', order: 1, durationDays: 3, start: '2026-09-28', end: '2026-09-30',
        subPhases: [{ id: 120, name: 'Increment 1', order: 0, durationDays: 3, start: '2026-09-28', end: '2026-09-30', withPrevious: false }],
      },
    ],
  });
}

function renderTab(entries: EntryRecord[] = [], todos = sampleToDos()) {
  return render(
    <MemoryRouter>
      <HistoryTab project={project()} me={me} people={samplePeople()} todos={todos} toggleDone={vi.fn()} />
    </MemoryRouter>,
  );
}

afterEach(() => {
  vi.useRealTimers();
});

describe('HistoryTab', () => {
  it('shows the list newest first, with attendees, phase and a follow-up to-do', async () => {
    mockFetch({ 'GET /api/projects/1/entries': () => ({ body: sampleEntries() }) });
    renderTab();

    const items = await screen.findAllByRole('listitem');
    const kickoff = items.find((el) => el.textContent?.includes('Kickoff'))!;
    expect(kickoff.textContent).toContain('Sara Ahmed');
    expect(kickoff.textContent).toContain('Fatima Noor');
    expect(kickoff.textContent).toContain('Development');
    expect(screen.getByRole('checkbox', { name: 'Done: Chase the missing contract' })).toBeInTheDocument();
    expect(screen.getByText('Weekly status')).toBeInTheDocument();
  });

  it('shows "No meetings or updates yet." when there are none', async () => {
    mockFetch({ 'GET /api/projects/1/entries': () => ({ body: [] }) });
    renderTab();
    expect(await screen.findByText('No meetings or updates yet.')).toBeInTheDocument();
  });

  it('adds a meeting with two attendees and one follow-up', async () => {
    let entries: EntryRecord[] = [];
    const fetchMock = mockFetch({
      'GET /api/projects/1/entries': () => ({ body: entries }),
      'POST /api/projects/1/entries': (init) => {
        const input = JSON.parse(init!.body as string);
        const created: EntryRecord = {
          id: 900, projectId: 1, type: 'meeting', effectiveDate: input.effectiveDate, createdAt: '2026-10-07T09:00:00.000Z',
          title: input.title, body: input.body, highlight: input.highlight, phase: null,
          attendees: [{ id: 70, name: 'Sara Ahmed' }, { id: 71, name: 'Fatima Noor' }],
          attachmentIds: [], followUpToDoIds: [950],
        };
        entries = [created];
        return { status: 201, body: created };
      },
    });
    const user = userEvent.setup();
    renderTab();

    await user.click(await screen.findByRole('button', { name: 'Add meeting' }));
    await user.type(screen.getByLabelText('Title'), 'Kickoff');
    await user.click(screen.getByRole('button', { name: 'Sara Ahmed' }));
    await user.click(screen.getByRole('button', { name: 'Fatima Noor' }));
    await user.click(screen.getByRole('button', { name: '+ Add follow-up' }));
    await user.type(screen.getAllByLabelText('Title')[1], 'Book the room');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    const post = await waitFor(() => {
      const call = fetchMock.mock.calls.find(([url, init]) => url === '/api/projects/1/entries' && init?.method === 'POST');
      expect(call).toBeTruthy();
      return call!;
    });
    const body = JSON.parse(post[1]!.body as string);
    expect(body).toMatchObject({
      type: 'meeting', title: 'Kickoff', attendeeIds: expect.arrayContaining([70, 71]),
      followUps: [{ title: 'Book the room', assigneeId: 70, dueDate: null }],
    });
    expect(await screen.findAllByText('Kickoff')).not.toHaveLength(0);
  });

  it('an update form has no attendees field', async () => {
    mockFetch({ 'GET /api/projects/1/entries': () => ({ body: [] }) });
    const user = userEvent.setup();
    renderTab();

    await user.click(await screen.findByRole('button', { name: 'Add update' }));
    expect(screen.queryByLabelText('Attendees')).not.toBeInTheDocument();
  });

  it('an empty title shows "Write a title"', async () => {
    mockFetch({ 'GET /api/projects/1/entries': () => ({ body: [] }) });
    const user = userEvent.setup();
    renderTab();

    await user.click(await screen.findByRole('button', { name: 'Add update' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Write a title')).toBeInTheDocument();
  });

  it('the phase filter shows only matching entries', async () => {
    mockFetch({
      'GET /api/projects/1/entries': () => ({ body: sampleEntries() }),
      'GET /api/projects/1/entries?phaseId=12': () => ({ body: [sampleEntries()[0]] }),
    });
    const user = userEvent.setup();
    renderTab();

    await screen.findByText('Kickoff');
    await screen.findByText('Weekly status');
    await user.selectOptions(screen.getByLabelText('Filter by phase'), 'Development');
    await waitFor(() => expect(screen.queryByText('Weekly status')).toBeNull());
    expect(screen.getByText('Kickoff')).toBeInTheDocument();
  });

  it('Edit changes the title and highlight, and sends a PUT', async () => {
    let entries = sampleEntries();
    const fetchMock = mockFetch({
      'GET /api/projects/1/entries': () => ({ body: entries }),
      'PUT /api/entries/300': (init) => {
        const input = JSON.parse(init!.body as string);
        entries = entries.map((e) => (e.id === 300 ? { ...e, title: input.title, highlight: input.highlight } : e));
        return { body: entries[0] };
      },
    });
    const user = userEvent.setup();
    renderTab();

    await screen.findByText('Kickoff');
    await user.click(screen.getByRole('button', { name: 'Edit Kickoff' }));
    await user.clear(screen.getByLabelText('Title'));
    await user.type(screen.getByLabelText('Title'), 'Kickoff (updated)');
    await user.click(screen.getByLabelText('Show in presentation'));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    const put = await waitFor(() => {
      const call = fetchMock.mock.calls.find(([url, init]) => url === '/api/entries/300' && init?.method === 'PUT');
      expect(call).toBeTruthy();
      return call!;
    });
    const body = JSON.parse(put[1]!.body as string);
    expect(body.title).toBe('Kickoff (updated)');
    expect(body.highlight).toBe(true);
    expect(await screen.findByText('Kickoff (updated)')).toBeInTheDocument();
  });

  it('Delete asks for confirmation, then sends DELETE', async () => {
    const fetchMock = mockFetch({
      'GET /api/projects/1/entries': () => ({ body: sampleEntries() }),
      'DELETE /api/entries/300': () => ({ status: 204, body: null }),
    });
    const user = userEvent.setup();
    renderTab();

    await screen.findByText('Kickoff');
    await user.click(screen.getByRole('button', { name: 'Delete Kickoff' }));
    expect(await screen.findByText('Delete this meeting? Its attachments and to-dos stay on the project.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => {
      expect(fetchMock.mock.calls.some(([url, init]) => url === '/api/entries/300' && init?.method === 'DELETE')).toBe(true);
    });
  });

  it('renders in Arabic', async () => {
    mockFetch({ 'GET /api/projects/1/entries': () => ({ body: sampleEntries() }) });
    render(
      <LanguageProvider lang="ar">
        <MemoryRouter>
          <HistoryTab project={project()} me={me} people={samplePeople()} todos={sampleToDos()} toggleDone={vi.fn()} />
        </MemoryRouter>
      </LanguageProvider>,
    );
    expect(await screen.findByRole('button', { name: 'إضافة اجتماع' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'إضافة مستجدات' })).toBeInTheDocument();
    expect(screen.getByText('كل المراحل')).toBeInTheDocument();
  });
});
