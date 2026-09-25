import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, it, expect } from 'vitest';
import type { ToDoRecord } from '../../shared/types';
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
      createdAt: '2026-09-20T09:00:00.000Z',
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
      createdAt: '2026-09-20T09:00:00.000Z',
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
      createdAt: '2026-09-20T09:00:00.000Z',
    };

    renderWithRouter(<ToDoMetaLine todo={todo} today="2026-09-26" showAssignee={false} />);

    const link = screen.queryByRole('link', { name: 'Rami Saleh' });
    expect(link).not.toBeInTheDocument();
  });
});
