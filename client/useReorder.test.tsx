// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { moveItem, useReorder } from './useReorder';

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
});
