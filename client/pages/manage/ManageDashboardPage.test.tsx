// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Me, ToDoRecord } from '../../../shared/types';
import { mockFetch, overbookedWorkload, sampleProject, sampleWorkload, type MockHandler } from '../../testing/mockFetch';
import { ManageDashboardPage } from './ManageDashboardPage';

const noMe: Me = { resourceId: null, name: null };
const sara: Me = { resourceId: 70, name: 'Sara Ahmed' };

function baseRoutes(overrides: Partial<Record<string, MockHandler>> = {}): Record<string, MockHandler> {
  return {
    'GET /api/projects': () => ({ body: [sampleProject()] }),
    'GET /api/workload': () => ({ body: sampleWorkload() }),
    'GET /api/settings/me': () => ({ body: noMe }),
    ...overrides,
  };
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/manage']}>
      <Routes>
        <Route path="/manage" element={<ManageDashboardPage />} />
        <Route path="/manage/projects/:id" element={<div>Project opened</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

afterEach(() => {
  vi.useRealTimers();
});

describe('ManageDashboardPage', () => {
  it('lists projects with links and dates', async () => {
    mockFetch(baseRoutes());
    renderPage();
    expect(await screen.findByRole('link', { name: 'Portal' })).toHaveAttribute('href', '/manage/projects/1');
    expect(screen.getByText('PRJ-1')).toBeInTheDocument();
    expect(screen.getByText('2026-09-30')).toBeInTheDocument();
    const header = screen.getByRole('link', { name: 'New project' }).closest('.header-actions') as HTMLElement;
    expect(within(header).getByRole('link', { name: 'Settings' })).toHaveAttribute('href', '/manage/settings');
    expect(within(header).getByRole('link', { name: 'Resources' })).toHaveAttribute('href', '/manage/resources');
    expect(within(header).getByRole('link', { name: 'To-dos' })).toHaveAttribute('href', '/manage/todos');
  });

  it('opens a project from the chart', async () => {
    mockFetch(baseRoutes());
    renderPage();
    await userEvent.click(await screen.findByTestId('gantt-row-1'));
    expect(await screen.findByText('Project opened')).toBeInTheDocument();
  });

  it('shows an empty state', async () => {
    mockFetch(baseRoutes({ 'GET /api/projects': () => ({ body: [] }) }));
    renderPage();
    expect(await screen.findByText(/No projects yet/)).toBeInTheDocument();
  });

  it('warns when someone is overbooked in the next four weeks', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-01T09:00:00'));
    mockFetch(baseRoutes({ 'GET /api/workload': () => ({ body: overbookedWorkload() }) }));
    renderPage();
    expect(await screen.findByRole('status')).toHaveTextContent('Fatima Noor is overbooked in the next 4 weeks.');
    expect(screen.getByRole('link', { name: 'See the workload' })).toHaveAttribute('href', '/manage/resources');
  });

  it('stays quiet when the only overbooking has been accepted', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-01T09:00:00'));
    const accepted = overbookedWorkload();
    accepted.decisions.push({ id: 1, resourceId: 71, weekStart: '2026-10-05', decision: 'accept', note: null, date: '2026-10-01' });
    mockFetch(baseRoutes({ 'GET /api/workload': () => ({ body: accepted }) }));
    renderPage();
    expect(await screen.findByRole('link', { name: 'Portal' })).toBeInTheDocument();
    expect(screen.queryByRole('status')).toBeNull();
  });

  describe('My next steps', () => {
    function myToDo(overrides: Partial<ToDoRecord> & Pick<ToDoRecord, 'id' | 'title'>): ToDoRecord {
      return {
        projectId: 1, projectName: 'Portal', note: null, assignee: { id: 70, name: 'Sara Ahmed' }, dueDate: null,
        done: false, doneDate: null, phase: null, formerPhase: null, sourceEntry: null, createdAt: '2026-09-20T09:00:00.000Z', ...overrides,
      };
    }

    function sevenToDos(): ToDoRecord[] {
      return [
        myToDo({ id: 200, title: 'Chase the missing contract', dueDate: '2026-10-01' }),
        myToDo({ id: 201, title: 'Book the UAT room', dueDate: '2026-10-20' }),
        myToDo({ id: 202, title: 'Draft the go-live checklist', dueDate: '2026-10-21' }),
        myToDo({ id: 203, title: 'Update the risk log', dueDate: '2026-10-22' }),
        myToDo({ id: 204, title: 'Confirm the venue', dueDate: '2026-10-23' }),
        myToDo({ id: 205, title: 'Chase legal sign-off', dueDate: '2026-10-24' }),
        myToDo({
          id: 206, title: 'From the other project', projectId: 2, projectName: 'Case Management', dueDate: '2026-10-25',
        }),
      ];
    }

    it('lists my open to-dos across projects, at most 5, overdue ones marked', async () => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date('2026-10-07T09:00:00'));
      mockFetch(baseRoutes({
        'GET /api/settings/me': () => ({ body: sara }),
        'GET /api/todos?assigneeId=70': () => ({ body: sevenToDos() }),
      }));
      renderPage();

      const overdueTitle = await screen.findByText('Chase the missing contract');
      const card = overdueTitle.closest('section') as HTMLElement;
      expect(within(card).getAllByRole('listitem')).toHaveLength(5);
      const overdueItem = overdueTitle.closest('li') as HTMLElement;
      expect(within(overdueItem).getByText(/Overdue/)).toHaveClass('overdue');
      expect(within(card).getByRole('link', { name: 'All to-dos' })).toHaveAttribute('href', '/manage/todos?assignee=me');
    });

    it('shows the Settings prompt when "I am" is not set', async () => {
      mockFetch(baseRoutes());
      renderPage();
      const heading = await screen.findByRole('heading', { name: 'My next steps' });
      const card = heading.closest('section') as HTMLElement;
      expect(within(card).getByText(/Set who you are in/)).toBeInTheDocument();
      expect(within(card).getByRole('link', { name: 'Settings' })).toHaveAttribute('href', '/manage/settings');
    });
  });
});
