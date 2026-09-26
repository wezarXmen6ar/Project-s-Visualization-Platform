import { useRef, type KeyboardEvent, type ReactNode } from 'react';
import { useLang } from '../../i18n/LanguageProvider';

export interface ProjectTab {
  key: string;
  label: string;
  content: ReactNode;
}

interface ProjectTabsProps {
  tabs: ProjectTab[];
  activeKey: string;
  onChange: (key: string) => void;
}

/**
 * The project page's tabs: a `role="tablist"` of buttons, each `role="tab"`, controlling one `role="tabpanel"`.
 * Arrow keys move focus between tabs and select the one focused; Home and End jump to the first and last. In RTL
 * the arrow that moves "forward" (towards the next tab) is ArrowLeft, since the tabs read right to left.
 */
export function ProjectTabs({ tabs, activeKey, onChange }: ProjectTabsProps) {
  const { dir } = useLang();
  const buttons = useRef<Record<string, HTMLButtonElement | null>>({});
  const active = tabs.find((tab) => tab.key === activeKey) ?? tabs[0];

  function focusAndSelect(key: string) {
    onChange(key);
    buttons.current[key]?.focus();
  }

  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>, index: number) {
    const forwardKey = dir === 'rtl' ? 'ArrowLeft' : 'ArrowRight';
    const backwardKey = dir === 'rtl' ? 'ArrowRight' : 'ArrowLeft';
    if (e.key === forwardKey) {
      e.preventDefault();
      focusAndSelect(tabs[(index + 1) % tabs.length].key);
    } else if (e.key === backwardKey) {
      e.preventDefault();
      focusAndSelect(tabs[(index - 1 + tabs.length) % tabs.length].key);
    } else if (e.key === 'Home') {
      e.preventDefault();
      focusAndSelect(tabs[0].key);
    } else if (e.key === 'End') {
      e.preventDefault();
      focusAndSelect(tabs[tabs.length - 1].key);
    }
  }

  return (
    <div className="project-tabs">
      <div role="tablist" className="tablist">
        {tabs.map((tab, index) => (
          <button
            key={tab.key}
            ref={(el) => { buttons.current[tab.key] = el; }}
            type="button"
            role="tab"
            id={`tab-${tab.key}`}
            aria-selected={tab.key === activeKey}
            aria-controls={tab.key === activeKey ? `tabpanel-${tab.key}` : undefined}
            tabIndex={tab.key === activeKey ? 0 : -1}
            className="tab-button"
            onClick={() => onChange(tab.key)}
            onKeyDown={(e) => onKeyDown(e, index)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`tabpanel-${active.key}`} aria-labelledby={`tab-${active.key}`} className="tabpanel">
        {active.content}
      </div>
    </div>
  );
}
