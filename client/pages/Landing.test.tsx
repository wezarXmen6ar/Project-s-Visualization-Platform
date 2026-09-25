// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { LanguageProvider } from '../i18n/LanguageProvider';
import { Landing } from './Landing';

describe('Landing', () => {
  it('offers the two main features', () => {
    render(<MemoryRouter><Landing /></MemoryRouter>);
    expect(screen.getByRole('link', { name: /Project Management/ })).toHaveAttribute('href', '/manage');
    expect(screen.getByRole('link', { name: /Project Presentation/ })).toHaveAttribute('href', '/present');
  });

  it('offers them in Arabic', () => {
    render(<LanguageProvider lang="ar"><MemoryRouter><Landing /></MemoryRouter></LanguageProvider>);
    expect(screen.getByRole('link', { name: /إدارة المشاريع/ })).toHaveAttribute('href', '/manage');
    expect(screen.getByRole('link', { name: /عرض المشاريع/ })).toHaveAttribute('href', '/present');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('محفظة المشاريع');
    expect(screen.queryByText(/Project/)).toBeNull();
  });
});
