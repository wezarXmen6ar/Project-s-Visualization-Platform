import { useEffect, useId, useRef, useState, type DragEvent, type KeyboardEvent, type PointerEvent } from 'react';

/** Returns a copy of `list` with the item at `from` moved to `to`, or `list` itself when there is nothing to do. */
export function moveItem<T>(list: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return list;
  const next = [...list];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

type Side = 'before' | 'after';
type DropTarget = { index: number; side: Side } | null;

/** Which side of `index` the dragged item (currently at `from`) would land on. `null` when `index` is the drag source itself. */
function sideFor(from: number, index: number): Side | null {
  if (index === from) return null;
  return index > from ? 'after' : 'before';
}

function sameTarget(a: DropTarget, b: DropTarget): boolean {
  if (a === b) return true;
  if (a === null || b === null) return false;
  return a.index === b.index && a.side === b.side;
}

/**
 * Drag-and-drop plus ArrowUp/ArrowDown reordering for a list of rows.
 *
 * Spread `rowProps(i)` on each row (the drop target) and `handleProps(i, label)` on the row's drag-handle `<button>`.
 * Only the handle is draggable, so text inputs inside the row keep normal clicking and text selection.
 * Each list gets its own hook, and a list only accepts drops that started on one of its own handles: mouse dragging
 * relies on the hook's own `dragIndex` ref, and touch/pen dragging matches rows by this hook's unique `data-reorder-list` id.
 */
export function useReorder(count: number, move: (from: number, to: number) => void) {
  const listId = useId();
  const dragIndex = useRef<number | null>(null);
  // Mirrors `dropTarget` state so `onPointerUp` can read the last hovered row synchronously, without trusting the
  // release event's own coordinates (which can be stale or zeroed once the finger has lifted).
  const dropTargetRef = useRef<DropTarget>(null);
  const handles = useRef<(HTMLButtonElement | null)[]>([]);
  const [pendingFocus, setPendingFocus] = useState<number | null>(null);
  const [dragging, setDragging] = useState<number | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget>(null);

  // After a keyboard move, the moved item has re-rendered at its new index: put focus back on its handle.
  useEffect(() => {
    if (pendingFocus === null) return;
    handles.current[pendingFocus]?.focus();
    setPendingFocus(null);
  }, [pendingFocus]);

  /** Updates the drop-target indicator, skipping the render entirely when nothing actually changed. */
  function updateDropTarget(next: DropTarget) {
    dropTargetRef.current = next;
    setDropTarget((prev) => (sameTarget(prev, next) ? prev : next));
  }

  function endDrag() {
    dragIndex.current = null;
    dropTargetRef.current = null;
    setDragging(null);
    setDropTarget(null);
  }

  /** Finds the row of this list under a touch/pen point, from the `data-reorder-list`/`data-reorder-index` attributes `rowProps` adds. */
  function rowAt(x: number, y: number): number | null {
    const el = document.elementFromPoint?.(x, y) as HTMLElement | null;
    const row = el?.closest(`[data-reorder-list="${listId}"]`) as HTMLElement | null;
    if (!row) return null;
    const idx = Number(row.getAttribute('data-reorder-index'));
    return Number.isNaN(idx) ? null : idx;
  }

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
        // Deferred: mutating the drag source's own row synchronously inside dragstart (even just an opacity
        // class) can make Chrome/Firefox cancel the drag operation they are still setting up. A macrotask
        // lets the browser finish starting the drag first.
        setTimeout(() => setDragging(index), 0);
      },
      onKeyDown: (e: KeyboardEvent<HTMLButtonElement>) => {
        const to = e.key === 'ArrowUp' ? index - 1 : e.key === 'ArrowDown' ? index + 1 : null;
        if (to === null) return;
        e.preventDefault();
        if (to < 0 || to >= count) return;
        move(index, to);
        setPendingFocus(to);
      },
      onPointerDown: (e: PointerEvent<HTMLButtonElement>) => {
        if (e.pointerType !== 'touch' && e.pointerType !== 'pen') return;
        // Without this, a touch on a `draggable` element can make Chrome start its own native drag (or a
        // scroll) instead of delivering clean pointermove/pointerup events to us.
        e.preventDefault();
        dragIndex.current = index;
        setDragging(index);
        try {
          e.currentTarget.setPointerCapture?.(e.pointerId);
        } catch {
          // Capture can throw (e.g. pointerId already released); pointer events still bubble without it.
        }
      },
      onPointerMove: (e: PointerEvent<HTMLButtonElement>) => {
        if (dragIndex.current === null) return;
        if (e.pointerType !== 'touch' && e.pointerType !== 'pen') return;
        const at = rowAt(e.clientX, e.clientY);
        if (at === null) return;
        const side = sideFor(dragIndex.current, at);
        updateDropTarget(side ? { index: at, side } : null);
      },
      onPointerUp: (e: PointerEvent<HTMLButtonElement>) => {
        if (e.pointerType !== 'touch' && e.pointerType !== 'pen') return;
        const from = dragIndex.current;
        // Prefer the last position seen while moving: a release event's own coordinates aren't reliable once
        // the finger has lifted. Fall back to the release point itself if the drag never moved.
        const at = dropTargetRef.current?.index ?? rowAt(e.clientX, e.clientY);
        endDrag();
        if (from !== null && at !== null && at !== undefined) move(from, at);
      },
      // Not gated on pointerType: onPointerDown only ever sets drag state for touch/pen, so resetting
      // unconditionally here is harmless (a no-op) for any other pointer type.
      onPointerCancel: () => {
        endDrag();
      },
    };
  }

  function rowProps(index: number) {
    const classes = [dragging === index ? 'dragging' : null, dropTarget?.index === index ? `drop-target drop-${dropTarget.side}` : null]
      .filter((c): c is string => c !== null)
      .join(' ');
    return {
      className: classes,
      'data-reorder-list': listId,
      'data-reorder-index': index,
      onDragOver: (e: DragEvent<HTMLElement>) => {
        if (dragIndex.current === null) return;
        e.preventDefault();
        const side = sideFor(dragIndex.current, index);
        updateDropTarget(side ? { index, side } : null);
      },
      onDragLeave: (e: DragEvent<HTMLElement>) => {
        // A dragleave into a child element of the same row (e.g. an input) isn't really leaving the row.
        if (e.currentTarget.contains(e.relatedTarget as Node)) return;
        // Never touch dragIndex here: dragleave fires on whatever row the pointer is passing over on its way
        // to the eventual drop target, well before drop/dragend, and clearing it would abort the whole drag.
        setDropTarget((prev) => {
          if (prev?.index !== index) return prev;
          dropTargetRef.current = null;
          return null;
        });
      },
      onDrop: (e: DragEvent<HTMLElement>) => {
        e.preventDefault();
        const from = dragIndex.current;
        endDrag();
        if (from !== null) move(from, index);
      },
      onDragEnd: () => {
        endDrag();
      },
    };
  }

  return { handleProps, rowProps };
}
