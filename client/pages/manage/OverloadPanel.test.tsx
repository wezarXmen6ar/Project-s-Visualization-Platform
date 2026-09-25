// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
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

const bodyOf = (fetchMock: ReturnType<typeof mockFetch>, method: string, url: string) =>
  JSON.parse(fetchMock.mock.calls.find(([u, init]) => u === url && init?.method === method)![1]!.body as string);

describe('OverloadPanel', () => {
  it("lists the week's work and offers split, reassign and accept, with pause and delay not yet available", () => {
    renderPanel();
    expect(screen.getByRole('heading', { name: 'Fatima Noor · week of 5 Oct' })).toBeInTheDocument();
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
});
