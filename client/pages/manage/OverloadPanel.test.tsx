// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { computeWorkload } from '../../../shared/capacity';
import { mockFetch, overbookedWorkload, sampleProject } from '../../testing/mockFetch';
import { OverloadPanel } from './OverloadPanel';

const data = overbookedWorkload();
const fatima = computeWorkload(data.resources, data.assignments, { start: '2026-10-05', end: '2026-10-11' }, data.calendar)[0];
const week = fatima.weeks[0];

const decisionRoute = {
  'POST /api/overloads/decisions': (init?: RequestInit) => ({
    status: 201, body: { id: 1, date: '2026-10-01', note: null, ...JSON.parse(init!.body as string) },
  }),
};

function renderPanel(onChanged = vi.fn()) {
  render(<OverloadPanel data={data} person={fatima} week={week} onClose={() => {}} onChanged={onChanged} />);
  return onChanged;
}

/** overbookedWorkload with Fatima on leave Mon 12 – Fri 16 Oct, for the leave-line test. */
function withFatimaLeave() {
  const withLeave = overbookedWorkload();
  withLeave.resources = withLeave.resources.map((r) =>
    r.id === 71 ? { ...r, leave: [{ start: '2026-10-12', end: '2026-10-16', note: 'Annual leave' }] } : r,
  );
  return withLeave;
}

const bodyOf = (fetchMock: ReturnType<typeof mockFetch>, method: string, url: string) =>
  JSON.parse(fetchMock.mock.calls.find(([u, init]) => u === url && init?.method === method)![1]!.body as string);

