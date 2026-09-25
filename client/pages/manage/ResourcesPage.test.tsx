// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mockFetch, overbookedWorkload, sampleLists, samplePeople } from '../../testing/mockFetch';
import { ResourcesPage } from './ResourcesPage';

const routes = {
  'GET /api/resources': () => ({ body: samplePeople() }),
  'GET /api/lists': () => ({ body: sampleLists() }),
  'GET /api/workload': () => ({ body: overbookedWorkload() }),
};

const renderPage = () => render(<MemoryRouter><ResourcesPage /></MemoryRouter>);
/** The people table (Task 7 adds a second table, the workload heatmap, to this page). */
const peopleTable = () => screen.findByRole('table', { name: 'People' });
const names = async () =>
  within(await peopleTable())
    .getAllByRole('link')
    .filter((a) => a.getAttribute('href')?.startsWith('/manage/resources/'))
    .map((a) => a.textContent);

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('ResourcesPage', () => {
  it('lists everyone with their side, role, capacity and contact', async () => {
    mockFetch(routes);
    renderPage();
    const table = within(await peopleTable());
    const rami = table.getByRole('link', { name: 'Rami Saleh' });
    expect(rami).toHaveAttribute('href', '/manage/resources/72');
    const row = rami.closest('tr')!;
    expect(within(row).getByText('Tech team')).toBeInTheDocument();
    expect(within(row).getByText('Developer · Back end')).toBeInTheDocument();
    expect(within(row).getByText('80%')).toBeInTheDocument();
    const mariam = table.getByRole('link', { name: 'Mariam Al Suwaidi' }).closest('tr')!;
    expect(within(mariam).getByText('Business side')).toBeInTheDocument();
    expect(within(mariam).getByText('+971 50 123 4567 · mariam@example.com')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Add person' })).toHaveAttribute('href', '/manage/resources/new');
  });

  it('filters by side and by role', async () => {
    mockFetch(routes);
    const user = userEvent.setup();
    renderPage();
    await peopleTable();
    await user.selectOptions(screen.getByLabelText('Side'), 'Business side');
    expect(await names()).toEqual(['Mariam Al Suwaidi']);
    await user.selectOptions(screen.getByLabelText('Side'), 'Everyone');
    await user.selectOptions(screen.getByLabelText('Role'), 'Developer');
    expect(await names()).toEqual(['Fatima Noor', 'Rami Saleh']);
  });

  it('invites adding people when there are none', async () => {
    mockFetch({ ...routes, 'GET /api/resources': () => ({ body: [] }) });
    renderPage();
    expect(await screen.findByText('No one yet. Add your team and your business-side contacts.')).toBeInTheDocument();
  });

  it('sorts by the Projects column and flips direction on a second click', async () => {
    mockFetch(routes);
    const user = userEvent.setup();
    renderPage();
    const header = await screen.findByRole('button', { name: 'Projects' });
    const th = header.closest('th')!;
    expect(th).toHaveAttribute('aria-sort', 'none');

    await user.click(header);
    expect(th).toHaveAttribute('aria-sort', 'ascending');
    // Fatima and Rami share "Case Management" (from samplePeople); they sit together, ahead of Sara and Mariam,
    // who have none and are ordered by name as the tiebreak.
    expect(await names()).toEqual(['Fatima Noor', 'Rami Saleh', 'Mariam Al Suwaidi', 'Sara Ahmed']);

    await user.click(header);
    expect(th).toHaveAttribute('aria-sort', 'descending');
  });

  it('filters by "Working on" a project', async () => {
    mockFetch(routes);
    const user = userEvent.setup();
    renderPage();
    await peopleTable();
    await user.selectOptions(screen.getByLabelText('Working on'), 'Case Management');
    expect(await names()).toEqual(['Fatima Noor', 'Rami Saleh']);
  });

  it('shows the workload heatmap from two weeks back, and opens a week', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-14T09:00:00'));
    mockFetch(routes);
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Weeks' }));
    // This week starts 12 Oct, so the heatmap starts 28 Sep.
    expect(await screen.findByRole('columnheader', { name: /28 Sep – 2 Oct/ })).toBeInTheDocument();
    const cell = screen.getByRole('button', { name: 'Fatima Noor, Mon 5 Oct – Fri 9 Oct: 160% booked of 100% available, overbooked' });
    await user.click(cell);
    expect(screen.getByRole('heading', { name: 'Fatima Noor · Mon 5 Oct – Fri 9 Oct' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Later weeks' }));
    expect(screen.getByRole('columnheader', { name: /26–30 Oct/ })).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: /28 Sep – 2 Oct/ })).toBeNull();
  });

  it('shows the Days view by default, from last week, four weeks at a time, moving a week at a time', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-14T09:00:00'));
    mockFetch(routes);
    const user = userEvent.setup();
    renderPage();
    expect(await screen.findByRole('button', { name: 'Days' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Weeks' })).toHaveAttribute('aria-pressed', 'false');
    const workload = await screen.findByRole('table', { name: 'Workload' });
    // This week starts 12 Oct, so the Days view starts 5 Oct and runs to 30 Oct.
    expect(within(workload).getByRole('columnheader', { name: '5–9 Oct' })).toHaveAttribute('colspan', '5');
    expect(within(workload).getByRole('columnheader', { name: '26–30 Oct' })).toBeInTheDocument();
    expect(within(workload).queryByRole('columnheader', { name: '2–6 Nov' })).toBeNull();
    expect(within(workload).getByRole('columnheader', { name: 'Wed 14 Oct' })).toHaveClass('today');

    await user.click(screen.getByRole('button', { name: 'Later weeks' }));
    expect(screen.queryByRole('columnheader', { name: '5–9 Oct' })).toBeNull();
    expect(screen.getByRole('columnheader', { name: '2–6 Nov' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'This week' }));
    expect(screen.getByRole('columnheader', { name: '5–9 Oct' })).toBeInTheDocument();
  });

  it("opens a day's week, listing the days that are overbooked on their own", async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-14T09:00:00'));
    mockFetch(routes);
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Fatima Noor, Tue 6 Oct: 160% booked of 100% available, overbooked' }));
    expect(screen.getByRole('heading', { name: 'Fatima Noor · Mon 5 Oct – Fri 9 Oct' })).toBeInTheDocument();
    const list = screen.getByRole('list', { name: 'Days overbooked on their own' });
    expect(within(list).getByText('Tue 6 Oct: 160% booked, 100% available')).toBeInTheDocument();
  });

  it('switches to the Weeks view and remembers the choice', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-14T09:00:00'));
    mockFetch(routes);
    const user = userEvent.setup();
    const { unmount } = renderPage();
    await user.click(await screen.findByRole('button', { name: 'Weeks' }));
    expect(screen.getByRole('button', { name: 'Weeks' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Days' })).toHaveAttribute('aria-pressed', 'false');
    expect(await screen.findByRole('columnheader', { name: /Week 42/ })).toBeInTheDocument();
    expect(localStorage.getItem('pvp.workloadView')).toBe('weeks');

    unmount();
    renderPage();
    expect(await screen.findByRole('button', { name: 'Weeks' })).toHaveAttribute('aria-pressed', 'true');
    expect(await screen.findByRole('columnheader', { name: /Week 42/ })).toBeInTheDocument();
    // The people table is still there, under its own name.
    expect(within(await peopleTable()).getByRole('link', { name: 'Rami Saleh' })).toBeInTheDocument();
  });

  it('falls back to Days when the saved choice cannot be read', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    mockFetch(routes);
    const user = userEvent.setup();
    renderPage();
    expect(await screen.findByRole('button', { name: 'Days' })).toHaveAttribute('aria-pressed', 'true');
    await user.click(screen.getByRole('button', { name: 'Weeks' }));
    expect(screen.getByRole('button', { name: 'Weeks' })).toHaveAttribute('aria-pressed', 'true');
  });
});
