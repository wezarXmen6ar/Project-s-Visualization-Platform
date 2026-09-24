// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ItemTable, type DraftItem } from './ItemTable';

function Harness({ initial = [], spy }: { initial?: DraftItem[]; spy?: (items: DraftItem[]) => void }) {
  const [items, setItems] = useState<DraftItem[]>(initial);
  return (
    <ItemTable
      title="Objectives"
      noun="Objective"
      items={items}
      onChange={(next) => {
        spy?.(next);
        setItems(next);
      }}
    />
  );
}

describe('ItemTable', () => {
  it('adds numbered items with the Add button or Enter, ignoring blank text', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    expect(screen.getByText('None yet.')).toBeInTheDocument();

    await user.type(screen.getByLabelText('New objective'), 'Faster checkout');
    await user.click(screen.getByRole('button', { name: 'Add objective' }));
    await user.type(screen.getByLabelText('New objective'), 'Fewer calls{Enter}');
    await user.type(screen.getByLabelText('New objective'), '   {Enter}');

    expect(screen.getByLabelText('Objective 1')).toHaveValue('Faster checkout');
    expect(screen.getByLabelText('Objective 2')).toHaveValue('Fewer calls');
    expect(screen.queryByLabelText('Objective 3')).toBeNull();
    expect(screen.getByText('2.')).toBeInTheDocument();
    expect(screen.getByLabelText('New objective')).toHaveValue('');
  });

  it('edits a row in place, keeping its id, and removes a row', async () => {
    const spy = vi.fn();
    const user = userEvent.setup();
    render(<Harness initial={[{ id: 7, text: 'Old' }, { text: 'Other' }]} spy={spy} />);

    await user.type(screen.getByLabelText('Objective 1'), '!');
    expect(spy).toHaveBeenLastCalledWith([{ id: 7, text: 'Old!' }, { text: 'Other' }]);

    await user.click(screen.getByRole('button', { name: 'Remove objective 1' }));
    expect(screen.getByLabelText('Objective 1')).toHaveValue('Other');
    expect(screen.queryByLabelText('Objective 2')).toBeNull();
  });

  it('reorders rows by dragging the handle or with the arrow keys', () => {
    render(<Harness initial={[{ text: 'A' }, { text: 'B' }, { text: 'C' }]} />);
    const dataTransfer = { setData: () => {}, getData: () => '', effectAllowed: '' };
    const firstRow = screen.getByLabelText('Objective 1').closest('li')!;

    fireEvent.dragStart(screen.getByLabelText('Reorder objective 3'), { dataTransfer });
    fireEvent.dragOver(firstRow, { dataTransfer });
    fireEvent.drop(firstRow, { dataTransfer });
    expect(screen.getByLabelText('Objective 1')).toHaveValue('C');

    fireEvent.keyDown(screen.getByLabelText('Reorder objective 1'), { key: 'ArrowDown' });
    expect(screen.getByLabelText('Objective 1')).toHaveValue('A');
    expect(screen.getByLabelText('Objective 2')).toHaveValue('C');
  });
});
