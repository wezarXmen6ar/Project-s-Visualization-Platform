// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ToDoRecord } from '../../../shared/types';
import { mockFetch, sampleToDos, type MockHandler } from '../../testing/mockFetch';
import { ToDosPage } from './ToDosPage';

function LocationSpy() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}{location.search}</div>;
}

function renderAt(url = '/manage/todos') {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <LocationSpy />
      <Routes>
        <Route path="/manage/todos" element={<ToDosPage />} />
        <Route path="/manage" element={<div>Projects page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

function todos(): ToDoRecord[] {
  return [
    ...sampleToDos(),
    {
      id: 300, projectId: 2, projectName: 'Case Management', title: 'Review the second project',
      note: null, assignee: null, dueDate: null, done: false, doneDate: null, phase: null, formerPhase: null,
      createdAt: '2026-09-20T09:00:00.000Z',
    },
  ];
}

function routes(list: ToDoRecord[] = todos(), me: { resourceId: number | null; name: string | null } = { resourceId: 70, name: 'Sara Ahmed' }): Record<string, MockHandler> {
  return {
    'GET /api/todos?done=include': () => ({ body: list }),
    'GET /api/settings/me': () => ({ body: me }),
  };
}

describe('ToDosPage', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  function setToday() {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-07T09:00:00'));
  }

  it('shows every open to-do by default, overdue first, with project links, and hides the done one', async () => {
    setToday();
    mockFetch(routes());
    renderAt();

    const items = await screen.findAllByRole('listitem');
    // Overdue to-do (id 200) first.
    expect(items[0]).toHaveTextContent('Chase the missing contract');
    expect(within(items[0]).getByRole('link', { name: 'Portal' })).toHaveAttribute('href', '/manage/projects/1');
    expect(screen.queryByText('Confirm the sandbox is ready')).toBeNull();
  });

  it('chooses Mine and puts assignee=me in the URL', async () => {
    setToday();
    mockFetch(routes());
    const user = userEvent.setup();
    renderAt();
    await screen.findAllByRole('listitem');

    await user.selectOptions(screen.getByLabelText('Assigned to'), 'Mine');
    expect(screen.queryByText('Chase the missing contract')).toBeNull();
    expect(screen.getByTestId('location')).toHaveTextContent('/manage/todos?assignee=me');
  });

  it('starts with Mine selected when the URL has assignee=me', async () => {
    setToday();
    mockFetch(routes());
    renderAt('/manage/todos?assignee=me');
    expect(await screen.findByLabelText('Assigned to')).toHaveValue('me');
  });

  it('filters to a chosen project', async () => {
    setToday();
    mockFetch(routes());
    const user = userEvent.setup();
    renderAt();
    await screen.findAllByRole('listitem');

    await user.selectOptions(screen.getByLabelText('Project'), 'Case Management');
    expect(screen.getByText('Review the second project')).toBeInTheDocument();
    expect(screen.queryByText('Chase the missing contract')).toBeNull();
  });

  it('shows a Done heading and the done to-do when Show done is ticked', async () => {
    setToday();
    mockFetch(routes());
    const user = userEvent.setup();
    renderAt();
    await screen.findAllByRole('listitem');

    await user.click(screen.getByLabelText('Show done'));
    expect(screen.getByRole('heading', { name: 'Done' })).toBeInTheDocument();
    expect(screen.getByText('Confirm the sandbox is ready')).toBeInTheDocument();
  });

  it('shows only unassigned to-dos', async () => {
    setToday();
    mockFetch(routes());
    const user = userEvent.setup();
    renderAt();
    await screen.findAllByRole('listitem');

    await user.selectOptions(screen.getByLabelText('Assigned to'), 'Unassigned');
    expect(screen.queryByText('Get sign-off from the business')).toBeNull();
    expect(screen.getByText('Chase the missing contract')).toBeInTheDocument();
  });

  it('shows "No to-dos match these filters." when a filter matches nothing', async () => {
    setToday();
    mockFetch(routes());
    const user = userEvent.setup();
    renderAt();
    await screen.findAllByRole('listitem');

    await user.selectOptions(screen.getByLabelText('Assigned to'), 'Mariam Al Suwaidi');
    await user.selectOptions(screen.getByLabelText('Project'), 'Case Management');
    expect(await screen.findByText('No to-dos match these filters.')).toBeInTheDocument();
  });

  it('sends a PUT with done: true when ticking a to-do', async () => {
    setToday();
    const fetchMock = mockFetch({
      ...routes(),
      'PUT /api/todos/200': (init) => ({ body: { ...sampleToDos()[0], ...JSON.parse(init!.body as string) } }),
    });
    const user = userEvent.setup();
    renderAt();
    await screen.findAllByRole('listitem');

    await user.click(screen.getByLabelText('Done: Chase the missing contract'));
    const put = fetchMock.mock.calls.find(([url, init]) => url === '/api/todos/200' && init?.method === 'PUT');
    expect(put).toBeDefined();
    expect(JSON.parse(put![1]!.body as string)).toMatchObject({ done: true });
  });

  it('shows a former phase note and the From removed phases filter only when one exists', async () => {
    setToday();
    const withFormer: ToDoRecord = {
      id: 400, projectId: 1, projectName: 'Portal', title: 'Tidy up after the removed phase', note: null,
      assignee: null, dueDate: null, done: false, doneDate: null, phase: null,
      formerPhase: { name: 'Development › Increment 2', removedOn: '2026-09-25' }, createdAt: '2026-09-20T09:00:00.000Z',
    };
    mockFetch(routes([...todos(), withFormer]));
    const user = userEvent.setup();
    renderAt();
    await screen.findAllByRole('listitem');

    expect(screen.getByText('Was on Development › Increment 2 (removed Fri 25 Sep)')).toBeInTheDocument();
    const removedFilter = screen.getByLabelText('From removed phases');
    expect(removedFilter).toBeInTheDocument();

    await user.click(removedFilter);
    expect(screen.getByText('Tidy up after the removed phase')).toBeInTheDocument();
    expect(screen.queryByText('Chase the missing contract')).toBeNull();
    expect(screen.getByTestId('location')).toHaveTextContent('removed=1');
  });

  it('hides the From removed phases filter when no to-do has a former phase', async () => {
    setToday();
    mockFetch(routes());
    renderAt();
    await screen.findAllByRole('listitem');
    expect(screen.queryByLabelText('From removed phases')).toBeNull();
  });
});
