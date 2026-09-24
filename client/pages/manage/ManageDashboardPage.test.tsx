// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it } from 'vitest';
import { mockFetch, sampleProject } from '../../testing/mockFetch';
import { ManageDashboardPage } from './ManageDashboardPage';

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/manage']}>
      <Routes>
        <Route path="/manage" element={<ManageDashboardPage />} />
        <Route path="/manage/projects/:id" element={<div>Project opened</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ManageDashboardPage', () => {
  it('lists projects with links and dates', async () => {
    mockFetch({ 'GET /api/projects': () => ({ body: [sampleProject()] }) });
    renderPage();
    expect(await screen.findByRole('link', { name: 'Portal' })).toHaveAttribute('href', '/manage/projects/1');
    expect(screen.getByText('PRJ-1')).toBeInTheDocument();
    expect(screen.getByText('2026-09-30')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'New project' })).toHaveAttribute('href', '/manage/projects/new');
  });

  it('opens a project from the chart', async () => {
    mockFetch({ 'GET /api/projects': () => ({ body: [sampleProject()] }) });
    renderPage();
    await userEvent.click(await screen.findByTestId('gantt-row-1'));
    expect(await screen.findByText('Project opened')).toBeInTheDocument();
  });

  it('shows an empty state', async () => {
    mockFetch({ 'GET /api/projects': () => ({ body: [] }) });
    renderPage();
    expect(await screen.findByText(/No projects yet/)).toBeInTheDocument();
  });
});
