// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { ListValue, PersonAccountRecord } from '../../../shared/types';
import { formatDate } from '../../i18n/format';
import { mockFetch, type MockHandler } from '../../testing/mockFetch';
import { PersonAccounts } from './PersonAccounts';

const TODAY = formatDate('en', '2026-09-26');
const OLD_EXPIRY = formatDate('en', '2026-11-01');

const TYPES: ListValue[] = [
  { id: 310, list: 'accountType', name: 'Network account', nameAr: 'أحقية الشبكة', order: 0 },
];

function account(overrides: Partial<PersonAccountRecord> & Pick<PersonAccountRecord, 'id'>): PersonAccountRecord {
  return {
    resourceId: 71, personName: 'Fatima Noor', type: { id: 310, name: 'Network account', nameAr: 'أحقية الشبكة' },
    expiryDate: '2026-11-01', remindDays: 30, note: null, createdAt: '2026-09-01T09:00:00.000Z', state: 'soon',
    ...overrides,
  };
}

function routes(accounts: PersonAccountRecord[]): Record<string, MockHandler> {
  return { 'GET /api/resources/71/accounts': () => ({ body: accounts }) };
}

describe('PersonAccounts — Renewed', () => {
  it('sends the new expiry and a note that keeps the previous note, adding the renewal line with today\'s date', async () => {
    const existing = account({ id: 9, note: 'Shared with the ops team.', expiryDate: '2026-11-01' });
    let putBody: unknown;
    const fetchMock = mockFetch({
      ...routes([existing]),
      'PUT /api/person-accounts/9': (init) => {
        putBody = JSON.parse(String(init?.body));
        return { body: { ...existing, expiryDate: '2027-01-01', note: (putBody as { note: string }).note } };
      },
    });
    const user = userEvent.setup();
    render(<PersonAccounts resourceId={71} accountTypes={TYPES} today="2026-09-26" />);

    await screen.findByText('Network account');
    await user.click(screen.getAllByRole('button', { name: 'Renewed' })[0]);
    const renewForm = screen.getByLabelText('New expiry date').closest('div') as HTMLElement;
    await user.type(within(renewForm).getByLabelText('New expiry date'), '2027-01-01');
    await user.click(within(renewForm).getByRole('button', { name: 'Renewed' }));

    expect(fetchMock.mock.calls.some(([url]) => url === '/api/person-accounts/9')).toBe(true);
    expect(putBody).toMatchObject({ expiryDate: '2027-01-01', remindDays: 30 });
    const note = (putBody as { note: string }).note;
    expect(note).toContain('Shared with the ops team.');
    expect(note).toContain(`Renewed on ${TODAY}; the expiry was ${OLD_EXPIRY}`);
  });

  it('starts the note fresh (no leading blank line) when the account had none yet', async () => {
    const existing = account({ id: 10, note: null, expiryDate: '2026-11-01' });
    let putBody: unknown;
    mockFetch({
      ...routes([existing]),
      'PUT /api/person-accounts/10': (init) => {
        putBody = JSON.parse(String(init?.body));
        return { body: { ...existing, expiryDate: '2027-02-01', note: (putBody as { note: string }).note } };
      },
    });
    const user = userEvent.setup();
    render(<PersonAccounts resourceId={71} accountTypes={TYPES} today="2026-09-26" />);

    await screen.findByText('Network account');
    await user.click(screen.getAllByRole('button', { name: 'Renewed' })[0]);
    const renewForm = screen.getByLabelText('New expiry date').closest('div') as HTMLElement;
    await user.type(within(renewForm).getByLabelText('New expiry date'), '2027-02-01');
    await user.click(within(renewForm).getByRole('button', { name: 'Renewed' }));

    const note = (putBody as { note: string }).note;
    expect(note).toBe(`Renewed on ${TODAY}; the expiry was ${OLD_EXPIRY}`);
  });
});
