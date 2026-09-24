import { useEffect, useRef, useState, type DragEvent, type KeyboardEvent } from 'react';

/** Returns a copy of `list` with the item at `from` moved to `to`, or `list` itself when there is nothing to do. */
export function moveItem<T>(list: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return list;
  const next = [...list];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

/**
 * Drag-and-drop plus ArrowUp/ArrowDown reordering for a list of rows.
 *
 * Spread `rowProps(i)` on each row (the drop target) and `handleProps(i, label)` on the row's drag-handle `<button>`.
 * Only the handle is draggable, so text inputs inside the row keep normal clicking and text selection.
 * Each list gets its own hook, and a list only accepts drops that started on one of its own handles.
 */
export function useReorder(count: number, move: (from: number, to: number) => void) {
  const dragIndex = useRef<number | null>(null);
  const handles = useRef<(HTMLButtonElement | null)[]>([]);
  const [pendingFocus, setPendingFocus] = useState<number | null>(null);

  // After a keyboard move, the moved item has re-rendered at its new index: put focus back on its handle.
  useEffect(() => {
    if (pendingFocus === null) return;
    handles.current[pendingFocus]?.focus();
    setPendingFocus(null);
  }, [pendingFocus]);

  function handleProps(index: number, label: string) {
    return {
      type: 'button' as const,
      className: 'drag-handle',
      'aria-label': label,
      draggable: true,
      ref: (el: HTMLButtonElement | null) => {
        handles.current[index] = el;
      },
      onDragStart: (e: DragEvent<HTMLButtonElement>) => {
        dragIndex.current = index;
        // Firefox will not start a drag unless some data is set.
        e.dataTransfer.setData('text/plain', String(index));
        e.dataTransfer.effectAllowed = 'move';
      },
      onKeyDown: (e: KeyboardEvent<HTMLButtonElement>) => {
        const to = e.key === 'ArrowUp' ? index - 1 : e.key === 'ArrowDown' ? index + 1 : null;
        if (to === null) return;
        e.preventDefault();
        if (to < 0 || to >= count) return;
        move(index, to);
        setPendingFocus(to);
      },
    };
  }

  function rowProps(index: number) {
    return {
      onDragOver: (e: DragEvent<HTMLElement>) => {
        if (dragIndex.current !== null) e.preventDefault();
      },
      onDrop: (e: DragEvent<HTMLElement>) => {
        e.preventDefault();
        const from = dragIndex.current;
        dragIndex.current = null;
        if (from !== null) move(from, index);
      },
      onDragEnd: () => {
        dragIndex.current = null;
      },
    };
  }

  return { handleProps, rowProps };
}
