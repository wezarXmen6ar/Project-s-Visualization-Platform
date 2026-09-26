// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it } from 'vitest';
import type { AttachmentRecord, EntryRecord } from '../../../shared/types';
import { mockFetch, sampleProject } from '../../testing/mockFetch';
import { FocusPage } from './FocusPage';

describe('FocusPage', () => {
  it('shows one project read-only with its phases', async () => {
    mockFetch({
      'GET /api/projects/1': () => ({ body: sampleProject() }),
      'GET /api/settings/calendar': () => ({ body: { weekendDays: [0, 6], holidays: [] } }),
    });
    render(
      <MemoryRouter initialEntries={['/present/projects/1']}>
        <Routes>
          <Route path="/present/projects/:id" element={<FocusPage />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByRole('heading', { name: 'Portal' })).toBeInTheDocument();
    expect(screen.getByTestId('gantt-row-11')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Portfolio/ })).toHaveAttribute('href', '/present?year=2026');
    // A clickable Gantt piece is a "button" (it opens the read-only side panel), but nothing else on the page is.
    expect(screen.getAllByRole('button').every((b) => b.closest('svg.gantt'))).toBe(true);
  });

  it('shows sub-phases inside their phase bar with details on hover, read-only and without names', async () => {
    mockFetch({
      'GET /api/projects/1': () => ({
        body: sampleProject({
          phases: [
            {
              id: 12, name: 'Development', order: 0, durationDays: 10, start: '2026-10-05', end: '2026-10-16',
              subPhases: [
                { id: 21, name: 'Increment 1', order: 0, durationDays: 5, start: '2026-10-05', end: '2026-10-09', withPrevious: false },
                { id: 22, name: 'Increment 2', order: 1, durationDays: 5, start: '2026-10-12', end: '2026-10-16', withPrevious: false },
              ],
            },
          ],
          assignments: [{ id: 300, phaseId: 21, resource: { id: 71, name: 'Fatima Noor' }, allocation: 60, role: 'responsible' }],
        }),
      }),
      'GET /api/settings/calendar': () => ({ body: { weekendDays: [0, 6], holidays: [] } }),
    });
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/present/projects/1']}>
        <Routes>
          <Route path="/present/projects/:id" element={<FocusPage />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByTestId('gantt-row-12')).toBeInTheDocument();
    expect(screen.queryByTestId('gantt-row-21')).toBeNull();

    await user.hover(screen.getByTestId('gantt-segment-21'));
    const card = screen.getByRole('tooltip');
    expect(card).toHaveTextContent('Development › Increment 1');
    expect(card).toHaveTextContent('Mon 5 Oct 2026 – Fri 9 Oct 2026 · 5 working days');
    expect(screen.queryByText(/Fatima Noor/)).toBeNull();
    expect(document.body.textContent).not.toContain('Fatima Noor');

    expect(screen.getAllByRole('button').every((b) => b.closest('svg.gantt'))).toBe(true);
    expect(screen.getAllByRole('link')).toHaveLength(1);
  });

  it('opens a read-only side panel from a bar, with only highlighted entries and their files', async () => {
    const DEV = { id: 12, name: 'Development', phaseName: 'Development', subPhaseName: null };
    const entry = (id: number, title: string, highlight: boolean): EntryRecord => ({
      id, projectId: 1, type: 'meeting', effectiveDate: '2026-09-29', createdAt: '2026-09-29T09:00:00.000Z', title,
      body: ['Line one.', 'Line two.', 'Line three.', 'Line four.'].join('\n'), highlight, phase: DEV,
      attendees: [{ id: 70, name: 'Sara Ahmed' }], guests: [], attachmentIds: [], followUpToDoIds: [800],
    });
    const attachment = (id: number, name: string, entryId: number | null): AttachmentRecord => ({
      id, projectId: 1, phase: entryId === null ? DEV : null, entryId, type: null, name, mime: 'application/pdf', size: 1000,
      documentDate: '2026-09-29', uploadedAt: '2026-09-29T09:00:00.000Z', previewable: true,
    });
    const fetchMock = mockFetch({
      'GET /api/projects/1': () => ({
        body: sampleProject({
          assignments: [{ id: 300, phaseId: 12, resource: { id: 71, name: 'Fatima Noor' }, allocation: 60, role: 'responsible' }],
        }),
      }),
      'GET /api/settings/calendar': () => ({ body: { weekendDays: [0, 6], holidays: [] } }),
      'GET /api/projects/1/entries?phaseId=12': () => ({
        body: [entry(501, 'Steering committee', true), entry(502, 'Internal sync', false)],
      }),
      'GET /api/projects/1/attachments': () => ({
        body: [attachment(701, 'Minutes.pdf', 501), attachment(702, 'Internal notes.pdf', 502), attachment(703, 'Draft.pdf', null)],
      }),
    });
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/present/projects/1']}>
        <Routes>
          <Route path="/present/projects/:id" element={<FocusPage />} />
        </Routes>
      </MemoryRouter>,
    );
    await user.click((await screen.findByTestId('gantt-bar-12')).querySelector('rect.gantt-bar')!);
    const panel = await screen.findByRole('dialog', { name: 'Development' });
    expect(await within(panel).findByText('Steering committee')).toBeInTheDocument();
    expect(within(panel).getByText('Minutes.pdf')).toBeInTheDocument();
    expect(within(panel).queryByText('Internal sync')).toBeNull();
    expect(within(panel).queryByText('Internal notes.pdf')).toBeNull();
    expect(within(panel).queryByText('Draft.pdf')).toBeNull();
    expect(document.body.textContent).not.toContain('Fatima Noor');
    expect(document.body.textContent).not.toContain('Sara Ahmed');
    // No to-dos are ever asked for under /present.
    const requestedUrls = fetchMock.mock.calls.map(([url]) => String(url));
    expect(requestedUrls.some((url) => url.includes('/todos'))).toBe(false);
    // Person documents and accounts (M7 Task 8) are never fetched or shown on the presentation side either.
    expect(requestedUrls.some((url) => url.includes('/documents') || url.includes('/accounts'))).toBe(false);
    expect(document.body.textContent).not.toMatch(/الوثائق|الأحقيات/);
    const buttons = within(panel).getAllByRole('button').map((b) => b.getAttribute('aria-label') ?? b.textContent);
    expect(buttons).toEqual(['Close', 'Preview Minutes.pdf']);
    expect(within(panel).getByRole('link', { name: 'Download Minutes.pdf' })).toBeInTheDocument();
    // Outside the panel, the only "buttons" are the clickable Gantt pieces.
    expect(screen.getAllByRole('button').every((b) => panel.contains(b) || b.closest('svg.gantt'))).toBe(true);
  });
});
