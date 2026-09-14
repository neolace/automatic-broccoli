import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './app';
import { AuthProvider, createMsalInstance } from './auth/auth-provider';
import { buildMsalConfig } from './auth/auth-config';
import './styles/global.css';

async function bootstrap() {
  const rootElement = document.getElementById('root');
  if (!rootElement) throw new Error('Root element #root was not found.');

  const msalInstance = await createMsalInstance(buildMsalConfig(window.location.origin));

  // Completes the authorization-code redemption when returning from Entra.
  // Must run once, before rendering, so account state is settled on first paint.
  await msalInstance.handleRedirectPromise();

  createRoot(rootElement).render(
    <StrictMode>
      <AuthProvider instance={msalInstance}>
        <App />
      </AuthProvider>
    </StrictMode>,
  );
}

void bootstrap();
