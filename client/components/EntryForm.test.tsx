// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { EntryData } from '../../shared/schemas';
import type { AttachmentRecord, Me } from '../../shared/types';
import { sampleLists, samplePeople, sampleProject } from '../testing/mockFetch';
import { installMockXhr } from '../testing/mockXhr';
import { LanguageProvider } from '../i18n/LanguageProvider';
import { EntryForm } from './EntryForm';

const me: Me = { resourceId: 70, name: 'Sara Ahmed' };
const attachmentTypes = sampleLists().attachmentType;

function attachmentRecord(overrides: Partial<AttachmentRecord> = {}): AttachmentRecord {
  return {
    id: 500, projectId: 1, phase: null, entryId: null, type: null, name: 'a.pdf', mime: 'application/pdf',
    size: 1000, documentDate: null, uploadedAt: '2026-09-24T10:00:00.000Z', previewable: true, ...overrides,
  };
}

function project() {
  return sampleProject({
    projectManager: { id: 70, name: 'Sara Ahmed' },
    assignments: [{ id: 300, phaseId: 120, resource: { id: 72, name: 'Rami Saleh' }, allocation: 50, role: 'responsible' }],
  });
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('EntryForm', () => {
  it('a new meeting form saves attendees and follow-ups', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-07T09:00:00'));
    const onSave = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(
      <EntryForm project={project()} me={me} people={samplePeople()} attachmentTypes={attachmentTypes} type="meeting" onSave={onSave} onCancel={vi.fn()} />,
    );

    await user.type(screen.getByLabelText('Title'), 'Kickoff');
    await user.click(screen.getByRole('button', { name: 'Sara Ahmed' }));
    await user.click(screen.getByRole('button', { name: 'Fatima Noor' }));
    expect(screen.getByRole('button', { name: 'Remove Sara Ahmed' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '+ Add follow-up' }));
    const followUpTitles = screen.getAllByLabelText('Title');
    await user.type(followUpTitles[1], 'Book the room');

    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(onSave).toHaveBeenCalledTimes(1);
    const input: EntryData = onSave.mock.calls[0][0];
    expect(input.type).toBe('meeting');
    expect(input.title).toBe('Kickoff');
    expect(input.effectiveDate).toBe('2026-10-07');
    expect(input.attendeeIds.sort()).toEqual([70, 71]);
    expect(input.followUps).toEqual([{ title: 'Book the room', assigneeId: 70, dueDate: null }]);
  });

  it('adds a typed-in attendee via the "Add attendee" option, and removes it with its chip button', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(
      <EntryForm project={project()} me={me} people={samplePeople()} attachmentTypes={attachmentTypes} type="meeting" onSave={onSave} onCancel={vi.fn()} />,
    );

    await user.type(screen.getByLabelText('Title'), 'Kickoff');
    await user.type(screen.getByPlaceholderText('Search people'), 'Visiting Consultant');
    await user.click(screen.getByRole('button', { name: '+ Add attendee "Visiting Consultant"' }));
    expect(screen.getByText('Visiting Consultant')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove Visiting Consultant' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSave).toHaveBeenCalledTimes(1);
    const input: EntryData = onSave.mock.calls[0][0];
    expect(input.guestNames).toEqual(['Visiting Consultant']);

    await user.click(screen.getByRole('button', { name: 'Remove Visiting Consultant' }));
    expect(screen.queryByText('Visiting Consultant')).not.toBeInTheDocument();
  });

  it('Enter in the search box adds a guest when there is no matching person', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(
      <EntryForm project={project()} me={me} people={samplePeople()} attachmentTypes={attachmentTypes} type="meeting" onSave={onSave} onCancel={vi.fn()} />,
    );

    await user.type(screen.getByLabelText('Title'), 'Kickoff');
    await user.type(screen.getByPlaceholderText('Search people'), 'A Visitor{enter}');
    expect(screen.getByText('A Visitor')).toBeInTheDocument();
    // Enter added the guest instead of submitting the form.
    expect(onSave).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Save' }));
    const input: EntryData = onSave.mock.calls[0][0];
    expect(input.guestNames).toEqual(['A Visitor']);
  });

  it('an update form has no attendees field and no follow-ups', () => {
    render(
      <EntryForm project={project()} me={me} people={samplePeople()} attachmentTypes={attachmentTypes} type="update" onSave={vi.fn()} onCancel={vi.fn()} />,
    );
    expect(screen.queryByLabelText('Attendees')).not.toBeInTheDocument();
    expect(screen.queryByText('+ Add follow-up')).not.toBeInTheDocument();
    expect(screen.getByText('Notes')).toBeInTheDocument();
  });

  it('shows "Write a title" and does not save when the title is empty', async () => {
    const onSave = vi.fn();
    const user = userEvent.setup();
    render(
      <EntryForm project={project()} me={me} people={samplePeople()} attachmentTypes={attachmentTypes} type="update" onSave={onSave} onCancel={vi.fn()} />,
    );
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Write a title')).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('editing an existing meeting pre-fills its fields and keeps the follow-up section hidden', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(
      <EntryForm
        project={project()}
        me={me}
        people={samplePeople()}
        attachmentTypes={attachmentTypes}
        type="meeting"
        initial={{
          id: 300, projectId: 1, type: 'meeting', effectiveDate: '2026-09-24', createdAt: '2026-09-20T09:00:00.000Z',
          title: 'Kickoff', body: '', highlight: false, phase: null,
          attendees: [{ id: 70, name: 'Sara Ahmed' }], guests: [], attachmentIds: [], followUpToDoIds: [],
        }}
        onSave={onSave}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByLabelText('Title')).toHaveValue('Kickoff');
    expect(screen.queryByText('+ Add follow-up')).not.toBeInTheDocument();

    await user.clear(screen.getByLabelText('Title'));
    await user.type(screen.getByLabelText('Title'), 'Kickoff (rescheduled)');
    await user.click(screen.getByLabelText('Show in presentation'));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    const input: EntryData = onSave.mock.calls[0][0];
    expect(input.title).toBe('Kickoff (rescheduled)');
    expect(input.highlight).toBe(true);
    expect(input.attendeeIds).toEqual([70]);
  });

  it('a failed upload blocks the save; after a retry succeeds, the entry POST includes the attachmentIds', async () => {
    const { requests } = installMockXhr();
    const onSave = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(
      <EntryForm project={project()} me={me} people={samplePeople()} attachmentTypes={attachmentTypes} type="update" onSave={onSave} onCancel={vi.fn()} />,
    );

    await user.type(screen.getByLabelText('Title'), 'Status');
    const file = new File(['x'], 'notes.pdf', { type: 'application/pdf' });
    await user.upload(screen.getByLabelText('Attach files'), file);
    requests[0].respond(500, { error: 'Something went wrong' });
    await screen.findByRole('alert');

    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSave).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Retry' }));
    requests[1].respond(201, attachmentRecord({ id: 777, name: 'notes.pdf' }));
    await screen.findByText('notes.pdf');

    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSave).toHaveBeenCalledTimes(1);
    const input: EntryData = onSave.mock.calls[0][0];
    expect(input.attachmentIds).toEqual([777]);
  });

  it('Cancel does not save', async () => {
    const onCancel = vi.fn();
    const user = userEvent.setup();
    render(
      <EntryForm project={project()} me={me} people={samplePeople()} attachmentTypes={attachmentTypes} type="update" onSave={vi.fn()} onCancel={onCancel} />,
    );
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('renders a meeting form in Arabic', async () => {
    render(
      <LanguageProvider lang="ar">
        <EntryForm project={project()} me={me} people={samplePeople()} attachmentTypes={attachmentTypes} type="meeting" onSave={vi.fn()} onCancel={vi.fn()} />
      </LanguageProvider>,
    );
    expect(screen.getByText('الحضور')).toBeInTheDocument();
    expect(screen.getByText('محضر الاجتماع')).toBeInTheDocument();
    expect(screen.getByText('إظهار في العرض')).toBeInTheDocument();
    expect(screen.getByText('مهام للمتابعة')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '+ إضافة مهمة للمتابعة' })).toBeInTheDocument();
  });
});
