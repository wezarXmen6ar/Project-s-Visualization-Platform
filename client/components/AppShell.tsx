import type { ReactNode } from 'react';
import { LanguageSwitch } from '../i18n/LanguageSwitch';

/** A thin bar at the top end of every page that holds the language switch, and nothing else. */
export function AppShell(props: { children: ReactNode }) {
  return (
    <div className="app-shell">
      <div className="app-bar">
        <LanguageSwitch />
      </div>
      {props.children}
    </div>
  );
}
