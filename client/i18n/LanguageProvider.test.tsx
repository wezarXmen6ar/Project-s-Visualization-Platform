// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LanguageProvider, useLang, useT } from './LanguageProvider';
import { LanguageSwitch } from './LanguageSwitch';

function Probe() {
  const t = useT();
  const { dir } = useLang();
  return <p data-testid="probe" data-dir={dir}>{t('landing.manage')}</p>;
}

const html = () => document.documentElement;

beforeEach(() => {
  localStorage.clear();
  html().removeAttribute('lang');
  html().removeAttribute('dir');
});

afterEach(() => {
  localStorage.clear();
});

describe('LanguageProvider', () => {
  it('gives English without a provider, and leaves <html> alone', () => {
    render(<Probe />);
    expect(screen.getByTestId('probe')).toHaveTextContent('Project Management');
    expect(screen.getByTestId('probe')).toHaveAttribute('data-dir', 'ltr');
    expect(html().getAttribute('dir')).toBeNull();
    expect(html().getAttribute('lang')).toBeNull();
  });

  it('starts in Arabic with empty storage, and sets <html lang="ar" dir="rtl">', () => {
    render(<LanguageProvider><Probe /></LanguageProvider>);
    expect(screen.getByTestId('probe')).toHaveTextContent('إدارة المشاريع');
    expect(screen.getByTestId('probe')).toHaveAttribute('data-dir', 'rtl');
    expect(html()).toHaveAttribute('lang', 'ar');
    expect(html()).toHaveAttribute('dir', 'rtl');
  });

  it('switches to English from the switch, and remembers it', async () => {
    render(<LanguageProvider><LanguageSwitch /><Probe /></LanguageProvider>);
    expect(screen.getByRole('button', { name: 'العربية' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'English' })).toHaveAttribute('aria-pressed', 'false');

    await userEvent.click(screen.getByRole('button', { name: 'English' }));

    expect(screen.getByTestId('probe')).toHaveTextContent('Project Management');
    expect(screen.getByTestId('probe')).toHaveAttribute('data-dir', 'ltr');
    expect(html()).toHaveAttribute('lang', 'en');
    expect(html()).toHaveAttribute('dir', 'ltr');
    expect(localStorage.getItem('pvp.lang')).toBe('en');
    expect(screen.getByRole('button', { name: 'English' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'العربية' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('honours a stored language on the next mount', () => {
    localStorage.setItem('pvp.lang', 'en');
    render(<LanguageProvider><Probe /></LanguageProvider>);
    expect(screen.getByTestId('probe')).toHaveTextContent('Project Management');
    expect(html()).toHaveAttribute('dir', 'ltr');
  });

  it('falls back to Arabic when localStorage throws', async () => {
    vi.stubGlobal('localStorage', {
      getItem: () => { throw new Error('blocked'); },
      setItem: () => { throw new Error('blocked'); },
      removeItem: () => { throw new Error('blocked'); },
      clear: () => {},
    });
    render(<LanguageProvider><LanguageSwitch /><Probe /></LanguageProvider>);
    expect(screen.getByTestId('probe')).toHaveTextContent('إدارة المشاريع');
    await userEvent.click(screen.getByRole('button', { name: 'English' }));
    expect(screen.getByTestId('probe')).toHaveTextContent('Project Management');
  });

  it('uses the given language when controlled, without touching <html>', () => {
    render(<LanguageProvider lang="ar"><Probe /></LanguageProvider>);
    expect(screen.getByTestId('probe')).toHaveTextContent('إدارة المشاريع');
    expect(html().getAttribute('dir')).toBeNull();
  });

  it('puts <html> back as it was when unmounted', () => {
    const { unmount } = render(<LanguageProvider><Probe /></LanguageProvider>);
    expect(html()).toHaveAttribute('dir', 'rtl');
    unmount();
    expect(html().getAttribute('dir')).toBeNull();
    expect(html().getAttribute('lang')).toBeNull();
  });
});
