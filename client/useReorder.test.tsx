// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { moveItem, useReorder } from './useReorder';

// jsdom's PointerEvent support is partial (no pointerType on the plain constructor in some versions), so polyfill it.
class TestPointerEvent extends MouseEvent {
  pointerId: number;
  pointerType: string;
  constructor(type: string, init: PointerEventInit & { pointerType?: string; pointerId?: number } = {}) {
    super(type, init);
    this.pointerId = init.pointerId ?? 1;
    this.pointerType = init.pointerType ?? 'mouse';
  }
}
// @ts-expect-error -- test-only polyfill, narrower than the real PointerEvent
window.PointerEvent = TestPointerEvent;

function Harness() {
  const [items, setItems] = useState(['A', 'B', 'C']);
  const { handleProps, rowProps } = useReorder(items.length, (from, to) => setItems((list) => moveItem(list, from, to)));
  return (
    <ul>
      {items.map((item, i) => (
        <li key={i} data-testid={`row-${i}`} {...rowProps(i)}>
          <button {...handleProps(i, `Move ${item}`)}>≡</button>
          {item}
        </li>
      ))}
    </ul>
  );
}

const order = () => screen.getAllByRole('listitem').map((li) => li.textContent?.replace('≡', ''));
const dataTransfer = { setData: () => {}, getData: () => '', effectAllowed: '' };

beforeEach(() => {
  // jsdom has neither.
  Element.prototype.setPointerCapture = vi.fn();
  document.elementFromPoint = vi.fn(() => null);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('moveItem', () => {
  it('moves an item without changing the original list', () => {
    const list = ['A', 'B', 'C'];
    expect(moveItem(list, 0, 2)).toEqual(['B', 'C', 'A']);
    expect(moveItem(list, 2, 0)).toEqual(['C', 'A', 'B']);
    expect(list).toEqual(['A', 'B', 'C']);
  });

  it('returns the same list for a no-op or out-of-range move', () => {
    const list = ['A', 'B'];
    expect(moveItem(list, 0, 0)).toBe(list);
    expect(moveItem(list, 0, 5)).toBe(list);
    expect(moveItem(list, -1, 1)).toBe(list);
  });
});

describe('useReorder', () => {
  it('moves a row dragged by its handle onto another row', () => {
    render(<Harness />);
    fireEvent.dragStart(screen.getByLabelText('Move C'), { dataTransfer });
    fireEvent.dragOver(screen.getByTestId('row-0'), { dataTransfer });
    fireEvent.drop(screen.getByTestId('row-0'), { dataTransfer });
    expect(order()).toEqual(['C', 'A', 'B']);
  });

  it('refuses drops that did not start on one of its handles', () => {
    render(<Harness />);
    const row = screen.getByTestId('row-0');
    // fireEvent returns false only when the handler called preventDefault(), i.e. accepted the drop.
    expect(fireEvent.dragOver(row, { dataTransfer })).toBe(true);
    fireEvent.drop(row, { dataTransfer });
    expect(order()).toEqual(['A', 'B', 'C']);
  });

  it('forgets a cancelled drag', () => {
    render(<Harness />);
    const handle = screen.getByLabelText('Move C');
    fireEvent.dragStart(handle, { dataTransfer });
    fireEvent.dragEnd(handle, { dataTransfer });
    fireEvent.drop(screen.getByTestId('row-0'), { dataTransfer });
    expect(order()).toEqual(['A', 'B', 'C']);
  });

  it('moves with ArrowUp/ArrowDown, keeps focus on the moved row and stops at the ends', () => {
    render(<Harness />);
    const handleB = screen.getByLabelText('Move B');
    handleB.focus();
    fireEvent.keyDown(handleB, { key: 'ArrowDown' });
    expect(order()).toEqual(['A', 'C', 'B']);
    expect(screen.getByLabelText('Move B')).toHaveFocus();

    fireEvent.keyDown(screen.getByLabelText('Move B'), { key: 'ArrowDown' });
    expect(order()).toEqual(['A', 'C', 'B']);
    fireEvent.keyDown(screen.getByLabelText('Move A'), { key: 'ArrowUp' });
    expect(order()).toEqual(['A', 'C', 'B']);
  });

  it('includes data-reorder-index on every row', () => {
    render(<Harness />);
    expect(screen.getByTestId('row-0')).toHaveAttribute('data-reorder-index', '0');
    expect(screen.getByTestId('row-1')).toHaveAttribute('data-reorder-index', '1');
    expect(screen.getByTestId('row-2')).toHaveAttribute('data-reorder-index', '2');
  });

  it('moves item 1 to position 3 by dragging its handle with a finger', () => {
    render(<Harness />);
    const row3 = screen.getByTestId('row-2');
    (document.elementFromPoint as ReturnType<typeof vi.fn>).mockReturnValue(row3);
    const handleA = screen.getByLabelText('Move A');

    fireEvent.pointerDown(handleA, { pointerType: 'touch', clientX: 0, clientY: 10 });
    fireEvent.pointerMove(handleA, { pointerType: 'touch', clientX: 0, clientY: 90 });

    // While dragging, the dragged row and the row it would land on are both marked.
    expect(screen.getByTestId('row-0')).toHaveClass('dragging');
    expect(row3).toHaveClass('drop-target', 'drop-after');

    fireEvent.pointerUp(handleA, { pointerType: 'touch', clientX: 0, clientY: 90 });

    expect(order()).toEqual(['B', 'C', 'A']);
    expect(screen.getByTestId('row-0')).not.toHaveClass('dragging');
    expect(screen.queryByTestId('row-2')?.className).not.toMatch(/drop-target/);
  });

  it('ignores mouse pointer events (only touch and pen drive pointer-based dragging)', () => {
    render(<Harness />);
    const row3 = screen.getByTestId('row-2');
    (document.elementFromPoint as ReturnType<typeof vi.fn>).mockReturnValue(row3);
    const handleA = screen.getByLabelText('Move A');

    fireEvent.pointerDown(handleA, { pointerType: 'mouse', clientX: 0, clientY: 10 });
    fireEvent.pointerMove(handleA, { pointerType: 'mouse', clientX: 0, clientY: 90 });
    fireEvent.pointerUp(handleA, { pointerType: 'mouse', clientX: 0, clientY: 90 });

    expect(order()).toEqual(['A', 'B', 'C']);
  });
});
