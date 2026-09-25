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
          <input aria-label={`${item} text`} defaultValue={item} />
        </li>
      ))}
    </ul>
  );
}

/** A list whose row 0 contains an entirely separate, independent list — the strictest nesting case for `closest()`. */
function NestedHarness() {
  const [outer, setOuter] = useState(['X', 'Y']);
  const [inner, setInner] = useState(['P', 'Q', 'R']);
  const { handleProps: outerHandle, rowProps: outerRow } = useReorder(outer.length, (from, to) => setOuter((l) => moveItem(l, from, to)));
  const { handleProps: innerHandle, rowProps: innerRow } = useReorder(inner.length, (from, to) => setInner((l) => moveItem(l, from, to)));
  return (
    <ul data-testid="outer">
      {outer.map((item, i) => (
        <li key={i} data-testid={`outer-row-${i}`} {...outerRow(i)}>
          <button {...outerHandle(i, `Outer ${item}`)}>≡</button>
          {item}
          {i === 0 && (
            <ul data-testid="inner">
              {inner.map((it, j) => (
                <li key={j} data-testid={`inner-row-${j}`} {...innerRow(j)}>
                  <button {...innerHandle(j, `Inner ${it}`)}>≡</button>
                  {it}
                </li>
              ))}
            </ul>
          )}
        </li>
      ))}
    </ul>
  );
}
const innerOrder = () => [0, 1, 2].map((j) => screen.getByTestId(`inner-row-${j}`).textContent?.replace('≡', ''));

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

  it('still drops a mouse drag after the browser fires its mouse pointercancel at drag start', () => {
    // Chrome cancels the mouse pointer as soon as a native drag begins; that must not forget the drag.
    render(<Harness />);
    const handle = screen.getByLabelText('Move A');
    fireEvent.dragStart(handle, { dataTransfer });
    handle.dispatchEvent(new TestPointerEvent('pointercancel', { bubbles: true, pointerType: 'mouse' }));
    fireEvent.dragOver(screen.getByTestId('row-2'), { dataTransfer });
    fireEvent.drop(screen.getByTestId('row-2'), { dataTransfer });
    expect(order()).toEqual(['B', 'C', 'A']);
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
    const row0 = screen.getByTestId('row-0');
    const row3 = screen.getByTestId('row-2');
    (document.elementFromPoint as ReturnType<typeof vi.fn>).mockReturnValue(row3);
    const handleA = screen.getByLabelText('Move A');

    fireEvent.pointerDown(handleA, { pointerType: 'mouse', clientX: 0, clientY: 10 });
    fireEvent.pointerMove(handleA, { pointerType: 'mouse', clientX: 0, clientY: 90 });
    fireEvent.pointerUp(handleA, { pointerType: 'mouse', clientX: 0, clientY: 90 });

    expect(order()).toEqual(['A', 'B', 'C']);
    expect(row0.className).not.toMatch(/dragging|drop-target/);
    expect(row3.className).not.toMatch(/dragging|drop-target/);
  });

  it('drops after a dragover, even with a dragleave to another row in between', () => {
    render(<Harness />);
    const row0 = screen.getByTestId('row-0');
    const row2 = screen.getByTestId('row-2');

    fireEvent.dragStart(screen.getByLabelText('Move A'), { dataTransfer });
    fireEvent.dragOver(row2, { dataTransfer });
    expect(row2).toHaveClass('drop-target', 'drop-after');

    // The pointer passes over another row (or leaves the list entirely) before settling on the drop target.
    fireEvent.dragLeave(row2, { dataTransfer, relatedTarget: document.body });
    expect(row2.className).not.toMatch(/drop-target/);

    fireEvent.dragOver(row2, { dataTransfer });
    fireEvent.drop(row2, { dataTransfer });

    expect(order()).toEqual(['B', 'C', 'A']);
    expect(row0.className).not.toMatch(/dragging/);
  });

  it('does not clear the drop target on a dragleave into a child element of the same row', () => {
    render(<Harness />);
    const row2 = screen.getByTestId('row-2');
    const childInput = screen.getByLabelText('C text');

    fireEvent.dragStart(screen.getByLabelText('Move A'), { dataTransfer });
    fireEvent.dragOver(row2, { dataTransfer });
    expect(row2).toHaveClass('drop-target');

    // jsdom's fireEvent.dragLeave doesn't apply `relatedTarget` from its init dict, so build the event by hand.
    const leaveIntoChild = new Event('dragleave', { bubbles: true, cancelable: true });
    Object.defineProperty(leaveIntoChild, 'relatedTarget', { value: childInput });
    fireEvent(row2, leaveIntoChild);
    expect(row2).toHaveClass('drop-target');
  });

  it('drops on release using the last row seen while dragging, even if the release point itself resolves to nothing', () => {
    render(<Harness />);
    const row2 = screen.getByTestId('row-2');
    const elementFromPoint = document.elementFromPoint as ReturnType<typeof vi.fn>;
    elementFromPoint.mockReturnValue(row2);
    const handleA = screen.getByLabelText('Move A');

    fireEvent.pointerDown(handleA, { pointerType: 'touch', clientX: 0, clientY: 10 });
    fireEvent.pointerMove(handleA, { pointerType: 'touch', clientX: 0, clientY: 90 });

    // The finger has lifted: a real release position can miss every row.
    elementFromPoint.mockReturnValue(null);
    fireEvent.pointerUp(handleA, { pointerType: 'touch', clientX: 999, clientY: 999 });

    expect(order()).toEqual(['B', 'C', 'A']);
  });

  it('finds the row under a touch point even when elementFromPoint returns one of its children', () => {
    render(<Harness />);
    const row2 = screen.getByTestId('row-2');
    const childInput = screen.getByLabelText('C text');
    (document.elementFromPoint as ReturnType<typeof vi.fn>).mockReturnValue(childInput);
    const handleA = screen.getByLabelText('Move A');

    fireEvent.pointerDown(handleA, { pointerType: 'touch', clientX: 0, clientY: 10 });
    fireEvent.pointerMove(handleA, { pointerType: 'touch', clientX: 0, clientY: 90 });
    expect(row2).toHaveClass('drop-target');
    fireEvent.pointerUp(handleA, { pointerType: 'touch', clientX: 0, clientY: 90 });

    expect(order()).toEqual(['B', 'C', 'A']);
  });

  it('never moves or shows classes when elementFromPoint finds nothing', () => {
    render(<Harness />);
    const row0 = screen.getByTestId('row-0');
    const handleA = screen.getByLabelText('Move A');
    // beforeEach already stubs elementFromPoint to return null.

    fireEvent.pointerDown(handleA, { pointerType: 'touch', clientX: 0, clientY: 10 });
    fireEvent.pointerMove(handleA, { pointerType: 'touch', clientX: 0, clientY: 90 });
    expect(row0).toHaveClass('dragging');
    screen.getAllByRole('listitem').forEach((li) => expect(li.className).not.toMatch(/drop-target/));

    fireEvent.pointerUp(handleA, { pointerType: 'touch', clientX: 0, clientY: 90 });
    expect(order()).toEqual(['A', 'B', 'C']);
  });

  it("only accepts a touch drop from its own list's rows, not another list's", () => {
    render(<NestedHarness />);
    const outerRow1 = screen.getByTestId('outer-row-1');
    (document.elementFromPoint as ReturnType<typeof vi.fn>).mockReturnValue(outerRow1);
    const innerHandleP = screen.getByLabelText('Inner P');

    fireEvent.pointerDown(innerHandleP, { pointerType: 'touch', clientX: 0, clientY: 10 });
    fireEvent.pointerMove(innerHandleP, { pointerType: 'touch', clientX: 0, clientY: 90 });
    fireEvent.pointerUp(innerHandleP, { pointerType: 'touch', clientX: 0, clientY: 90 });

    expect(innerOrder()).toEqual(['P', 'Q', 'R']);
  });

  it('reorders a list nested inside another list’s row by touch, without disturbing the outer list', () => {
    render(<NestedHarness />);
    const innerRow2 = screen.getByTestId('inner-row-2');
    (document.elementFromPoint as ReturnType<typeof vi.fn>).mockReturnValue(innerRow2);
    const innerHandleP = screen.getByLabelText('Inner P');

    fireEvent.pointerDown(innerHandleP, { pointerType: 'touch', clientX: 0, clientY: 10 });
    fireEvent.pointerMove(innerHandleP, { pointerType: 'touch', clientX: 0, clientY: 90 });
    expect(screen.getByTestId('inner-row-0')).toHaveClass('dragging');
    expect(innerRow2).toHaveClass('drop-target', 'drop-after');

    fireEvent.pointerUp(innerHandleP, { pointerType: 'touch', clientX: 0, clientY: 90 });

    expect(innerOrder()).toEqual(['Q', 'R', 'P']);
    expect(screen.getByTestId('outer-row-0').textContent).toContain('X');
    expect(screen.getByTestId('outer-row-1').textContent).toContain('Y');
  });
});
