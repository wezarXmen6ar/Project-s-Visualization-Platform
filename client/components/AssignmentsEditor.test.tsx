// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { ResourceRecord } from '../../shared/types';
import type { DraftAssignment } from '../overloads';
import { samplePeople } from '../testing/mockFetch';
import { AssignmentsEditor } from './AssignmentsEditor';

function Harness({ spy, warnings = new Map(), people = samplePeople() }: {
  spy?: (v: DraftAssignment[]) => void; warnings?: Map<number, string[]>; people?: ResourceRecord[];
}) {
  const [value, setValue] = useState<DraftAssignment[]>([]);
  return (
    <AssignmentsEditor
      phaseName="Development"
      dates="5 Oct – 16 Oct"
      people={people}
      value={value}
      onChange={(v) => {
        spy?.(v);
        setValue(v);
      }}
      warnings={warnings}
    />
  );
}

describe('AssignmentsEditor', () => {
  it('adds, edits and removes people on a phase', async () => {
    const spy = vi.fn();
    const user = userEvent.setup();
    render(<Harness spy={spy} />);
    expect(screen.getByText('No one assigned.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Add person to Development' }));
    await user.selectOptions(screen.getByLabelText('Development person 1'), 'Fatima Noor · Developer');
    await user.clear(screen.getByLabelText('Development allocation 1'));
    await user.type(screen.getByLabelText('Development allocation 1'), '60');
    expect(spy).toHaveBeenLastCalledWith([{ resourceId: 71, allocation: 60, role: 'responsible' }]);

    await user.click(screen.getByRole('button', { name: 'Add person to Development' }));
    expect(screen.getByLabelText('Development role 2')).toHaveValue('contributor');
    await user.click(screen.getByRole('button', { name: 'Remove Development person 1' }));
    expect(spy).toHaveBeenLastCalledWith([{ resourceId: null, allocation: 100, role: 'contributor' }]);
  });

  it('offers only active tech-team people', async () => {
    const user = userEvent.setup();
    render(<Harness people={[...samplePeople(), { ...samplePeople()[1], id: 79, name: 'Gone', active: false }]} />);
    await user.click(screen.getByRole('button', { name: 'Add person to Development' }));
    const options = within(screen.getByLabelText('Development person 1')).getAllByRole('option').map((o) => o.textContent);
    expect(options).toEqual(['Choose a person…', 'Fatima Noor · Developer', 'Rami Saleh · Developer', 'Sara Ahmed · Project manager']);
  });

  it("shows a person's overbooking warnings under their row", async () => {
    const user = userEvent.setup();
    render(<Harness warnings={new Map([[71, ['Week of 5 Oct: 150% booked, 100% available']]])} />);
    await user.click(screen.getByRole('button', { name: 'Add person to Development' }));
    expect(screen.queryByText('Week of 5 Oct: 150% booked, 100% available')).toBeNull();
    await user.selectOptions(screen.getByLabelText('Development person 1'), 'Fatima Noor · Developer');
    expect(screen.getByText('Week of 5 Oct: 150% booked, 100% available')).toBeInTheDocument();
  });
});
