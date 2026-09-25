// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it } from 'vitest';
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
    expect(screen.queryByRole('button')).toBeNull();
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

    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getAllByRole('link')).toHaveLength(1);
  });
});
