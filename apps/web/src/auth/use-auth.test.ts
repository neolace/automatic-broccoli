import { InteractionStatus } from '@azure/msal-browser';
import { describe, expect, it } from 'vitest';

import { deriveStatus } from './use-auth';

describe('deriveStatus', () => {
  it('reports initializing during startup and redirect handling', () => {
    expect(deriveStatus(InteractionStatus.Startup, false, null)).toBe('initializing');
    expect(deriveStatus(InteractionStatus.HandleRedirect, false, null)).toBe('initializing');
  });

  it('reports redirecting during any interactive flow', () => {
    expect(deriveStatus(InteractionStatus.AcquireToken, false, null)).toBe('redirecting');
    expect(deriveStatus(InteractionStatus.Logout, true, null)).toBe('redirecting');
  });

  it('reports authenticated once interaction settles and a session exists', () => {
    expect(deriveStatus(InteractionStatus.None, true, null)).toBe('authenticated');
  });

  it('reports failed when interaction settles with a recorded failure', () => {
    expect(deriveStatus(InteractionStatus.None, false, { message: 'nope' })).toBe('failed');
  });

  it('reports unauthenticated when idle with no session and no failure', () => {
    expect(deriveStatus(InteractionStatus.None, false, null)).toBe('unauthenticated');
  });
});
