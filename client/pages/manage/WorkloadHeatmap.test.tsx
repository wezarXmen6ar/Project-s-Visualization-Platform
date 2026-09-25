// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { computeWorkload } from '../../../shared/capacity';
import { overbookedWorkload } from '../../testing/mockFetch';
import { WorkloadHeatmap } from './WorkloadHeatmap';

const data = overbookedWorkload();
const loads = computeWorkload(data.resources, data.assignments, { start: '2026-10-05', end: '2026-10-25' }, data.calendar);

/** overbookedWorkload plus Jonas, on leave Mon 19–Wed 21 Oct, for the leave-slice tests. */
function withJonas() {
  const withJonasData = overbookedWorkload();
  withJonasData.resources.push({ id: 73, name: 'Jonas Berg', capacity: 100, leave: [{ start: '2026-10-19', end: '2026-10-21', note: 'Training' }] });
  const jonasLoads = computeWorkload(
    withJonasData.resources, withJonasData.assignments, { start: '2026-10-05', end: '2026-10-25' }, withJonasData.calendar,
  );
  return { data: withJonasData, loads: jonasLoads };
}

describe('WorkloadHeatmap', () => {
  it('shows each person by week, with how much is booked', () => {
    render(
      <MemoryRouter>
        <WorkloadHeatmap
          loads={loads}
          decisions={[]}
          calendar={data.calendar}
          resources={data.resources}
          selected={null}
          onSelect={() => {}}
        />
      </MemoryRouter>,
    );
    const header = screen.getByRole('columnheader', { name: /5–9 Oct/ });
    expect(header).toHaveTextContent('Week 41');
    expect(header).toHaveTextContent('5–9 Oct');
    const over = screen.getByRole('button', { name: 'Fatima Noor, Mon 5 Oct – Fri 9 Oct: 160% booked of 100% available, overbooked' });
    expect(over).toHaveTextContent('160%');
    expect(over).toHaveClass('heat-over');
    expect(screen.getByRole('button', { name: 'Rami Saleh, Mon 5 Oct – Fri 9 Oct: 60% booked of 80% available, booked' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Fatima Noor, Mon 12 Oct – Fri 16 Oct: 0% booked of 100% available, free' })).toHaveTextContent('');
    expect(screen.getByRole('link', { name: 'Rami Saleh' })).toHaveAttribute('href', '/manage/resources/72');
  });

  it('shows an accepted overbooking differently, and reports clicks', async () => {
    const onSelect = vi.fn();
    const decisions = [{ id: 1, resourceId: 71, weekStart: '2026-10-05', decision: 'accept' as const, note: null, date: '2026-10-01' }];
    render(
      <MemoryRouter>
        <WorkloadHeatmap
          loads={loads}
          decisions={decisions}
          calendar={data.calendar}
          resources={data.resources}
          selected={null}
          onSelect={onSelect}
        />
      </MemoryRouter>,
    );
    const cell = screen.getByRole('button', { name: /^Fatima Noor, Mon 5 Oct – Fri 9 Oct: .* overbooked \(accepted\)$/ });
    expect(cell).toHaveClass('heat-accepted');
    await userEvent.click(cell);
    expect(onSelect).toHaveBeenCalledWith(71, '2026-10-05');
  });

  it("shows Rami's leave (Mon 19–Tue 20 Oct) as two striped slices in that week's cell", () => {
    render(
      <MemoryRouter>
        <WorkloadHeatmap
          loads={loads}
          decisions={[]}
          calendar={data.calendar}
          resources={data.resources}
          selected={null}
          onSelect={() => {}}
        />
      </MemoryRouter>,
    );
    const cell = screen.getByRole('button', { name: /^Rami Saleh, Mon 19 Oct – Fri 23 Oct:/ }).closest('td')!;
    expect(cell.querySelectorAll('.leave-slice')).toHaveLength(5);
    expect(cell.querySelectorAll('.leave-slice.on-leave')).toHaveLength(2);
  });

  it("gives Jonas's cell aria-label the leave range, and stripes three of five slices for Mon–Wed leave", () => {
    const { data: jonasData, loads: jonasLoads } = withJonas();
    render(
      <MemoryRouter>
        <WorkloadHeatmap
          loads={jonasLoads}
          decisions={[]}
          calendar={jonasData.calendar}
          resources={jonasData.resources}
          selected={null}
          onSelect={() => {}}
        />
      </MemoryRouter>,
    );
    const cell = screen.getByRole('button', { name: /^Jonas Berg, Mon 19 Oct – Fri 23 Oct:.*on leave Mon 19 Oct – Wed 21 Oct$/ });
    expect(cell).toBeInTheDocument();
    expect(cell.querySelectorAll('.leave-slice')).toHaveLength(5);
    expect(cell.querySelectorAll('.leave-slice.on-leave')).toHaveLength(3);
  });

  it('heads each week with its ISO week number over its dates, and shows five visible day squares', () => {
    const { data: jonasData, loads: jonasLoads } = withJonas();
    render(
      <MemoryRouter>
        <WorkloadHeatmap
          loads={jonasLoads}
          decisions={[]}
          calendar={jonasData.calendar}
          resources={jonasData.resources}
          selected={null}
          onSelect={() => {}}
        />
      </MemoryRouter>,
    );
    const header = screen.getByRole('columnheader', { name: /12–16 Oct/ });
    expect(header).toHaveTextContent('Week 42');
    expect(header.querySelector('.week-number')).toHaveTextContent('Week 42');
    expect(header.querySelector('.week-dates')).toHaveTextContent('12–16 Oct');
    const cell = screen.getByRole('button', { name: /^Jonas Berg, Mon 19 Oct – Fri 23 Oct:/ });
    const squares = cell.querySelector('.day-squares')!;
    expect(squares.querySelectorAll('.leave-slice.on-leave')).toHaveLength(3);
    expect(squares.querySelectorAll('.leave-slice:not(.on-leave)')).toHaveLength(2);
  });
});
