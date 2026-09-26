// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_CALENDAR } from '../../shared/calendar';
import type { AttachmentRecord, EntryRecord, ToDoRecord } from '../../shared/types';
import { LanguageProvider } from '../i18n/LanguageProvider';
import { mockFetch, sampleLists, samplePeople, sampleProject } from '../testing/mockFetch';
import { PhasePanel } from './PhasePanel';

const DEV = { id: 12, name: 'Development', phaseName: 'Development', subPhaseName: null };
const INC = { id: 120, name: 'Development › Increment 1', phaseName: 'Development', subPhaseName: 'Increment 1' };

const project = sampleProject({
  assignments: [{ id: 300, phaseId: 12, resource: { id: 71, name: 'Fatima Noor' }, allocation: 60, role: 'responsible' }],
});

function meeting(overrides: Partial<EntryRecord> = {}): EntryRecord {
  return {
    id: 500, projectId: 1, type: 'meeting', effectiveDate: '2026-10-05', createdAt: '2026-10-05T09:00:00.000Z',
    title: 'Design review', body: 'Agreed the screens.', highlight: false, phase: DEV,
    attendees: [{ id: 70, name: 'Sara Ahmed' }], guests: [], attachmentIds: [], followUpToDoIds: [],
    ...overrides,
  };
}

const todo: ToDoRecord = {
  id: 600, projectId: 1, projectName: 'Portal', title: 'Chase the sign-off', note: null, assignee: null,
  dueDate: '2026-10-08', done: false, doneDate: null, phase: INC, formerPhase: null, sourceEntry: null,
  createdAt: '2026-09-20T09:00:00.000Z',
};

const otherTodo: ToDoRecord = { ...todo, id: 601, title: 'Not on this phase', phase: null };

const file: AttachmentRecord = {
  id: 700, projectId: 1, phase: DEV, entryId: null, type: { id: 101, name: 'Approval', nameAr: 'اعتماد' },
  name: 'Approval letter.pdf', mime: 'application/pdf', size: 245_000, documentDate: '2026-10-02',
  uploadedAt: '2026-10-03T09:00:00.000Z', previewable: true,
};

function routes(entries: EntryRecord[] = [meeting()], attachments: AttachmentRecord[] = [file]) {
  return {
    'GET /api/projects/1/entries?phaseId=12': () => ({ body: entries }),
    'GET /api/projects/1/attachments': () => ({ body: attachments }),
  };
}

function renderPanel(ui: ReactElement, lang: 'en' | 'ar' = 'en') {
  return render(
    <LanguageProvider lang={lang}>
      <MemoryRouter>{ui}</MemoryRouter>
    </LanguageProvider>,
  );
}

function managePanel(onClose = vi.fn(), nameFor?: (name: string) => string) {
  return (
    <PhasePanel
      nameFor={nameFor}
      project={project}
      phaseId={12}
      mode="manage"
      calendar={DEFAULT_CALENDAR}
      onClose={onClose}
      me={{ resourceId: null, name: null }}
      people={samplePeople()}
      todos={[todo, otherTodo]}
      attachmentTypes={sampleLists().attachmentType}
    />
  );
}

/** The panel's history items, top to bottom, as their titles. */
function itemTitles(panel: HTMLElement): string[] {
  return Array.from(panel.querySelectorAll('.phase-panel-items > li')).map(
    (li) => li.querySelector('[data-user-content]')?.textContent ?? '',
  );
}

