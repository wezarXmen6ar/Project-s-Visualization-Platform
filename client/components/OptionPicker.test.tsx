// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { ListValue } from '../../shared/types';
import { mockFetch, sampleLists } from '../testing/mockFetch';
import { OptionPicker } from './OptionPicker';

function Harness({ onChange }: { onChange?: (id: number | null) => void }) {
  const [options, setOptions] = useState<ListValue[]>(sampleLists().department);
  const [value, setValue] = useState<number | null>(null);
  return (
    <OptionPicker
      label="Business user (department)"
      list="department"
      options={options}
      value={value}
      onChange={(id) => {
        onChange?.(id);
        setValue(id);
      }}
      onAdded={(v) => setOptions((list) => [...list, v])}
      noneLabel="Not set"
      addLabel="+ Add new department…"
    />
  );
}

describe('OptionPicker', () => {
  it('reports the chosen value, and null for the empty choice', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<Harness onChange={onChange} />);
    const select = screen.getByLabelText('Business user (department)');

    await user.selectOptions(select, 'Finance');
    expect(onChange).toHaveBeenLastCalledWith(30);
    await user.selectOptions(select, 'Not set');
    expect(onChange).toHaveBeenLastCalledWith(null);
  });

  it('adds a new value inline and selects it', async () => {
    const fetchMock = mockFetch({
      'POST /api/lists/department': () => ({ status: 201, body: { id: 31, list: 'department', name: 'Legal', order: 1 } }),
    });
    const user = userEvent.setup();
    render(<Harness />);

    await user.selectOptions(screen.getByLabelText('Business user (department)'), '+ Add new department…');
    await user.type(screen.getByLabelText('New business user (department)'), 'Legal');
    await user.click(screen.getByRole('button', { name: 'Add' }));

    expect(await screen.findByRole('option', { name: 'Legal' })).toBeInTheDocument();
    expect(screen.getByLabelText('Business user (department)')).toHaveValue('31');
    const [, init] = fetchMock.mock.calls[0];
    expect(JSON.parse(init?.body as string)).toEqual({ name: 'Legal' });
  });

  it('shows a server error, and Cancel goes back without changing the value', async () => {
    mockFetch({ 'POST /api/lists/department': () => ({ status: 400, body: { error: 'Invalid value' } }) });
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<Harness onChange={onChange} />);

    await user.selectOptions(screen.getByLabelText('Business user (department)'), '+ Add new department…');
    await user.type(screen.getByLabelText('New business user (department)'), 'X');
    await user.click(screen.getByRole('button', { name: 'Add' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid value');

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByLabelText('Business user (department)')).toHaveValue('');
    expect(onChange).not.toHaveBeenCalled();
  });
});
