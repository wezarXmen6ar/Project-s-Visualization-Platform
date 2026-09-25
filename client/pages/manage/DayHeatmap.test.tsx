// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { computeDailyLoad } from '../../../shared/capacity';
import type { OverloadDecision } from '../../../shared/types';
import { overbookedWorkload } from '../../testing/mockFetch';
import { DayHeatmap } from './DayHeatmap';

/** overbookedWorkload with Fatima on leave Mon 12 – Fri 16 Oct, and Jonas on leave Mon 19 – Wed 21 Oct. */
function withLeave() {
  const data = overbookedWorkload();
  data.resources = data.resources.map((r) =>
    r.id === 71 ? { ...r, leave: [{ start: '2026-10-12', end: '2026-10-16', note: 'Annual leave' }] } : r,
  );
  data.resources.push({ id: 73, name: 'Jonas Berg', capacity: 100, leave: [{ start: '2026-10-19', end: '2026-10-21', note: 'Training' }] });
  return data;
}

const data = withLeave();
const people = computeDailyLoad(data.resources, data.assignments, { start: '2026-10-05', end: '2026-11-01' }, data.calendar);

function renderDays(onSelect = vi.fn(), decisions: OverloadDecision[] = []) {
  render(
    <MemoryRouter>
      <DayHeatmap people={people} decisions={decisions} selected={null} onSelect={onSelect} />
    </MemoryRouter>,
  );
  return onSelect;
}

const rowOf = (name: string) => screen.getByRole('link', { name }).closest('tr')!;

describe('DayHeatmap', () => {
  it('groups the days by week, with one column per working day', () => {
    renderDays();
    expect(screen.getByRole('table', { name: 'Workload' })).toBeInTheDocument();
    const group = screen.getByRole('columnheader', { name: '12–16 Oct' });
    expect(group).toHaveAttribute('colspan', '5');
    const monday = screen.getByRole('columnheader', { name: 'Mon 12 Oct' });
    expect(monday).toHaveTextContent('M');
    expect(monday).toHaveTextContent('12');
    // Weekends are not shown.
    expect(screen.queryByRole('columnheader', { name: 'Sat 17 Oct' })).toBeNull();
  });

  it('labels a week that spans two months with both', () => {
    const across = computeDailyLoad(data.resources, data.assignments, { start: '2026-09-28', end: '2026-10-04' }, data.calendar);
    render(
      <MemoryRouter>
        <DayHeatmap people={across} decisions={[]} selected={null} onSelect={() => {}} />
      </MemoryRouter>,
    );
    expect(screen.getByRole('columnheader', { name: '28 Sep – 2 Oct' })).toHaveAttribute('colspan', '5');
  });

  it("shows Fatima's week of leave as five striped Leave blocks", () => {
    renderDays();
    const leave = within(rowOf('Fatima Noor')).getAllByRole('button', { name: /: on leave$/ });
    expect(leave.map((b) => b.getAttribute('aria-label'))).toEqual([
      'Fatima Noor, Mon 12 Oct: on leave',
      'Fatima Noor, Tue 13 Oct: on leave',
      'Fatima Noor, Wed 14 Oct: on leave',
      'Fatima Noor, Thu 15 Oct: on leave',
      'Fatima Noor, Fri 16 Oct: on leave',
    ]);
    for (const b of leave) {
      expect(b).toHaveClass('leave');
      expect(b).toHaveTextContent('Leave');
    }
  });

  it('shows Jonas on leave for three days in the week of 19 Oct', () => {
    renderDays();
    const leave = within(rowOf('Jonas Berg')).getAllByRole('button', { name: /: on leave$/ });
    expect(leave.map((b) => b.getAttribute('aria-label'))).toEqual([
      'Jonas Berg, Mon 19 Oct: on leave',
      'Jonas Berg, Tue 20 Oct: on leave',
      'Jonas Berg, Wed 21 Oct: on leave',
    ]);
    expect(screen.getByRole('button', { name: 'Jonas Berg, Thu 22 Oct: 0% booked of 100% available, free' })).toHaveTextContent('');
  });

  it('shows the load on each day, and an overbooked day in red', () => {
    renderDays();
    const over = screen.getByRole('button', { name: 'Fatima Noor, Tue 6 Oct: 160% booked of 100% available, overbooked' });
    expect(over).toHaveTextContent('160');
    expect(over).toHaveClass('heat-over');
  });

  it('shows an overbooked day in an accepted week in the accepted style', () => {
    renderDays(vi.fn(), [{ id: 1, resourceId: 71, weekStart: '2026-10-05', decision: 'accept', note: null, date: '2026-10-01' }]);
    expect(screen.getByRole('button', { name: /^Fatima Noor, Tue 6 Oct: .*overbooked \(accepted\)$/ })).toHaveClass('heat-accepted');
  });

  it("selects the day's week when a day is clicked", async () => {
    const onSelect = renderDays();
    await userEvent.click(screen.getByRole('button', { name: /^Fatima Noor, Wed 7 Oct:/ }));
    expect(onSelect).toHaveBeenCalledWith(71, '2026-10-05');
  });
});
