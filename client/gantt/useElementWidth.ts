import { useCallback, useRef, useState } from 'react';

/**
 * Tracks an element's width so the SVG chart can fill its container.
 * Returns a callback ref, so it also works when the element appears after data loads.
 */
export function useElementWidth<T extends HTMLElement>(fallback = 960): [(el: T | null) => void, number] {
  const [width, setWidth] = useState(fallback);
  const observerRef = useRef<ResizeObserver | null>(null);

  const ref = useCallback((el: T | null) => {
    observerRef.current?.disconnect();
    observerRef.current = null;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w) setWidth(Math.floor(w));
    });
    observer.observe(el);
    observerRef.current = observer;
  }, []);

  return [ref, width];
}
