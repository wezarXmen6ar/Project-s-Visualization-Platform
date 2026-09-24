// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useParams } from 'react-router';
import { describe, expect, it } from 'vitest';
import { mockFetch, sampleLists, sampleProject } from '../../testing/mockFetch';
import { EditProjectPage } from './EditProjectPage';

function ProjectStub() {
  const { id } = useParams();
  return <div>Project page {id}</div>;
}

function renderAt(url: string) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/manage/projects/:id/edit" element={<EditProjectPage />} />
        <Route path="/manage/projects/:id" element={<ProjectStub />} />
      </Routes>
    </MemoryRouter>,
  );
}

const project = sampleProject({
  projectManager: 'Sara Ahmed',
  projectType: { id: 2, name: 'Customer' },
  scopeItems: [{ id: 5, kind: 'scope', text: 'Online payments', order: 0, dateAdded: '2026-09-24' }],
});

describe('EditProjectPage', () => {
  it('loads the saved details, saves changes and returns to the project', async () => {
    const fetchMock = mockFetch({
      'GET /api/projects/1': () => ({ body: project }),
      'GET /api/lists': () => ({ body: sampleLists() }),
      'PUT /api/projects/1/details': () => ({ body: project }),
    });
    const user = userEvent.setup();
    renderAt('/manage/projects/1/edit');

    const name = await screen.findByLabelText('Project name');
    expect(name).toHaveValue('Portal');
    expect(screen.getByLabelText('Project manager')).toHaveValue('Sara Ahmed');
    expect(screen.getByLabelText('Scope item 1')).toHaveValue('Online payments');
    await screen.findByRole('option', { name: 'Customer' });
    expect(screen.getByLabelText('Project type')).toHaveValue('2');

    await user.clear(name);
    await user.type(name, 'Portal 2');
    await user.type(screen.getByLabelText('New objective'), 'Faster checkout{Enter}');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByText('Project page 1')).toBeInTheDocument();
    const put = fetchMock.mock.calls.find(([url, init]) => url === '/api/projects/1/details' && init?.method === 'PUT');
    const sent = JSON.parse(put![1]!.body as string);
    expect(sent).toMatchObject({ name: 'Portal 2', projectManager: 'Sara Ahmed', projectTypeId: 2 });
    expect(sent.scopeItems).toEqual([
      { id: 5, kind: 'scope', text: 'Online payments' },
      { kind: 'objective', text: 'Faster checkout' },
    ]);
    expect(sent.phases).toBeUndefined();
  });

  it('saves a scope item typed but not confirmed with Enter, on Save changes', async () => {
    const fetchMock = mockFetch({
      'GET /api/projects/1': () => ({ body: project }),
      'GET /api/lists': () => ({ body: sampleLists() }),
      'PUT /api/projects/1/details': () => ({ body: project }),
    });
    const user = userEvent.setup();
    renderAt('/manage/projects/1/edit');

    await screen.findByLabelText('Project name');
    await user.type(screen.getByLabelText('New objective'), 'Faster checkout');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByText('Project page 1')).toBeInTheDocument();
    const put = fetchMock.mock.calls.find(([url, init]) => url === '/api/projects/1/details' && init?.method === 'PUT');
    const sent = JSON.parse(put![1]!.body as string);
    expect(sent.scopeItems).toEqual([
      { id: 5, kind: 'scope', text: 'Online payments' },
      { kind: 'objective', text: 'Faster checkout' },
    ]);
  });

  it('does not save an empty project name', async () => {
    const fetchMock = mockFetch({
      'GET /api/projects/1': () => ({ body: project }),
      'GET /api/lists': () => ({ body: sampleLists() }),
    });
    const user = userEvent.setup();
    renderAt('/manage/projects/1/edit');
    await user.clear(await screen.findByLabelText('Project name'));
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByText('Project name is required')).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'PUT')).toBe(false);
  });

  it('shows an error banner when the dropdown lists fail to load, but still shows the saved project', async () => {
    mockFetch({
      'GET /api/projects/1': () => ({ body: project }),
      'GET /api/lists': () => ({ status: 500, body: { error: 'Lists unavailable' } }),
    });
    renderAt('/manage/projects/1/edit');

    expect(await screen.findByText(/Could not load the dropdown lists/)).toBeInTheDocument();
    expect(screen.getByLabelText('Project name')).toHaveValue('Portal');
  });

  it('says when the project does not exist', async () => {
    mockFetch({
      'GET /api/projects/999': () => ({ status: 404, body: { error: 'Project not found' } }),
      'GET /api/lists': () => ({ body: sampleLists() }),
    });
    renderAt('/manage/projects/999/edit');
    expect(await screen.findByText('Project not found')).toBeInTheDocument();
  });
});
