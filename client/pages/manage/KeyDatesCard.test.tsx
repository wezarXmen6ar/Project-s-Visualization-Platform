// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { KeyDateRecord, ListValue } from '../../../shared/types';
import { LanguageProvider } from '../../i18n/LanguageProvider';
import { mockFetch, type MockHandler } from '../../testing/mockFetch';
import { KeyDatesCard } from './KeyDatesCard';

afterEach(() => {
  vi.unstubAllGlobals();
});

const TYPES: ListValue[] = [
  { id: 320, list: 'keyDateType', name: 'Contract end', nameAr: 'انتهاء العقد', order: 0 },
  { id: 321, list: 'keyDateType', name: 'License expiry', nameAr: 'انتهاء الترخيص', order: 1 },
];

function keyDate(overrides: Partial<KeyDateRecord> & Pick<KeyDateRecord, 'id'>): KeyDateRecord {
  return {
    projectId: 1, type: { id: 320, name: 'Contract end', nameAr: 'انتهاء العقد' }, date: '2026-12-01', note: null,
    attachment: null, createdAt: '2026-09-20T09:00:00.000Z', state: 'fine',
    ...overrides,
  };
}

function routes(keyDates: KeyDateRecord[]): Record<string, MockHandler> {
  return { 'GET /api/projects/1/key-dates': () => ({ body: keyDates }) };
}

describe('KeyDatesCard', () => {
  it('shows a passed date in red and a soon one in amber, with the day counts', async () => {
    mockFetch(routes([
      keyDate({ id: 1, type: { id: 320, name: 'Contract end', nameAr: 'انتهاء العقد' }, date: '2026-09-19', state: 'expired' }),
      keyDate({ id: 2, type: { id: 321, name: 'License expiry', nameAr: 'انتهاء الترخيص' }, date: '2026-10-19', state: 'soon' }),
    ]));
    render(<KeyDatesCard projectId={1} keyDateTypes={TYPES} today="2026-10-07" />);

    const passedText = await screen.findByText('passed 18 days ago');
    expect(passedText).toHaveClass('expiry-expired');

    const soonText = await screen.findByText('in 12 days');
    expect(soonText).toHaveClass('expiry-soon');
  });

  it('shows the Arabic plural for a soon key date', async () => {
    mockFetch(routes([keyDate({ id: 2, type: { id: 321, name: 'License expiry', nameAr: 'انتهاء الترخيص' }, date: '2026-10-19', state: 'soon' })]));
    render(
      <LanguageProvider lang="ar">
        <KeyDatesCard projectId={1} keyDateTypes={TYPES} today="2026-10-07" />
      </LanguageProvider>,
    );
    expect(await screen.findByText('خلال 12 يوماً')).toBeInTheDocument();
    expect(screen.getByText('انتهاء الترخيص')).toBeInTheDocument();
  });

  it('shows the note and the linked file with Preview and Download', async () => {
    mockFetch(routes([
      keyDate({
        id: 1, date: '2026-12-01', note: 'Renew before this date',
        attachment: { id: 400, name: 'contract.pdf', mime: 'application/pdf', previewable: true },
      }),
    ]));
    render(<KeyDatesCard projectId={1} keyDateTypes={TYPES} today="2026-10-07" />);
    await screen.findByText('Renew before this date');
    expect(screen.getByRole('button', { name: 'Preview contract.pdf' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Download contract.pdf' })).toHaveAttribute('href', '/api/attachments/400/file');
  });

  it('shows "No key dates yet." with none, and adds one with the form', async () => {
    let saved: KeyDateRecord[] = [];
    mockFetch({
      'GET /api/projects/1/key-dates': () => ({ body: saved }),
      'POST /api/projects/1/key-dates': (init) => {
        const body = JSON.parse(init!.body as string) as { typeId?: number; date: string; note?: string };
        const created = keyDate({
          id: 2, type: body.typeId ? { id: body.typeId, name: 'License expiry', nameAr: 'انتهاء الترخيص' } : null,
          date: body.date, note: body.note ?? null, state: 'fine',
        });
        saved = [created];
        return { status: 201, body: created };
      },
    });
    const user = userEvent.setup();
    render(<KeyDatesCard projectId={1} keyDateTypes={TYPES} today="2026-10-07" />);
    expect(await screen.findByText('No key dates yet.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Add key date' }));
    await user.selectOptions(screen.getByLabelText('Type'), 'License expiry');
    await user.type(screen.getByLabelText('Date'), '2027-01-15');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await screen.findByText('License expiry');
  });

  it('deletes a key date after confirming', async () => {
    let items = [keyDate({ id: 1 })];
    mockFetch({
      'GET /api/projects/1/key-dates': () => ({ body: items }),
      'DELETE /api/key-dates/1': () => {
        items = [];
        return { status: 204, body: null };
      },
    });
    const user = userEvent.setup();
    render(<KeyDatesCard projectId={1} keyDateTypes={TYPES} today="2026-10-07" />);
    await screen.findByText('Contract end');
    await user.click(screen.getByRole('button', { name: 'Delete key date Contract end' }));
    await screen.findByText('Delete this key date?');
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(await screen.findByText('No key dates yet.')).toBeInTheDocument();
  });
});
