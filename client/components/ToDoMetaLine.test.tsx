import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, it, expect } from 'vitest';
import type { ToDoRecord } from '../../shared/types';
import { LanguageProvider } from '../i18n/LanguageProvider';
import { ToDoMetaLine } from './ToDoMetaLine';

// @vitest-environment jsdom

function renderWithRouter(element: React.ReactElement) {
  return render(<MemoryRouter>{element}</MemoryRouter>);
}

describe('ToDoMetaLine', () => {
  it('renders assignee name as a link to their resource page', () => {
    const todo: ToDoRecord = {
      id: 1,
      projectId: 1,
      projectName: 'Test Project',
      title: 'Test to-do',
      note: null,
      assignee: { id: 11, name: 'Rami Saleh' },
      dueDate: null,
      done: false,
      doneDate: null,
      phase: null,
      formerPhase: null,
      sourceEntry: null, createdAt: '2026-09-20T09:00:00.000Z',
    };

    renderWithRouter(<ToDoMetaLine todo={todo} today="2026-09-26" showAssignee={true} />);

    const link = screen.getByRole('link', { name: 'Rami Saleh' });
    expect(link).toHaveAttribute('href', '/manage/resources/11');
  });

  it('renders Unassigned as plain text when assignee is null', () => {
    const todo: ToDoRecord = {
      id: 2,
      projectId: 1,
      projectName: 'Test Project',
      title: 'Test to-do',
      note: null,
      assignee: null,
      dueDate: null,
      done: false,
      doneDate: null,
      phase: null,
      formerPhase: null,
      sourceEntry: null, createdAt: '2026-09-20T09:00:00.000Z',
    };

    renderWithRouter(<ToDoMetaLine todo={todo} today="2026-09-26" showAssignee={true} />);

    // Verify "Unassigned" text exists
    expect(screen.getByText('Unassigned')).toBeInTheDocument();
    // Verify it's not a link
    const link = screen.queryByRole('link', { name: 'Unassigned' });
    expect(link).not.toBeInTheDocument();
  });

  it('does not show assignee when showAssignee is false', () => {
    const todo: ToDoRecord = {
      id: 3,
      projectId: 1,
      projectName: 'Test Project',
      title: 'Test to-do',
      note: null,
      assignee: { id: 11, name: 'Rami Saleh' },
      dueDate: null,
      done: false,
      doneDate: null,
      phase: null,
      formerPhase: null,
      sourceEntry: null, createdAt: '2026-09-20T09:00:00.000Z',
    };

    renderWithRouter(<ToDoMetaLine todo={todo} today="2026-09-26" showAssignee={false} />);

    const link = screen.queryByRole('link', { name: 'Rami Saleh' });
    expect(link).not.toBeInTheDocument();
  });
  it('writes the line in Arabic, translating the phase part only, and marks the assignee as user content', () => {
    const todo: ToDoRecord = {
      id: 4, projectId: 1, projectName: 'Test Project', title: 'Test to-do', note: null,
      assignee: { id: 11, name: 'Rami Saleh' }, dueDate: '2026-09-25', done: false, doneDate: null,
      phase: { id: 120, name: 'Development › Increment 1', phaseName: 'Development', subPhaseName: 'Increment 1' },
      formerPhase: null, sourceEntry: null, createdAt: '2026-09-20T09:00:00.000Z',
    };
    render(
      <LanguageProvider lang="ar">
        <MemoryRouter>
          <ToDoMetaLine todo={todo} today="2026-09-26" nameFor={(n) => (n === 'Development' ? 'التطوير' : n)} />
        </MemoryRouter>
      </LanguageProvider>,
    );
    expect(screen.getByText('متأخرة · الجمعة 25 سبتمبر')).toHaveClass('overdue');
    expect(screen.getByText(/التطوير › Increment 1/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Rami Saleh' })).toHaveAttribute('dir', 'auto');
  });

  it('shows "From the meeting on …" when the to-do came from a meeting', () => {
    const todo: ToDoRecord = {
      id: 6, projectId: 1, projectName: 'Test Project', title: 'Book the room', note: null, assignee: null,
      dueDate: null, done: false, doneDate: null, phase: null, formerPhase: null,
      sourceEntry: { id: 300, title: 'Requirements workshop', effectiveDate: '2026-10-12' },
      createdAt: '2026-09-20T09:00:00.000Z',
    };
    renderWithRouter(<ToDoMetaLine todo={todo} today="2026-09-26" />);
    const lines = screen.getAllByText(/./, { selector: '.todo-meta' });
    const line = lines.find((el) => el.textContent?.includes('Requirements workshop'))!;
    expect(line.textContent).toBe('From the meeting on Mon 12 Oct: Requirements workshop');
    expect(within(line).getByText('Requirements workshop')).toHaveAttribute('dir', 'auto');
    expect(within(line).getByText('Requirements workshop')).toHaveAttribute('data-user-content');
  });

  it('writes "From the meeting on …" in Arabic', () => {
    const todo: ToDoRecord = {
      id: 7, projectId: 1, projectName: 'Test Project', title: 'Book the room', note: null, assignee: null,
      dueDate: null, done: false, doneDate: null, phase: null, formerPhase: null,
      sourceEntry: { id: 300, title: 'ورشة جمع المتطلبات', effectiveDate: '2026-10-12' },
      createdAt: '2026-09-20T09:00:00.000Z',
    };
    render(
      <LanguageProvider lang="ar">
        <MemoryRouter><ToDoMetaLine todo={todo} today="2026-09-26" /></MemoryRouter>
      </LanguageProvider>,
    );
    expect(screen.getByText('ورشة جمع المتطلبات')).toBeInTheDocument();
    expect(screen.getByText(/من اجتماع الاثنين 12 أكتوبر/)).toBeInTheDocument();
  });

  it('writes Unassigned in Arabic', () => {
    const todo: ToDoRecord = {
      id: 5, projectId: 1, projectName: 'Test Project', title: 'Test to-do', note: null, assignee: null, dueDate: null,
      done: false, doneDate: null, phase: null, formerPhase: null, sourceEntry: null, createdAt: '2026-09-20T09:00:00.000Z',
    };
    render(<LanguageProvider lang="ar"><MemoryRouter><ToDoMetaLine todo={todo} today="2026-09-26" /></MemoryRouter></LanguageProvider>);
    expect(screen.getByText('بدون تكليف')).toBeInTheDocument();
  });
});
