// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import type { BackupStatus, ListValue, Me, StarterToDo } from '../../../shared/types';
import { mockFetch, sampleLists, samplePeople, type MockHandler } from '../../testing/mockFetch';
import { SettingsPage } from './SettingsPage';

/** A small in-memory stand-in for the lists API, so reloads show the change. */
function fakeServer(backups: BackupStatus = { latest: null, count: 0 }): Record<string, MockHandler> {
  const lists = sampleLists();
  let me: Me = { resourceId: null, name: null };
  let starters: StarterToDo[] = [
    { id: 1, phaseListId: 55, title: 'Write test cases', order: 0 },
    { id: 2, phaseListId: 55, title: 'Confirm test data', order: 1 },
  ];
  return {
    'GET /api/backups': () => ({ body: backups }),
    'GET /api/starter-todos': () => ({ body: starters }),
    'POST /api/starter-todos': (init) => {
      const body = JSON.parse(init!.body as string) as { phaseListId: number; title: string };
      const value: StarterToDo = { id: 3, phaseListId: body.phaseListId, title: body.title, order: starters.length };
      starters = [...starters, value];
      return { status: 201, body: value };
    },
    'PUT /api/starter-todos/1': (init) => {
      const body = JSON.parse(init!.body as string) as { title: string };
      starters = starters.map((s) => (s.id === 1 ? { ...s, title: body.title } : s));
      return { body: starters.find((s) => s.id === 1) };
    },
    'DELETE /api/starter-todos/1': () => {
      starters = starters.filter((s) => s.id !== 1);
      return { status: 204, body: null };
    },
    'GET /api/lists': () => ({ body: structuredClone(lists) }),
    'POST /api/lists/goal': (init) => {
      const value: ListValue = { id: 40, list: 'goal', name: JSON.parse(init!.body as string).name, order: lists.goal.length };
      lists.goal.push(value);
      return { status: 201, body: value };
    },
    'PUT /api/lists/projectType/2': (init) => {
      lists.projectType[1] = { ...lists.projectType[1], name: JSON.parse(init!.body as string).name };
      return { body: lists.projectType[1] };
    },
    'DELETE /api/lists/projectType/1': () => ({ status: 409, body: { error: '"Criminal" is used by 1 project' } }),
    'DELETE /api/lists/department/30': () => {
      lists.department = [];
      return { status: 204, body: null };
    },
    'GET /api/resources': () => ({ body: samplePeople() }),
    'GET /api/settings/me': () => ({ body: me }),
    'PUT /api/settings/me': (init) => {
      const resourceId = JSON.parse(init!.body as string).resourceId as number | null;
      const person = samplePeople().find((p) => p.id === resourceId);
      me = { resourceId, name: person?.name ?? null };
      return { body: me };
    },
  };
}

const renderPage = () => render(<MemoryRouter><SettingsPage /></MemoryRouter>);

