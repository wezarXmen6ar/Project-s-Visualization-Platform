// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { Landing } from './Landing';

describe('Landing', () => {
  it('offers the two main features', () => {
    render(<MemoryRouter><Landing /></MemoryRouter>);
    expect(screen.getByRole('link', { name: /Project Management/ })).toHaveAttribute('href', '/manage');
    expect(screen.getByRole('link', { name: /Project Presentation/ })).toHaveAttribute('href', '/present');
  });
});
