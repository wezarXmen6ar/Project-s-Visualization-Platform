// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it } from 'vitest';
import { mockFetch, sampleProject } from '../../testing/mockFetch';
import { ProjectPage } from './ProjectPage';

function renderAt(url: string) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/manage/projects/:id" element={<ProjectPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ProjectPage', () => {
  it('shows the project header, Gantt chart and phase table', async () => {
    mockFetch({
      'GET /api/projects/1': () => ({ body: sampleProject() }),
      'GET /api/settings/calendar': () => ({ body: { weekendDays: [0, 6], holidays: [] } }),
    });
    renderAt('/manage/projects/1');
    expect(await screen.findByRole('heading', { name: 'Portal' })).toBeInTheDocument();
    expect(screen.getByText(/2026-09-24 → 2026-09-30/)).toBeInTheDocument();
    expect(screen.getByTestId('gantt-row-12')).toBeInTheDocument();
    const table = screen.getByRole('table');
    expect(within(table).getByText('Development')).toBeInTheDocument();
    expect(within(table).getByText('3')).toBeInTheDocument();
  });

  it('shows the classification, description and scope, with a link to edit', async () => {
    mockFetch({
      'GET /api/projects/1': () => ({
        body: sampleProject({
          priority: 'high',
          projectManager: 'Sara Ahmed',
          mainProject: { id: 20, name: 'Digital Services' },
          category: 'strategic',
          department: { id: 30, name: 'Finance' },
          requester: { internal: true, external: true },
          beneficiary: { employees: false, customers: true },
          background: 'The portal is slow.',
          scopeItems: [
            { id: 6, kind: 'objective', text: 'Faster checkout', order: 0, dateAdded: '2026-09-24' },
            { id: 5, kind: 'scope', text: 'Online payments', order: 0, dateAdded: '2026-09-24' },
          ],
        }),
      }),
      'GET /api/settings/calendar': () => ({ body: { weekendDays: [0, 6], holidays: [] } }),
    });
    renderAt('/manage/projects/1');
    expect(await screen.findByText('Digital Services')).toBeInTheDocument();
    expect(screen.getByText('High')).toBeInTheDocument();
    expect(screen.getByText('Sara Ahmed')).toBeInTheDocument();
    expect(screen.getByText('Strategic')).toBeInTheDocument();
    expect(screen.getByText('Finance')).toBeInTheDocument();
    expect(screen.getByText('Both (internal and external)')).toBeInTheDocument();
    expect(screen.getByText('Customers')).toBeInTheDocument();
    expect(screen.getByText('The portal is slow.')).toBeInTheDocument();
    expect(screen.getByText('Online payments')).toBeInTheDocument();
    expect(screen.getByText('Faster checkout')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Edit details' })).toHaveAttribute('href', '/manage/projects/1/edit');
  });

  it('says when a project does not exist', async () => {
    mockFetch({
      'GET /api/projects/999': () => ({ status: 404, body: { error: 'Project not found' } }),
      'GET /api/settings/calendar': () => ({ body: { weekendDays: [0, 6], holidays: [] } }),
    });
    renderAt('/manage/projects/999');
    expect(await screen.findByText('Project not found')).toBeInTheDocument();
  });
});