describe('SettingsPage', () => {
  it('shows all four lists', async () => {
    mockFetch(fakeServer());
    renderPage();
    expect(await screen.findByText('Digital Services')).toBeInTheDocument();
    expect(screen.getByText('Criminal')).toBeInTheDocument();
    expect(screen.getByText('Digitalisation of internal operations')).toBeInTheDocument();
    expect(screen.getByText('Finance')).toBeInTheDocument();
  });

  it('adds a value', async () => {
    const fetchMock = mockFetch(fakeServer());
    const user = userEvent.setup();
    renderPage();
    await user.type(await screen.findByLabelText('New goal'), 'Better service');
    await user.click(screen.getByRole('button', { name: 'Add goal' }));
    expect(await screen.findByText('Better service')).toBeInTheDocument();
    expect(screen.getByLabelText('New goal')).toHaveValue('');
    expect(fetchMock).toHaveBeenCalledWith('/api/lists/goal', expect.objectContaining({ method: 'POST' }));
  });

  it('renames a value', async () => {
    mockFetch(fakeServer());
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Rename Customer' }));
    const input = screen.getByLabelText('New name for Customer');
    await user.clear(input);
    await user.type(input, 'Customer services');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Customer services')).toBeInTheDocument();
  });

  it('deletes an unused value, and explains why a used one cannot be deleted', async () => {
    mockFetch(fakeServer());
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Delete Finance' }));
    expect(await screen.findByText('Nothing here yet.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Delete Criminal' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('"Criminal" is used by 1 project');
    expect(screen.getByText('Criminal')).toBeInTheDocument();
  });

  it('the "I am" select lists active tech people only', async () => {
    mockFetch(fakeServer());
    renderPage();
    const select = await screen.findByLabelText('I am');
    const options = Array.from(select.querySelectorAll('option')).map((o) => o.textContent);
    expect(options).toEqual(['Not set', 'Fatima Noor', 'Rami Saleh', 'Sara Ahmed']);
  });

  it('saves "I am" and shows Saved', async () => {
    const fetchMock = mockFetch(fakeServer());
    const user = userEvent.setup();
    renderPage();
    const select = await screen.findByLabelText('I am');
    await user.selectOptions(select, 'Sara Ahmed');
    expect(await screen.findByRole('status')).toHaveTextContent('Saved');
    expect(select).toHaveValue('70');
    const put = fetchMock.mock.calls.find(([url, init]) => url === '/api/settings/me' && init?.method === 'PUT');
    expect(JSON.parse(put![1]!.body as string)).toEqual({ resourceId: 70 });
  });

  it('choosing a phase shows its starter to-dos', async () => {
    mockFetch(fakeServer());
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole('option', { name: 'UAT (2)' });
    await user.selectOptions(screen.getByLabelText('Phase'), 'UAT (2)');
    expect(await screen.findByText('Write test cases')).toBeInTheDocument();
    expect(screen.getByText('Confirm test data')).toBeInTheDocument();
  });

  it('adds a starter to-do to the selected phase', async () => {
    const fetchMock = mockFetch(fakeServer());
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole('option', { name: 'UAT (2)' });
    await user.selectOptions(screen.getByLabelText('Phase'), 'UAT (2)');
    await user.type(screen.getByLabelText('New starter to-do'), 'Get UAT sign-off');
    await user.click(screen.getByRole('button', { name: 'Add' }));
    expect(await screen.findByText('Get UAT sign-off')).toBeInTheDocument();
    const post = fetchMock.mock.calls.find(([url, init]) => url === '/api/starter-todos' && init?.method === 'POST');
    expect(JSON.parse(post![1]!.body as string)).toEqual({ phaseListId: 55, title: 'Get UAT sign-off' });
  });

  it('deletes a starter to-do', async () => {
    const fetchMock = mockFetch(fakeServer());
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole('option', { name: 'UAT (2)' });
    await user.selectOptions(screen.getByLabelText('Phase'), 'UAT (2)');
    await user.click(await screen.findByRole('button', { name: 'Delete starter Write test cases' }));
    expect(screen.queryByText('Write test cases')).toBeNull();
    expect(fetchMock.mock.calls.some(([url, init]) => url === '/api/starter-todos/1' && init?.method === 'DELETE')).toBe(true);
  });

  it('renames a starter to-do', async () => {
    const fetchMock = mockFetch(fakeServer());
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole('option', { name: 'UAT (2)' });
    await user.selectOptions(screen.getByLabelText('Phase'), 'UAT (2)');
    await user.click(await screen.findByRole('button', { name: 'Rename Write test cases' }));
    const input = screen.getByLabelText('New title for Write test cases');
    await user.clear(input);
    await user.type(input, 'Write full test cases');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Write full test cases')).toBeInTheDocument();
    const put = fetchMock.mock.calls.find(([url, init]) => url === '/api/starter-todos/1' && init?.method === 'PUT');
    expect(JSON.parse(put![1]!.body as string)).toEqual({ title: 'Write full test cases' });
  });

  it('shows the last backup and how many are kept', async () => {
    mockFetch(fakeServer({ latest: '2026-09-25', count: 14 }));
    renderPage();
    expect(await screen.findByText('Last backup: Fri 25 Sep 2026 · 14 kept in the backups folder.')).toBeInTheDocument();
  });

  it('shows a message when there is no backup yet', async () => {
    mockFetch(fakeServer({ latest: null, count: 0 }));
    renderPage();
    expect(await screen.findByText('No backup yet. One is taken each day while the app is running.')).toBeInTheDocument();
  });
});
