// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ExpiringItem, Me, ToDoRecord } from '../../../shared/types';
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

  describe('the expiring documents and accounts notice', () => {
    it('shows a single expiring document and links to the person page', async () => {
      const items: ExpiringItem[] = [
        { kind: 'document', id: 1, person: { id: 71, name: 'Fatima Noor' }, type: { id: 300, name: 'Passport', nameAr: 'جواز السفر' }, name: 'passport.pdf', expiryDate: '2026-10-19', state: 'soon' },
      ];
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date('2026-10-07T09:00:00'));
      mockFetch(baseRoutes({ 'GET /api/people/expiring?withinDays=30': () => ({ body: items }) }));
      renderPage();
      const notice = await screen.findByText("Fatima Noor's passport expires in 12 days");
      expect(notice.closest('.notice')).toHaveAttribute('role', 'status');
      expect(screen.getByRole('link', { name: 'See documents' })).toHaveAttribute('href', '/manage/resources/71');
    });

    it('shows a single expiring account with the renewal call to action', async () => {
      const items: ExpiringItem[] = [
        { kind: 'account', id: 2, person: { id: 71, name: 'Fatima Noor' }, type: { id: 310, name: 'Network account', nameAr: 'أحقية الشبكة' }, name: null, expiryDate: '2026-10-27', state: 'soon' },
      ];
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date('2026-10-07T09:00:00'));
      mockFetch(baseRoutes({ 'GET /api/people/expiring?withinDays=30': () => ({ body: items }) }));
      renderPage();
      await screen.findByText("Fatima Noor's network account expires in 20 days — apply for renewal");
    });

    it('shows the plural form and expands into a list of every person and document/account', async () => {
      const items: ExpiringItem[] = [
        { kind: 'document', id: 1, person: { id: 71, name: 'Fatima Noor' }, type: { id: 300, name: 'Passport', nameAr: 'جواز السفر' }, name: 'passport.pdf', expiryDate: '2026-10-19', state: 'soon' },
        { kind: 'document', id: 3, person: { id: 72, name: 'Rami Saleh' }, type: null, name: 'nda.pdf', expiryDate: '2026-09-20', state: 'expired' },
        { kind: 'account', id: 2, person: { id: 71, name: 'Fatima Noor' }, type: { id: 310, name: 'Network account', nameAr: 'أحقية الشبكة' }, name: null, expiryDate: '2026-10-27', state: 'soon' },
        { kind: 'account', id: 4, person: { id: 70, name: 'Sara Ahmed' }, type: { id: 311, name: 'Email', nameAr: 'البريد الإلكتروني' }, name: null, expiryDate: '2026-10-15', state: 'soon' },
      ];
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date('2026-10-07T09:00:00'));
      mockFetch(baseRoutes({ 'GET /api/people/expiring?withinDays=30': () => ({ body: items }) }));
      renderPage();
      expect(await screen.findByText('4 documents and accounts need attention')).toBeInTheDocument();
      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: 'See documents' }));
      expect(await screen.findAllByRole('link', { name: 'Fatima Noor' })).toHaveLength(2);
      expect(screen.getByRole('link', { name: 'Rami Saleh' })).toBeInTheDocument();
    });

    it('shows no notice when nothing is expiring', async () => {
      mockFetch(baseRoutes({ 'GET /api/people/expiring?withinDays=30': () => ({ body: [] }) }));
      renderPage();
      await screen.findByRole('link', { name: 'Portal' });
      expect(screen.queryByText(/documents? and accounts/)).toBeNull();
    });
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