describe('PhasePanel', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-07T09:00:00'));
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('is a non-modal dialog labelled by the phase name, with its dates and people', async () => {
    mockFetch(routes());
    renderPanel(managePanel());
    const panel = screen.getByRole('dialog', { name: 'Development' });
    expect(panel).toHaveAttribute('aria-modal', 'false');
    expect(panel).toHaveTextContent('Mon 28 Sep 2026 – Wed 30 Sep 2026 · 3 working days');
    expect(within(panel).getByText(/Fatima Noor/)).toBeInTheDocument();
    await within(panel).findByText('Design review');
  });

  it('heads a sub-phase "Phase › Sub-phase"', async () => {
    mockFetch({
      'GET /api/projects/1/entries?phaseId=120': () => ({ body: [] }),
      'GET /api/projects/1/attachments': () => ({ body: [] }),
    });
    renderPanel(
      <PhasePanel project={project} phaseId={120} mode="present" calendar={DEFAULT_CALENDAR} onClose={() => {}} />,
    );
    expect(screen.getByRole('dialog', { name: 'Development › Increment 1' })).toBeInTheDocument();
  });

  it('lists a meeting, a to-do and a file in one list, newest first', async () => {
    mockFetch(routes());
    renderPanel(managePanel());
    const panel = screen.getByRole('dialog');
    await within(panel).findByText('Design review');
    await within(panel).findByText('Approval letter.pdf');
    // To-do due Thu 8 Oct, meeting on Mon 5 Oct, file dated Fri 2 Oct. The to-do on no phase is left out.
    expect(itemTitles(panel)).toEqual(['Chase the sign-off', 'Design review', 'Approval letter.pdf']);
    expect(within(panel).queryByText('Not on this phase')).toBeNull();
    // Grouped by week by default.
    expect(within(panel).getByText('Mon 5 Oct – Fri 9 Oct')).toBeInTheDocument();
    expect(within(panel).getByText('Mon 28 Sep – Fri 2 Oct')).toBeInTheDocument();
  });

  it('groups them by type, and collapsing a group hides its items', async () => {
    mockFetch(routes());
    const user = userEvent.setup();
    renderPanel(managePanel());
    const panel = screen.getByRole('dialog');
    await within(panel).findByText('Design review');
    await within(panel).findByText('Approval letter.pdf');
    await user.click(within(panel).getByRole('radio', { name: 'By type' }));
    const groups = Array.from(panel.querySelectorAll('.phase-panel-group-name')).map((el) => el.textContent);
    expect(groups).toEqual(['Meetings', 'To-dos', 'Files']);

    await user.click(within(panel).getByText('Meetings'));
    expect(within(panel).queryByText('Design review')).toBeNull();
    expect(within(panel).getByText('Chase the sign-off')).toBeInTheDocument();
    await user.click(within(panel).getByText('Meetings'));
    expect(within(panel).getByText('Design review')).toBeInTheDocument();
  });

  it('opens the meeting form with the phase preset from Add meeting', async () => {
    mockFetch(routes());
    const user = userEvent.setup();
    renderPanel(managePanel());
    const panel = screen.getByRole('dialog');
    await user.click(within(panel).getByRole('button', { name: 'Add meeting' }));
    expect(within(panel).getByLabelText('Phase')).toHaveValue('12');
    expect(within(panel).getByLabelText('Date it happened')).toBeInTheDocument();
  });

  it('opens the to-do form with the phase preset from Add to-do', async () => {
    mockFetch(routes());
    const user = userEvent.setup();
    renderPanel(managePanel());
    const panel = screen.getByRole('dialog');
    await user.click(within(panel).getByRole('button', { name: 'Add to-do' }));
    expect(within(panel).getByLabelText('Phase')).toHaveValue('12');
  });

  it('closes on Escape and on its close button', async () => {
    mockFetch(routes());
    const onClose = vi.fn();
    const user = userEvent.setup();
    renderPanel(managePanel(onClose));
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('does not close on Escape while a form is open, so typed text is not lost', async () => {
    mockFetch(routes());
    const onClose = vi.fn();
    const user = userEvent.setup();
    renderPanel(managePanel(onClose));
    const panel = screen.getByRole('dialog');
    await user.click(within(panel).getByRole('button', { name: 'Add meeting' }));
    const title = within(panel).getByLabelText('Title');
    await user.type(title, 'Kickoff');
    await user.keyboard('{Escape}');
    expect(onClose).not.toHaveBeenCalled();
    expect(within(panel).getByLabelText('Title')).toHaveValue('Kickoff');

    // With no form open, Escape still closes the panel.
    await user.click(within(panel).getByRole('button', { name: 'Cancel' }));
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('in read-only mode shows only highlighted entries with their files, and no to-dos, names or editing buttons', async () => {
    const minutes: AttachmentRecord = { ...file, id: 701, entryId: 501, phase: null, name: 'Minutes.pdf' };
    mockFetch(routes(
      [meeting({ id: 501, title: 'Steering committee', highlight: true }), meeting({ id: 502, title: 'Internal sync' })],
      [file, minutes],
    ));
    renderPanel(
      <PhasePanel project={project} phaseId={12} mode="present" calendar={DEFAULT_CALENDAR} onClose={() => {}} />,
    );
    const panel = screen.getByRole('dialog');
    await within(panel).findByText('Steering committee');
    expect(within(panel).getByText('Minutes.pdf')).toBeInTheDocument();
    expect(within(panel).queryByText('Internal sync')).toBeNull();
    expect(within(panel).queryByText('Approval letter.pdf')).toBeNull();
    expect(panel.textContent).not.toContain('Fatima Noor');
    expect(panel.textContent).not.toContain('Sara Ahmed');
    const buttons = within(panel).getAllByRole('button').map((b) => b.getAttribute('aria-label') ?? b.textContent);
    expect(buttons).toEqual(['Close', 'Preview Minutes.pdf']);
  });

  it('in read-only mode says so when nothing is highlighted for the phase', async () => {
    mockFetch(routes([meeting()], [file]));
    renderPanel(
      <PhasePanel project={project} phaseId={12} mode="present" calendar={DEFAULT_CALENDAR} onClose={() => {}} />,
      'ar',
    );
    expect(await screen.findByText('لا يوجد ما يُعرض لهذه المرحلة بعد.')).toBeInTheDocument();
  });

  it('in Arabic, runs right to left and is anchored at the inline end (the left)', async () => {
    mockFetch(routes());
    renderPanel(managePanel(vi.fn(), (name) => (name === 'Development' ? 'التطوير' : name)), 'ar');
    const panel = screen.getByRole('dialog', { name: 'التطوير' });
    expect(panel).toHaveClass('phase-panel');
    expect(panel).toHaveAttribute('dir', 'rtl');
    await within(panel).findByText('Design review');
    expect(within(panel).getByRole('radio', { name: 'حسب الأسبوع' })).toBeChecked();

    // The stylesheet anchors .phase-panel with a logical property only, so RTL puts it on the left.
    const css = readFileSync(resolve(process.cwd(), 'client/styles.css'), 'utf8');
    const rule = css.match(/\.phase-panel\s*\{([^}]*)\}/)?.[1] ?? '';
    expect(rule).toMatch(/inset-inline-end:\s*0/);
    expect(rule).not.toMatch(/(^|[\s;])(left|right):/);
  });

  it('marks a custom top-level phase name as user content in the heading, but not a translated list name', async () => {
    mockFetch(routes());
    const { rerender } = renderPanel(
      <PhasePanel
        project={project}
        phaseId={12}
        mode="present"
        calendar={DEFAULT_CALENDAR}
        onClose={() => {}}
        nameFor={(n) => (n === 'Development' ? 'التطوير' : n)}
        isCustomName={() => false}
      />,
      'ar',
    );
    let heading = screen.getByRole('heading', { level: 2 });
    expect(heading.querySelector('[data-user-content]')).toBeNull();

    rerender(
      <LanguageProvider lang="ar">
        <MemoryRouter>
          <PhasePanel
            project={project}
            phaseId={12}
            mode="present"
            calendar={DEFAULT_CALENDAR}
            onClose={() => {}}
            nameFor={(n) => n}
            isCustomName={() => true}
          />
        </MemoryRouter>
      </LanguageProvider>,
    );
    heading = screen.getByRole('heading', { level: 2 });
    const userContent = heading.querySelector('[data-user-content]');
    expect(userContent).not.toBeNull();
    expect(userContent).toHaveAttribute('dir', 'auto');
    expect(userContent).toHaveTextContent('Development');
  });
});
