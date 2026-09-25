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

describe('WorkloadHeatmap', () => {
  it('shows each person by week, with how much is booked', () => {
    render(<MemoryRouter><WorkloadHeatmap loads={loads} decisions={[]} selected={null} onSelect={() => {}} /></MemoryRouter>);
    expect(screen.getByRole('columnheader', { name: '5 Oct' })).toBeInTheDocument();
    const over = screen.getByRole('button', { name: 'Fatima Noor, week of 5 Oct: 160% booked of 100% available, overbooked' });
    expect(over).toHaveTextContent('160%');
    expect(over).toHaveClass('heat-over');
    expect(screen.getByRole('button', { name: 'Rami Saleh, week of 5 Oct: 60% booked of 80% available, booked' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Fatima Noor, week of 12 Oct: 0% booked of 100% available, free' })).toHaveTextContent('');
    expect(screen.getByRole('link', { name: 'Rami Saleh' })).toHaveAttribute('href', '/manage/resources/72');
  });

  it('shows an accepted overbooking differently, and reports clicks', async () => {
    const onSelect = vi.fn();
    const decisions = [{ id: 1, resourceId: 71, weekStart: '2026-10-05', decision: 'accept' as const, note: null, date: '2026-10-01' }];
    render(<MemoryRouter><WorkloadHeatmap loads={loads} decisions={decisions} selected={null} onSelect={onSelect} /></MemoryRouter>);
    const cell = screen.getByRole('button', { name: /^Fatima Noor, week of 5 Oct: .* overbooked \(accepted\)$/ });
    expect(cell).toHaveClass('heat-accepted');
    await userEvent.click(cell);
    expect(onSelect).toHaveBeenCalledWith(71, '2026-10-05');
  });
});