describe('OverloadPanel', () => {
  it('lists the days that are overbooked on their own, even when the week as a whole is not', () => {
    const clash = overbookedWorkload();
    clash.assignments.push({
      id: 503, resourceId: 72, phaseId: 903, projectId: 93, projectName: 'Portal', phaseName: 'UAT',
      start: '2026-10-13', end: '2026-10-13', allocation: 40, role: 'contributor',
    });
    const rami = computeWorkload(clash.resources, clash.assignments, { start: '2026-10-12', end: '2026-10-18' }, clash.calendar)[1];
    render(<OverloadPanel data={clash} person={rami} week={rami.weeks[0]} onClose={() => {}} onChanged={() => {}} />);
    expect(screen.getByText('68% booked of 80% available')).toBeInTheDocument();
    const list = screen.getByRole('list', { name: 'Days overbooked on their own' });
    expect(within(list).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['Tue 13 Oct: 100% booked, 80% available']);
    expect(screen.queryByRole('button', { name: 'Accept the risk' })).toBeNull();
  });

  it('lists no single-day clashes when every day fits', () => {
    const rami = computeWorkload(data.resources, data.assignments, { start: '2026-10-12', end: '2026-10-18' }, data.calendar)[1];
    render(<OverloadPanel data={data} person={rami} week={rami.weeks[0]} onClose={() => {}} onChanged={() => {}} />);
    expect(screen.queryByRole('list', { name: 'Days overbooked on their own' })).toBeNull();
  });

  it("lists the week's work and offers split, reassign and accept, with pause and delay not yet available", () => {
    renderPanel();
    expect(screen.getByRole('heading', { name: 'Fatima Noor · Mon 5 Oct – Fri 9 Oct' })).toBeInTheDocument();
    expect(screen.getByText('160% booked of 100% available')).toBeInTheDocument();
    expect(screen.getByText('HR Self-Service · QA: 100% for 5 days')).toBeInTheDocument();
    expect(screen.getByText('Portal · Development: 60% for 5 days')).toBeInTheDocument();
    for (const name of ['Split the time', 'Reassign work', 'Accept the risk']) {
      expect(screen.getByRole('button', { name })).toBeEnabled();
    }
    expect(screen.getByRole('button', { name: 'Pause a project' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Delay a phase' })).toBeDisabled();
  });

  it('accepts the risk with a reason', async () => {
    const fetchMock = mockFetch(decisionRoute);
    const user = userEvent.setup();
    const onChanged = renderPanel();
    await user.click(screen.getByRole('button', { name: 'Accept the risk' }));
    await user.type(screen.getByLabelText('Why is this OK? (optional)'), 'Deadline week');
    await user.click(screen.getByRole('button', { name: 'Record the decision' }));
    await vi.waitFor(() => expect(onChanged).toHaveBeenCalled());
    expect(bodyOf(fetchMock, 'POST', '/api/overloads/decisions')).toEqual({
      resourceId: 71, weekStart: '2026-10-05', decision: 'accept', note: 'Deadline week',
    });
  });

  it("splits the time by changing one piece of work's allocation", async () => {
    const fetchMock = mockFetch({ ...decisionRoute, 'PUT /api/phases/902/assignments': () => ({ body: sampleProject() }) });
    const user = userEvent.setup();
    const onChanged = renderPanel();
    await user.click(screen.getByRole('button', { name: 'Split the time' }));
    const portal = screen.getByLabelText('Allocation for Portal · Development (%)');
    await user.clear(portal);
    await user.type(portal, '20');
    await user.click(screen.getByRole('button', { name: 'Save new allocations' }));
    await vi.waitFor(() => expect(onChanged).toHaveBeenCalled());
    expect(bodyOf(fetchMock, 'PUT', '/api/phases/902/assignments')).toEqual({
      assignments: [{ resourceId: 71, allocation: 20, role: 'contributor' }],
    });
    expect(bodyOf(fetchMock, 'POST', '/api/overloads/decisions')).toMatchObject({ decision: 'split', weekStart: '2026-10-05' });
    expect(fetchMock.mock.calls.some(([u]) => u === '/api/phases/900/assignments')).toBe(false);
  });

  it('reassigns a piece of work to someone else, showing their load that week', async () => {
    const fetchMock = mockFetch({ ...decisionRoute, 'PUT /api/phases/902/assignments': () => ({ body: sampleProject() }) });
    const user = userEvent.setup();
    const onChanged = renderPanel();
    await user.click(screen.getByRole('button', { name: 'Reassign work' }));
    await user.selectOptions(screen.getByLabelText('Work to move'), 'Portal · Development (60%)');
    await user.selectOptions(screen.getByLabelText('Give it to'), 'Rami Saleh (60% booked this week)');
    await user.click(screen.getByRole('button', { name: 'Reassign' }));
    await vi.waitFor(() => expect(onChanged).toHaveBeenCalled());
    expect(bodyOf(fetchMock, 'PUT', '/api/phases/902/assignments')).toEqual({
      assignments: [{ resourceId: 72, allocation: 60, role: 'contributor' }],
    });
    expect(bodyOf(fetchMock, 'POST', '/api/overloads/decisions')).toMatchObject({ decision: 'reassign' });
  });

  it("shows the server's message when a change is refused", async () => {
    mockFetch({
      'PUT /api/phases/902/assignments': () => ({
        status: 400,
        body: { error: 'Invalid assignments', issues: [{ path: 'assignments.0.resourceId', message: 'The same person is assigned twice to this phase' }] },
      }),
    });
    const user = userEvent.setup();
    const onChanged = renderPanel();
    await user.click(screen.getByRole('button', { name: 'Reassign work' }));
    await user.selectOptions(screen.getByLabelText('Work to move'), 'Portal · Development (60%)');
    await user.selectOptions(screen.getByLabelText('Give it to'), 'Rami Saleh (60% booked this week)');
    await user.click(screen.getByRole('button', { name: 'Reassign' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('The same person is assigned twice to this phase');
    expect(onChanged).not.toHaveBeenCalled();
  });

  it("shows the person's leave that overlaps the week, under the summary", () => {
    const withLeave = withFatimaLeave();
    const fatimaLeaveWeek = computeWorkload(
      withLeave.resources, withLeave.assignments, { start: '2026-10-12', end: '2026-10-12' }, withLeave.calendar,
    )[0];
    render(
      <OverloadPanel data={withLeave} person={fatimaLeaveWeek} week={fatimaLeaveWeek.weeks[0]} onClose={() => {}} onChanged={() => {}} />,
    );
    expect(screen.getByRole('heading', { name: 'Fatima Noor · Mon 12 Oct – Fri 16 Oct' })).toBeInTheDocument();
    expect(screen.getByText('On leave Mon 12 Oct – Fri 16 Oct · Annual leave')).toBeInTheDocument();
  });
});
