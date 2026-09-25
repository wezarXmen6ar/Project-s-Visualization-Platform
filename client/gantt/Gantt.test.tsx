// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Gantt, type GanttRow } from './Gantt';

const octoberRange = { start: '2026-10-01', end: '2026-10-31' };

const rows: GanttRow[] = [
  { id: 'a', label: 'Requirements', bars: [{ id: 'a1', start: '2026-01-01', end: '2026-01-05', color: '#3b82f6' }] },
  { id: 'b', label: 'Old work', bars: [{ id: 'b1', start: '2025-12-01', end: '2025-12-10', color: '#999999' }] },
];
const range = { start: '2026-01-01', end: '2026-01-10' };

describe('Gantt', () => {
  it('draws bars sized by working span, offset by the label column', () => {
    render(<Gantt rows={rows} range={range} width={300} />);
    // Scoped to `.gantt-label`: the label <text> also contains a nested <title> tooltip
    // with the same text, so an unscoped getByText('Requirements') matches both nodes.
    expect(screen.getByText('Requirements', { selector: '.gantt-label' })).toBeInTheDocument();
    const rect = screen.getByTestId('gantt-bar-a1').querySelector('rect')!;
    expect(rect.getAttribute('x')).toBe('200');
    expect(rect.getAttribute('width')).toBe('50');
  });
  it('does not draw bars outside the range', () => {
    render(<Gantt rows={rows} range={range} width={300} />);
    expect(screen.queryByTestId('gantt-bar-b1')).toBeNull();
  });
  it('reports row clicks', async () => {
    const onRowClick = vi.fn();
    render(<Gantt rows={rows} range={range} width={300} onRowClick={onRowClick} />);
    await userEvent.click(screen.getByTestId('gantt-row-a'));
    expect(onRowClick).toHaveBeenCalledWith('a');
  });
  it('draws a today line only when today is in range', () => {
    const { rerender } = render(<Gantt rows={rows} range={range} width={300} today="2026-01-03" />);
    expect(screen.getByTestId('gantt-today')).toBeInTheDocument();
    rerender(<Gantt rows={rows} range={range} width={300} today="2026-05-01" />);
    expect(screen.queryByTestId('gantt-today')).toBeNull();
  });
  it('draws a group row with a summary bar that does not open anything', async () => {
    const onRowClick = vi.fn();
    const grouped: GanttRow[] = [
      { id: 'g', label: 'Digital', kind: 'group', bars: [{ id: 'g', start: '2026-01-01', end: '2026-01-05', color: 'currentColor' }] },
      { ...rows[0], kind: 'child' },
    ];
    render(<Gantt rows={grouped} range={range} width={300} onRowClick={onRowClick} />);
    expect(screen.getByTestId('gantt-bar-g').querySelector('rect')).toHaveClass('gantt-summary');
    await userEvent.click(screen.getByTestId('gantt-row-g'));
    expect(onRowClick).not.toHaveBeenCalled();
    await userEvent.click(screen.getByTestId('gantt-row-a'));
    expect(onRowClick).toHaveBeenCalledWith('a');
  });

  it('shows work-week day numbers with detail="weeks", never a "Sep 2025"-style tick', () => {
    render(<Gantt rows={rows} range={octoberRange} width={700} detail="weeks" />);
    expect(screen.getByText('9', { selector: '.gantt-week-tick' })).toBeInTheDocument();
    expect(screen.getByText('16', { selector: '.gantt-week-tick' })).toBeInTheDocument();
    expect(screen.queryByText(/^[A-Z][a-z]{2} \d{4}$/, { selector: '.gantt-tick' })).toBeNull();
  });

  it('labels a bar with its dates when showDates is set', () => {
    const datedRows: GanttRow[] = [
      { id: 'a', label: 'Development', bars: [{ id: 'a1', start: '2026-09-08', end: '2026-09-19', color: '#3b82f6' }] },
    ];
    render(<Gantt rows={datedRows} range={{ start: '2026-09-01', end: '2026-09-30' }} width={700} showDates />);
    expect(screen.getByText('8 Sep – 19 Sep')).toBeInTheDocument();
  });

  it('puts the dates before the bar when they would not fit after it', () => {
    const edgeRows: GanttRow[] = [
      { id: 'a', label: 'Development', bars: [{ id: 'a1', start: '2026-09-20', end: '2026-09-30', color: '#3b82f6' }] },
    ];
    const range = { start: '2026-09-01', end: '2026-09-30' };
    render(<Gantt rows={edgeRows} range={range} width={700} showDates />);
    const label = screen.getByText('20 Sep – 30 Sep');
    const bar = screen.getByTestId('gantt-bar-a1').querySelector('rect')!;
    const barX = Number(bar.getAttribute('x'));
    expect(Number(label.getAttribute('x'))).toBeLessThan(barX);
  });

  it('shows the year on both dates when they fall in different years', () => {
    const spanningRows: GanttRow[] = [
      { id: 'a', label: 'Development', bars: [{ id: 'a1', start: '2026-11-30', end: '2027-02-19', color: '#3b82f6' }] },
    ];
    const range = { start: '2026-11-01', end: '2027-03-31' };
    render(<Gantt rows={spanningRows} range={range} width={900} showDates />);
    expect(screen.getByText('30 Nov 2026 – 19 Feb 2027')).toBeInTheDocument();
  });
});
