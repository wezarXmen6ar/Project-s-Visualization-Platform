// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it } from 'vitest';
import { mockFetch, sampleProject } from '../../testing/mockFetch';
import { PortfolioPage } from './PortfolioPage';

const response = (year: number) => ({
  body: {
    year,
    today: '2026-09-24',
    stats: { active: 1, finishedThisYear: 2, startingThisYear: 3 },
    projects: year === 2026 ? [sampleProject()] : [],
  },
});

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/present?year=2026']}>
      <Routes>
        <Route path="/present" element={<PortfolioPage />} />
        <Route path="/present/projects/:id" element={<div>Focus opened</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('PortfolioPage', () => {
  it('shows the stakeholder tiles and one row per project', async () => {
    mockFetch({ 'GET /api/portfolio?year=2026': () => response(2026) });
    renderPage();
    expect(await screen.findByTestId('stat-active')).toHaveTextContent('1');
    expect(screen.getByTestId('stat-finished')).toHaveTextContent('2');
    expect(screen.getByTestId('stat-starting')).toHaveTextContent('3');
    expect(screen.getByText('Finished in 2026')).toBeInTheDocument();
    expect(screen.getByTestId('gantt-row-1')).toBeInTheDocument();
    expect(screen.getByTestId('gantt-today')).toBeInTheDocument();
  });

  it('opens a project in focus when its row is clicked', async () => {
    mockFetch({ 'GET /api/portfolio?year=2026': () => response(2026) });
    renderPage();
    await userEvent.click(await screen.findByTestId('gantt-row-1'));
    expect(await screen.findByText('Focus opened')).toBeInTheDocument();
  });

  it('moves between years', async () => {
    const fetchMock = mockFetch({
      'GET /api/portfolio?year=2026': () => response(2026),
      'GET /api/portfolio?year=2025': () => response(2025),
    });
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Previous year' }));
    expect(await screen.findByText('No projects in 2025.')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith('/api/portfolio?year=2025', expect.anything());
  });
});
