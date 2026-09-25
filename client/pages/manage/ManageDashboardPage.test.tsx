// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mockFetch, overbookedWorkload, sampleProject, sampleWorkload } from '../../testing/mockFetch';
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

afterEach(() => {
  vi.useRealTimers();
});

describe('ManageDashboardPage', () => {
  it('lists projects with links and dates', async () => {
    mockFetch({ 'GET /api/projects': () => ({ body: [sampleProject()] }), 'GET /api/workload': () => ({ body: sampleWorkload() }) });
    renderPage();
    expect(await screen.findByRole('link', { name: 'Portal' })).toHaveAttribute('href', '/manage/projects/1');
    expect(screen.getByText('PRJ-1')).toBeInTheDocument();
    expect(screen.getByText('2026-09-30')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'New project' })).toHaveAttribute('href', '/manage/projects/new');
    expect(screen.getByRole('link', { name: 'Settings' })).toHaveAttribute('href', '/manage/settings');
    expect(screen.getByRole('link', { name: 'Resources' })).toHaveAttribute('href', '/manage/resources');
  });

  it('opens a project from the chart', async () => {
    mockFetch({ 'GET /api/projects': () => ({ body: [sampleProject()] }), 'GET /api/workload': () => ({ body: sampleWorkload() }) });
    renderPage();
    await userEvent.click(await screen.findByTestId('gantt-row-1'));
    expect(await screen.findByText('Project opened')).toBeInTheDocument();
  });

  it('shows an empty state', async () => {
    mockFetch({ 'GET /api/projects': () => ({ body: [] }), 'GET /api/workload': () => ({ body: sampleWorkload() }) });
    renderPage();
    expect(await screen.findByText(/No projects yet/)).toBeInTheDocument();
  });

  it('warns when someone is overbooked in the next four weeks', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-01T09:00:00'));
    mockFetch({
      'GET /api/projects': () => ({ body: [sampleProject()] }),
      'GET /api/workload': () => ({ body: overbookedWorkload() }),
    });
    renderPage();
    expect(await screen.findByRole('status')).toHaveTextContent('Fatima Noor is overbooked in the next 4 weeks.');
    expect(screen.getByRole('link', { name: 'See the workload' })).toHaveAttribute('href', '/manage/resources');
  });

  it('stays quiet when the only overbooking has been accepted', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-01T09:00:00'));
    const accepted = overbookedWorkload();
    accepted.decisions.push({ id: 1, resourceId: 71, weekStart: '2026-10-05', decision: 'accept', note: null, date: '2026-10-01' });
    mockFetch({
      'GET /api/projects': () => ({ body: [sampleProject()] }),
      'GET /api/workload': () => ({ body: accepted }),
    });
    renderPage();
    expect(await screen.findByRole('link', { name: 'Portal' })).toBeInTheDocument();
    expect(screen.queryByRole('status')).toBeNull();
  });
});
