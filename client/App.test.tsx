// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { App } from './App';
import { LanguageProvider } from './i18n/LanguageProvider';

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  localStorage.clear();
});

describe('App', () => {
  it('opens in Arabic, right to left, when nothing is stored', () => {
    render(
      <LanguageProvider>
        <MemoryRouter initialEntries={['/']}>
          <App />
        </MemoryRouter>
      </LanguageProvider>,
    );
    expect(document.documentElement).toHaveAttribute('dir', 'rtl');
    expect(document.documentElement).toHaveAttribute('lang', 'ar');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('محفظة المشاريع');
  });
});
