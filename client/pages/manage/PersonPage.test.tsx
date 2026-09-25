// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it } from 'vitest';
import type { LeaveRecord, ResourceRecord } from '../../../shared/types';
import type { WorkCalendar } from '../../../shared/calendar';
import { mockFetch, sampleLists, samplePeople, type MockHandler } from '../../testing/mockFetch';
import { PersonPage } from './PersonPage';

function renderAt(url: string) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/manage/resources" element={<div>Resources list</div>} />
        <Route path="/manage/resources/new" element={<PersonPage />} />
        <Route path="/manage/resources/:id" element={<PersonPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

/** A small in-memory stand-in for the people API, so reloads show changes. */
function fakeServer(calendar: WorkCalendar = { weekendDays: [0, 6], holidays: [] }): Record<string, MockHandler> {
  const people: ResourceRecord[] = samplePeople();
  let nextLeave = 900;
  const fatima = () => people.find((p) => p.id === 71)!;
  return {
    'GET /api/resources': () => ({ body: structuredClone(people) }),
    'GET /api/lists': () => ({ body: sampleLists() }),
    'GET /api/settings/calendar': () => ({ body: calendar }),
    'POST /api/resources': (init) => ({ status: 201, body: { ...people[0], ...JSON.parse(init!.body as string), id: 99 } }),
    'PUT /api/resources/72': (init) => ({ body: { ...people[2], ...JSON.parse(init!.body as string) } }),
    'DELETE /api/resources/70': () => ({
      status: 409,
      body: { error: "Sara Ahmed can't be deleted because they are a project manager on 2 projects. Make them inactive instead." },
    }),
    'POST /api/resources/71/leave': (init) => {
      const leave: LeaveRecord = { id: nextLeave++, note: null, ...JSON.parse(init!.body as string) };
      fatima().leave.push(leave);
      return { status: 201, body: leave };
    },
    'DELETE /api/leave/900': () => {
      fatima().leave = [];
      return { status: 204, body: null };
    },
  };
}

describe('PersonPage', () => {
  it('adds a tech-team person', async () => {
    const fetchMock = mockFetch(fakeServer());
    const user = userEvent.setup();
    renderAt('/manage/resources/new');
    await user.type(screen.getByLabelText('Name'), 'Hassan Ali');
    await screen.findByRole('option', { name: 'Developer' });
    await user.selectOptions(screen.getByLabelText('Role'), 'Developer');
    await user.selectOptions(screen.getByLabelText('Specialisation'), 'Full stack');
    await user.clear(screen.getByLabelText('Capacity (%)'));
    await user.type(screen.getByLabelText('Capacity (%)'), '80');
    await user.click(screen.getByRole('button', { name: 'Add person' }));

    expect(await screen.findByText('Resources list')).toBeInTheDocument();
    const post = fetchMock.mock.calls.find(([url, init]) => url === '/api/resources' && init?.method === 'POST');
    expect(JSON.parse(post![1]!.body as string)).toMatchObject({
      name: 'Hassan Ali', side: 'tech', roleId: 63, specialisation: 'full-stack', capacity: 80, active: true,
    });
  });

  it('asks a business contact only for name, phone and email', async () => {
    const fetchMock = mockFetch(fakeServer());
    const user = userEvent.setup();
    renderAt('/manage/resources/new');
    await user.click(screen.getByRole('radio', { name: 'Business side' }));
    expect(screen.queryByLabelText('Role')).toBeNull();
    expect(screen.queryByLabelText('Capacity (%)')).toBeNull();
    await user.type(screen.getByLabelText('Name'), 'Noura Al Hammadi');
    await user.type(screen.getByLabelText('Phone (UAE mobile)'), '055 234 5678');
    await user.click(screen.getByRole('button', { name: 'Add person' }));

    expect(await screen.findByText('Resources list')).toBeInTheDocument();
    const post = fetchMock.mock.calls.find(([url, init]) => url === '/api/resources' && init?.method === 'POST');
    expect(JSON.parse(post![1]!.body as string)).toMatchObject({ name: 'Noura Al Hammadi', side: 'business', phone: '055 234 5678' });
  });

  it('shows what is wrong without saving', async () => {
    const fetchMock = mockFetch(fakeServer());
    const user = userEvent.setup();
    renderAt('/manage/resources/new');
    await user.type(screen.getByLabelText('Phone (UAE mobile)'), '04 123 4567');
    await user.click(screen.getByRole('button', { name: 'Add person' }));
    expect(await screen.findByText('Name is required')).toBeInTheDocument();
    expect(screen.getByText('Enter a UAE mobile number, e.g. +971 50 123 4567')).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false);
  });

  it('edits an existing person', async () => {
    const fetchMock = mockFetch(fakeServer());
    const user = userEvent.setup();
    renderAt('/manage/resources/72');
    expect(await screen.findByLabelText('Name')).toHaveValue('Rami Saleh');
    expect(screen.getByLabelText('Capacity (%)')).toHaveValue(80);
    await user.clear(screen.getByLabelText('Capacity (%)'));
    await user.type(screen.getByLabelText('Capacity (%)'), '100');
    await user.click(screen.getByRole('checkbox', { name: 'Active' }));
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByText('Resources list')).toBeInTheDocument();
    const put = fetchMock.mock.calls.find(([url, init]) => url === '/api/resources/72' && init?.method === 'PUT');
    expect(JSON.parse(put![1]!.body as string)).toMatchObject({ name: 'Rami Saleh', capacity: 100, active: false, roleId: 63 });
  });

  it('explains why someone in use cannot be deleted', async () => {
    mockFetch(fakeServer());
    const user = userEvent.setup();
    renderAt('/manage/resources/70');
    await user.click(await screen.findByRole('button', { name: 'Delete person' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      "Sara Ahmed can't be deleted because they are a project manager on 2 projects. Make them inactive instead.",
    );
  });

  it('books and removes leave', async () => {
    mockFetch(fakeServer());
    const user = userEvent.setup();
    renderAt('/manage/resources/71');
    expect(await screen.findByText('No leave booked.')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Leave from'), { target: { value: '2026-10-12' } });
    fireEvent.change(screen.getByLabelText('Leave to'), { target: { value: '2026-10-16' } });
    await user.type(screen.getByLabelText('Note'), 'Annual leave');
    await user.click(screen.getByRole('button', { name: 'Add leave' }));
    expect(await screen.findByText('Mon 12 Oct 2026 → Fri 16 Oct 2026 · Annual leave · 5 working days')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Remove leave from Mon 12 Oct 2026' }));
    expect(await screen.findByText('No leave booked.')).toBeInTheDocument();
  });

  it('counts working days with a custom calendar', async () => {
    const customCalendar: WorkCalendar = { weekendDays: [5, 6], holidays: [] };
    mockFetch(fakeServer(customCalendar));
    const user = userEvent.setup();
    renderAt('/manage/resources/71');
    expect(await screen.findByText('No leave booked.')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Leave from'), { target: { value: '2026-10-12' } });
    fireEvent.change(screen.getByLabelText('Leave to'), { target: { value: '2026-10-16' } });
    await user.click(screen.getByRole('button', { name: 'Add leave' }));
    expect(await screen.findByText('Mon 12 Oct 2026 → Fri 16 Oct 2026 · 4 working days')).toBeInTheDocument();
  });

  it('says when the person does not exist', async () => {
    mockFetch(fakeServer());
    renderAt('/manage/resources/999');
    expect(await screen.findByText('Person not found')).toBeInTheDocument();
  });
});
