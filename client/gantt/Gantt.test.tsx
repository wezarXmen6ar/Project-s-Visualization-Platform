// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_CALENDAR } from '../../shared/calendar';
import { Gantt, type GanttRow } from './Gantt';
import { workWeekEnds } from './scale';

const octoberRange = { start: '2026-10-01', end: '2026-10-31' };

/** Stubs `window.matchMedia('(hover: none)')` so the click/tap-toggle behaviour is deterministic in tests. */
function stubHover(canHover: boolean) {
  vi.stubGlobal('matchMedia', vi.fn().mockImplementation((query: string) => ({
    matches: query === '(hover: none)' ? !canHover : false,
    media: query,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })));
}

const rows: GanttRow[] = [
  { id: 'a', label: 'Requirements', bars: [{ id: 'a1', start: '2026-01-01', end: '2026-01-05', color: '#3b82f6' }] },
  { id: 'b', label: 'Old work', bars: [{ id: 'b1', start: '2025-12-01', end: '2025-12-10', color: '#999999' }] },
];
const range = { start: '2026-01-01', end: '2026-01-10' };

describe('Gantt', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

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

  it('thins week-number labels on a long range on a narrow screen so they never overlap', () => {
    const yearRange = { start: '2026-01-01', end: '2026-12-31' };
    render(<Gantt rows={rows} range={yearRange} width={390} detail="weeks" />);
    const weekEnds = workWeekEnds(yearRange, DEFAULT_CALENDAR);
    const shown = screen.getAllByText(/^\d{1,2}$/, { selector: '.gantt-week-tick' });
    expect(shown.length).toBeLessThan(weekEnds.length);
  });

  it('shows every week-number label on a short range with plenty of width', () => {
    const monthRange = { start: '2026-10-01', end: '2026-10-31' };
    render(<Gantt rows={rows} range={monthRange} width={1200} detail="weeks" />);
    const weekEnds = workWeekEnds(monthRange, DEFAULT_CALENDAR);
    const shown = screen.getAllByText(/^\d{1,2}$/, { selector: '.gantt-week-tick' });
    expect(shown.length).toBe(weekEnds.length);
  });

  it('shows the year on both dates when they fall in different years', () => {
    const spanningRows: GanttRow[] = [
      { id: 'a', label: 'Development', bars: [{ id: 'a1', start: '2026-11-30', end: '2027-02-19', color: '#3b82f6' }] },
    ];
    const range = { start: '2026-11-01', end: '2027-03-31' };
    render(<Gantt rows={spanningRows} range={range} width={900} showDates />);
    expect(screen.getByText('30 Nov 2026 – 19 Feb 2027')).toBeInTheDocument();
  });

  describe('sub-phase segments and details', () => {
    const detailRows: GanttRow[] = [
      {
        id: 'dev', label: 'Development',
        bars: [{
          id: 'dev', start: '2026-10-05', end: '2026-10-23', color: '#3b82f6', label: 'Development',
          detail: { title: 'Development', lines: ['Mon 5 Oct 2026 – Fri 23 Oct 2026 · 15 working days'] },
          segments: [
            {
              id: 's1', start: '2026-10-05', end: '2026-10-09', label: 'Inc 1',
              detail: { title: 'Development › Inc 1', lines: ['Mon 5 Oct 2026 – Fri 9 Oct 2026 · 5 working days'] },
            },
            {
              id: 's3', start: '2026-10-12', end: '2026-10-23', label: 'Inc 3',
              detail: { title: 'Development › Inc 3', lines: ['Mon 12 Oct 2026 – Fri 23 Oct 2026 · 10 working days'] },
            },
          ],
        }],
      },
      {
        id: 'dev-lane-1', label: '', kind: 'lane',
        bars: [{
          id: 's2', start: '2026-10-05', end: '2026-10-09', color: '#3b82f6', label: 'Inc 2',
          detail: { title: 'Development › Inc 2', lines: ['Mon 5 Oct 2026 – Fri 9 Oct 2026 · 5 working days'] },
        }],
      },
    ];

    it('draws each segment inside the phase bar, focusable and labelled', () => {
      render(<Gantt rows={detailRows} range={octoberRange} width={1200} />);
      const segment = screen.getByTestId('gantt-segment-s1');
      expect(segment).toHaveAttribute('tabindex', '0');
      expect(segment).toHaveAttribute('aria-label', 'Development › Inc 1, Mon 5 Oct 2026 – Fri 9 Oct 2026 · 5 working days');
      expect(screen.getByText('Inc 1', { selector: '.gantt-bar-label' })).toBeInTheDocument();
      expect(screen.getByTestId('gantt-bar-s2')).toBeInTheDocument();
    });

    it('shows a segment\'s details on hover and hides them on mouse leave', async () => {
      const user = userEvent.setup();
      render(<Gantt rows={detailRows} range={octoberRange} width={1200} />);
      await user.hover(screen.getByTestId('gantt-segment-s1'));
      const card = screen.getByRole('tooltip');
      expect(card).toHaveTextContent('Development › Inc 1');
      expect(card).toHaveTextContent('Mon 5 Oct 2026 – Fri 9 Oct 2026 · 5 working days');
      await user.unhover(screen.getByTestId('gantt-segment-s1'));
      expect(screen.queryByRole('tooltip')).toBeNull();
    });

    it('toggles the details on click or tap on a no-hover (touch) device, and closes them on Escape', async () => {
      stubHover(false);
      const user = userEvent.setup();
      render(<Gantt rows={detailRows} range={octoberRange} width={1200} />);
      const lane = screen.getByTestId('gantt-bar-s2').querySelector('rect')!;
      await user.click(lane);
      expect(screen.getByRole('tooltip')).toHaveTextContent('Development › Inc 2');
      await user.click(lane);
      expect(screen.queryByRole('tooltip')).toBeNull();
      await user.click(lane);
      expect(screen.getByRole('tooltip')).toBeInTheDocument();
      await user.keyboard('{Escape}');
      expect(screen.queryByRole('tooltip')).toBeNull();
    });

    it('on a device that can hover, a click does not hide a hovered card, and hover alone shows and hides it', async () => {
      stubHover(true);
      const user = userEvent.setup();
      render(<Gantt rows={detailRows} range={octoberRange} width={1200} />);
      const lane = screen.getByTestId('gantt-bar-s2').querySelector('rect')!;
      await user.hover(lane);
      expect(screen.getByRole('tooltip')).toHaveTextContent('Development › Inc 2');
      await user.click(lane);
      expect(screen.getByRole('tooltip')).toHaveTextContent('Development › Inc 2');
      await user.unhover(lane);
      expect(screen.queryByRole('tooltip')).toBeNull();
    });

    it('shows the details on focus and hides them on blur', async () => {
      const user = userEvent.setup();
      render(<Gantt rows={detailRows} range={octoberRange} width={1200} />);
      await user.tab();
      expect(screen.getByRole('tooltip')).toHaveTextContent('Development'); // the row's name label
      await user.tab();
      expect(screen.getByRole('tooltip')).toHaveTextContent('Development'); // the bar itself
      await user.tab();
      expect(screen.getByRole('tooltip')).toHaveTextContent('Development › Inc 1');
      await user.tab();
      await user.tab();
      await user.tab();
      expect(screen.queryByRole('tooltip')).toBeNull();
    });

    it('leaves out a segment name that does not fit', () => {
      render(<Gantt rows={detailRows} range={{ start: '2026-01-01', end: '2026-12-31' }} width={500} />);
      expect(screen.getByTestId('gantt-segment-s1')).toBeInTheDocument();
      expect(screen.queryByText('Inc 1', { selector: '.gantt-bar-label' })).toBeNull();
    });

    it("shows the phase's own card from its name label, since segments can cover the whole bar", async () => {
      const user = userEvent.setup();
      render(<Gantt rows={detailRows} range={octoberRange} width={1200} />);
      const label = screen.getByText('Development', { selector: '.gantt-label' });
      expect(label).toHaveAttribute('tabindex', '0');
      await user.hover(label);
      const card = screen.getByRole('tooltip');
      expect(card).toHaveTextContent('Development');
      expect(card).toHaveTextContent('15 working days');
      await user.unhover(label);
      expect(screen.queryByRole('tooltip')).toBeNull();

      // A segment's own card is still reachable directly.
      await user.hover(screen.getByTestId('gantt-segment-s1'));
      expect(screen.getByRole('tooltip')).toHaveTextContent('Development › Inc 1');
    });

    it("gives a lane row's label (there is none) no piece interaction", () => {
      render(<Gantt rows={detailRows} range={octoberRange} width={1200} />);
      const laneRow = screen.getByTestId('gantt-row-dev-lane-1');
      expect(laneRow.querySelector('.gantt-label')).toBeNull();
    });
  });

  describe('weekend-only gaps', () => {
    const gapRow = (s2Start: string): GanttRow[] => [{
      id: 'dev', label: 'Development',
      bars: [{
        id: 'dev', start: '2026-10-05', end: '2026-10-23', color: '#3b82f6',
        segments: [
          { id: 's1', start: '2026-10-05', end: '2026-10-16', label: 'Inc 1' }, // Mon 5 – Fri 16 Oct 2026
          { id: 's2', start: s2Start, end: '2026-10-23', label: 'Inc 2' },
        ],
      }],
    }];

    it('draws no lighter gap element when the gap between segments is only a weekend', () => {
      render(<Gantt rows={gapRow('2026-10-19')} range={octoberRange} width={1200} />); // gap: Sat 17 – Sun 18 Oct
      expect(screen.queryAllByTestId(/^gantt-gap-/)).toHaveLength(0);
    });

    it('draws a lighter gap element when the gap between segments contains a working day', () => {
      render(<Gantt rows={gapRow('2026-10-21')} range={octoberRange} width={1200} />); // gap: Sat 17 – Tue 20 Oct
      expect(screen.queryAllByTestId(/^gantt-gap-/)).toHaveLength(1);
    });
  });

  describe('truncated segment labels', () => {
    it('truncates a segment label with an ellipsis when only part of it fits', () => {
      const narrowRows: GanttRow[] = [{
        id: 'dev', label: 'Development',
        bars: [{
          id: 'dev', start: '2026-01-01', end: '2026-01-02', color: '#3b82f6',
          segments: [
            { id: 's1', start: '2026-01-01', end: '2026-01-01', label: 'Increment 1 – Sign-in and profile' },
            { id: 's2', start: '2026-01-02', end: '2026-01-02', label: 'Increment 2' },
          ],
        }],
      }];
      // 2-day range over a 200px chart: each segment is ~100px wide.
      render(<Gantt rows={narrowRows} range={{ start: '2026-01-01', end: '2026-01-02' }} width={400} />);
      const label = screen.getByText((content) => content.startsWith('Increment 1') && content.endsWith('…'), {
        selector: '.gantt-bar-label',
      });
      expect(label).toBeInTheDocument();
    });

    it('draws no label at all when even a truncated one would not fit', () => {
      const tinyRows: GanttRow[] = [{
        id: 'dev', label: 'Development',
        bars: [{
          id: 'dev', start: '2026-01-01', end: '2026-01-02', color: '#3b82f6',
          segments: [
            { id: 's1', start: '2026-01-01', end: '2026-01-01', label: 'Increment 1 – Sign-in and profile' },
            { id: 's2', start: '2026-01-02', end: '2026-01-02', label: 'Increment 2' },
          ],
        }],
      }];
      // 2-day range over a 40px chart: each segment is ~20px wide, too narrow for even 6 characters.
      render(<Gantt rows={tinyRows} range={{ start: '2026-01-01', end: '2026-01-02' }} width={240} />);
      expect(screen.getByTestId('gantt-segment-s1')).toBeInTheDocument();
      expect(screen.queryByText(/Increment/, { selector: '.gantt-bar-label' })).toBeNull();
    });
  });
});

