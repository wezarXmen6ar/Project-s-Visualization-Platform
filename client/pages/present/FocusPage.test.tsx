// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
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

  it('shows sub-phase rows on the Gantt chart, read-only', async () => {
    mockFetch({
      'GET /api/projects/1': () => ({
        body: sampleProject({
          phases: [
            {
              id: 12, name: 'Development', order: 0, durationDays: 8, start: '2026-10-05', end: '2026-10-16',
              subPhases: [
                { id: 21, name: 'Increment 1', order: 0, durationDays: 5, start: '2026-10-05', end: '2026-10-09', withPrevious: false },
              ],
            },
          ],
        }),
      }),
      'GET /api/settings/calendar': () => ({ body: { weekendDays: [0, 6], holidays: [] } }),
    });
    render(
      <MemoryRouter initialEntries={['/present/projects/1']}>
        <Routes>
          <Route path="/present/projects/:id" element={<FocusPage />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByTestId('gantt-row-21')).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getAllByRole('link')).toHaveLength(1);
  });
});
