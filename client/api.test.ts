// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { ApiError, api } from './api';
import { mockFetch } from './testing/mockFetch';

describe('api', () => {
  it('sends JSON with a content type when there is a body', async () => {
    const fetchMock = mockFetch({
      'POST /api/lists/goal': () => ({ status: 201, body: { id: 9, list: 'goal', name: 'Speed', order: 1 } }),
    });
    expect(await api.addListValue('goal', 'Speed')).toEqual({ id: 9, list: 'goal', name: 'Speed', order: 1 });
    const [, init] = fetchMock.mock.calls[0];
    expect(init?.body).toBe(JSON.stringify({ name: 'Speed' }));
    expect(init?.headers).toEqual({ 'Content-Type': 'application/json' });
  });

  it('sends a bodiless DELETE without a JSON content type and accepts an empty 204', async () => {
    const fetchMock = mockFetch({ 'DELETE /api/lists/goal/9': () => ({ status: 204, body: null }) });
    await expect(api.deleteListValue('goal', 9)).resolves.toEqual({});
    const [, init] = fetchMock.mock.calls[0];
    expect(init?.headers).toBeUndefined();
  });

  it('turns an error response into an ApiError with the server message', async () => {
    mockFetch({ 'DELETE /api/lists/goal/4': () => ({ status: 409, body: { error: '"Speed" is used by 2 projects' } }) });
    await expect(api.deleteListValue('goal', 4)).rejects.toThrow(new ApiError('"Speed" is used by 2 projects', 409));
  });

  it('falls back to a coded, translatable message when the response has no server message', async () => {
    mockFetch({ 'DELETE /api/lists/goal/4': () => ({ status: 500, body: {} }) });
    try {
      await api.deleteListValue('goal', 4);
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      const apiErr = err as ApiError;
      expect(apiErr.message).toBe('Request failed (500)');
      expect(apiErr.code).toBe('common.requestFailed');
      expect(apiErr.params).toEqual({ status: 500 });
    }
  });

  it('saves project details with PUT', async () => {
    const fetchMock = mockFetch({ 'PUT /api/projects/3/details': () => ({ body: { id: 3 } }) });
    await api.updateProjectDetails(3, { name: 'X', color: '#000000' });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/projects/3/details');
    expect(init?.method).toBe('PUT');
    expect(JSON.parse(init?.body as string)).toEqual({ name: 'X', color: '#000000' });
  });
});
