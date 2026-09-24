import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';

afterEach(async () => {
  vi.unstubAllGlobals();
  if (typeof document !== 'undefined') {
    const { cleanup } = await import('@testing-library/react');
    cleanup();
  }
});
