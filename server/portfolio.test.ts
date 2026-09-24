import { describe, expect, it } from 'vitest';
import { buildApp } from './app';
import { openDb } from './db';

const make = (name: string, startDate: string, days: number) => ({
  name, color: '#3b82f6', startDate, phases: [{ name: 'Work', durationDays: days }],
});

async function setup() {
  const app = buildApp(openDb(':memory:'), { today: () => '2026-09-24' });
  for (const body of [
    make('Done 2026', '2026-01-05', 5),
    make('Active', '2026-09-01', 60),
    make('Planned', '2026-11-02', 10),
    make('Old', '2025-03-03', 5),
  ]) {
    await app.inject({ method: 'POST', url: '/api/projects', payload: body });
  }
  return app;
}

describe('GET /api/portfolio', () => {
  it('returns projects overlapping the year with stats', async () => {
    const app = await setup();
    const res = await app.inject({ method: 'GET', url: '/api/portfolio?year=2026' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.year).toBe(2026);
    expect(body.today).toBe('2026-09-24');
    expect(body.projects.map((p: { name: string }) => p.name)).toEqual(['Done 2026', 'Active', 'Planned']);
    expect(body.stats).toEqual({ active: 1, finishedThisYear: 1, startingThisYear: 1 });
  });

  it('defaults to the current year', async () => {
    const app = await setup();
    const body = (await app.inject({ method: 'GET', url: '/api/portfolio' })).json();
    expect(body.year).toBe(2026);
  });

  it('shows other years', async () => {
    const app = await setup();
    const body = (await app.inject({ method: 'GET', url: '/api/portfolio?year=2025' })).json();
    expect(body.projects.map((p: { name: string }) => p.name)).toEqual(['Old']);
  });

  it('rejects a bad year', async () => {
    const app = await setup();
    const res = await app.inject({ method: 'GET', url: '/api/portfolio?year=abc' });
    expect(res.statusCode).toBe(400);
  });
});
