import type { ReactNode } from 'react';

import { UserMenu } from '../auth/user-menu';

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="app-shell">
      <header className="app-shell__header">
        <span className="app-shell__brand">Secure Application</span>
        <UserMenu />
      </header>
      <main className="app-shell__main">{children}</main>
    </div>
  );
}
