// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { NextUp } from './NextUp';

describe('NextUp', () => {
  it("shows only the heading while 'I am' is still loading, not the Settings prompt", () => {
    render(
      <MemoryRouter>
        <NextUp todos={[]} me={undefined} onToggleDone={vi.fn()} />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { name: 'Next up' })).toBeInTheDocument();
    expect(screen.queryByText(/Set who you are in/)).toBeNull();
  });

  it("shows the Settings prompt once 'I am' has loaded and is unset", () => {
    render(
      <MemoryRouter>
        <NextUp todos={[]} me={{ resourceId: null, name: null }} onToggleDone={vi.fn()} />
      </MemoryRouter>,
    );
    expect(screen.getByText(/Set who you are in/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Settings' })).toHaveAttribute('href', '/manage/settings');
  });
});
