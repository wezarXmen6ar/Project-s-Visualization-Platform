// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Gantt, type GanttRow } from './Gantt';

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
});
