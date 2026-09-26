// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import type { ResourceRecord, Side } from '../../shared/types';
import { mockFetch, samplePeople } from '../testing/mockFetch';
import { PersonPicker } from './PersonPicker';

const inactive: ResourceRecord = {
  id: 81, name: 'Old Contact', side: 'business', employment: 'staff', role: null, specialisation: null, email: null, phone: null,
  capacity: 100, active: false, leave: [], projects: [], company: null, engagementProject: null, engagementStart: null,
  engagementEnd: null, engagement: null,
};

const outsourced: ResourceRecord = {
  id: 90, name: 'Omar Farid', side: 'tech', employment: 'outsourced', role: null, specialisation: null, email: null, phone: null,
  capacity: 100, active: true, leave: [], projects: [], company: { id: 200, name: 'TechNova' }, engagementProject: null,
  engagementStart: null, engagementEnd: null, engagement: 'engaged',
};

function Harness({
  side, label, initial = null, roleId, staffOnly = false, extra = [],
}: {
  side: Side; label: string; initial?: number | null; roleId?: number; staffOnly?: boolean; extra?: ResourceRecord[];
}) {
  const [people, setPeople] = useState<ResourceRecord[]>([...samplePeople(), inactive, ...extra]);
  const [value, setValue] = useState<number | null>(initial);
  return (
    <PersonPicker
      label={label}
      side={side}
      people={people}
      value={value}
      onChange={setValue}
      onAdded={(p) => setPeople((list) => [...list, p])}
      noneLabel="Not set"
      newPersonRoleId={roleId}
      staffOnly={staffOnly}
    />
  );
}

const optionNames = (label: string) =>
  within(screen.getByLabelText(label)).getAllByRole('option').map((o) => o.textContent);

describe('PersonPicker', () => {
  it("offers only this side's active people, sorted by name", () => {
    render(<Harness side="tech" label="Project manager (tech)" />);
    expect(optionNames('Project manager (tech)')).toEqual(['Not set', 'Fatima Noor', 'Rami Saleh', 'Sara Ahmed', '+ Add new person…']);
  });

  it('keeps showing a chosen person who has since been made inactive', () => {
    render(<Harness side="business" label="Business project manager" initial={81} />);
    expect(screen.getByLabelText('Business project manager')).toHaveDisplayValue('Old Contact (inactive)');
    expect(optionNames('Business project manager')).toEqual([
      'Not set', 'Mariam Al Suwaidi', 'Old Contact (inactive)', '+ Add new person…',
    ]);
  });

  it('adds a business contact with phone and email, then selects them', async () => {
    const fetchMock = mockFetch({
      'POST /api/resources': () => ({
        status: 201,
        body: {
          id: 82, name: 'Noura Al Hammadi', side: 'business', role: null, specialisation: null,
          email: 'noura@example.com', phone: '+971 55 234 5678', capacity: 100, active: true, leave: [],
        },
      }),
    });
    const user = userEvent.setup();
    render(<Harness side="business" label="Business project manager" />);

    await user.selectOptions(screen.getByLabelText('Business project manager'), '+ Add new person…');
    await user.type(screen.getByLabelText('New business project manager'), 'Noura Al Hammadi');
    await user.type(screen.getByLabelText('Business project manager phone (UAE mobile)'), '055 234 5678');
    await user.type(screen.getByLabelText('Business project manager email'), 'noura@example.com');
    await user.click(screen.getByRole('button', { name: 'Add' }));

    expect(await screen.findByRole('option', { name: 'Noura Al Hammadi' })).toBeInTheDocument();
    expect(screen.getByLabelText('Business project manager')).toHaveValue('82');
    const [, init] = fetchMock.mock.calls[0];
    expect(JSON.parse(init?.body as string)).toEqual({
      name: 'Noura Al Hammadi', side: 'business', roleId: null, phone: '055 234 5678', email: 'noura@example.com',
    });
  });

  it("shows the server's messages, and Cancel goes back to the list", async () => {
    mockFetch({
      'POST /api/resources': () => ({
        status: 400,
        body: { error: 'Invalid person', issues: [{ path: 'phone', message: 'Enter a UAE mobile number, e.g. +971 50 123 4567' }] },
      }),
    });
    const user = userEvent.setup();
    render(<Harness side="business" label="Business project manager" />);
    await user.selectOptions(screen.getByLabelText('Business project manager'), '+ Add new person…');
    await user.type(screen.getByLabelText('New business project manager'), 'Noura');
    await user.type(screen.getByLabelText('Business project manager phone (UAE mobile)'), '04 123 4567');
    await user.click(screen.getByRole('button', { name: 'Add' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Enter a UAE mobile number, e.g. +971 50 123 4567');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByLabelText('Business project manager')).toHaveValue('');
  });

  it('excludes outsourced people when staffOnly (e.g. the project manager, who must be on our own team)', () => {
    render(<Harness side="tech" label="Project manager (tech)" staffOnly extra={[outsourced]} />);
    expect(optionNames('Project manager (tech)')).toEqual(['Not set', 'Fatima Noor', 'Rami Saleh', 'Sara Ahmed', '+ Add new person…']);
  });

  it('offers outsourced people when staffOnly is not set', () => {
    render(<Harness side="tech" label="Development person 1" extra={[outsourced]} />);
    expect(optionNames('Development person 1')).toEqual([
      'Not set', 'Fatima Noor', 'Omar Farid', 'Rami Saleh', 'Sara Ahmed', '+ Add new person…',
    ]);
  });

  it('gives a tech person added here the given role, and asks for no phone or email', async () => {
    const fetchMock = mockFetch({
      'POST /api/resources': () => ({
        status: 201,
        body: {
          id: 73, name: 'Omar Haddad', side: 'tech', role: { id: 60, name: 'Project manager' }, specialisation: null,
          email: null, phone: null, capacity: 100, active: true, leave: [],
        },
      }),
    });
    const user = userEvent.setup();
    render(<Harness side="tech" label="Project manager (tech)" roleId={60} />);
    await user.selectOptions(screen.getByLabelText('Project manager (tech)'), '+ Add new person…');
    expect(screen.queryByLabelText('Project manager (tech) phone (UAE mobile)')).toBeNull();
    await user.type(screen.getByLabelText('New project manager (tech)'), 'Omar Haddad{Enter}');
    expect(await screen.findByRole('option', { name: 'Omar Haddad' })).toBeInTheDocument();
    const [, init] = fetchMock.mock.calls[0];
    expect(JSON.parse(init?.body as string)).toEqual({ name: 'Omar Haddad', side: 'tech', roleId: 60, phone: '', email: '' });
  });
});
