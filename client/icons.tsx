/**
 * A small set of inline, stroke-based icons shared across pages.
 * All decorative — every usage should carry aria-hidden="true" and rely on
 * adjacent visible text (or an aria-label on the parent) for meaning.
 */
const base = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
};

export function KanbanIcon() {
  return (
    <svg {...base}>
      <rect x="3.5" y="4" width="17" height="16" rx="2.5" />
      <path d="M8.5 8v9M12 8v5.5M15.5 8v7" />
    </svg>
  );
}

export function PresentationIcon() {
  return (
    <svg {...base}>
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M8.5 20h7M12 16v4" />
      <path d="M8 12.5l2.6-2.6 2 2L16.5 9" />
    </svg>
  );
}

export function PlusIcon() {
  return (
    <svg {...base}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function TrashIcon() {
  return (
    <svg {...base}>
      <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m3 0-.7 12a2 2 0 0 1-2 1.9H8.7a2 2 0 0 1-2-1.9L6 7" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  );
}

/** Points back; flips in right-to-left pages (class `icon-directional`). */
export function ArrowLeftIcon() {
  return (
    <svg {...base} className="icon-directional">
      <path d="M19 12H5M11 6l-6 6 6 6" />
    </svg>
  );
}

/** Points forward; flips in right-to-left pages (class `icon-directional`). */
export function ArrowRightIcon() {
  return (
    <svg {...base} className="icon-directional">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

export function FolderOpenIcon() {
  return (
    <svg {...base}>
      <path d="M3.5 7.5A1.5 1.5 0 0 1 5 6h4l2 2h8a1.5 1.5 0 0 1 1.5 1.5v.5H5.6a1.5 1.5 0 0 0-1.47 1.2l-1.4 7A1.5 1.5 0 0 0 4.2 20h14.2" />
      <path d="M4.5 10.5h16.8l-1.5 7.6a1.5 1.5 0 0 1-1.47 1.2H6a1.5 1.5 0 0 1-1.47-1.8l1.4-7Z" />
    </svg>
  );
}

/** A meeting entry in the History tab. */
export function MeetingIcon() {
  return (
    <svg {...base}>
      <circle cx="9" cy="8" r="3" />
      <path d="M4 20v-1.5A4.5 4.5 0 0 1 8.5 14H9" />
      <circle cx="17" cy="9.5" r="2.2" />
      <path d="M13.5 20v-1a3.7 3.7 0 0 1 3.5-3.7 3.7 3.7 0 0 1 3.5 3.7v1" />
    </svg>
  );
}

/** An update entry in the History tab. */
export function UpdateIcon() {
  return (
    <svg {...base}>
      <path d="M4 5.5h16M4 12h16M4 18.5h10" />
    </svg>
  );
}

export function AlertIcon() {
  return (
    <svg {...base}>
      <path d="M12 3.5 2.5 20h19L12 3.5Z" />
      <path d="M12 9.5v4.5M12 17h.01" />
    </svg>
  );
}

export function GripIcon() {
  return (
    <svg {...base} fill="currentColor" stroke="none">
      <circle cx="9" cy="6" r="1.3" />
      <circle cx="9" cy="12" r="1.3" />
      <circle cx="9" cy="18" r="1.3" />
      <circle cx="15" cy="6" r="1.3" />
      <circle cx="15" cy="12" r="1.3" />
      <circle cx="15" cy="18" r="1.3" />
    </svg>
  );
}
