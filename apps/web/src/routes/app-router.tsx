import { Route, Routes } from 'react-router';

import { ProtectedRoute } from '../auth/protected-route';
import { AppShell } from '../components/layout/app-shell';
import { AuthCallbackPage } from '../pages/auth-callback-page';
import { ErrorPage } from '../pages/error-page';
import { ForbiddenPage } from '../pages/forbidden-page';
import { HomePage } from '../pages/home-page';
import { LoginPage } from '../pages/login-page';

export function AppRouter() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/auth/callback" element={<AuthCallbackPage />} />
      <Route path="/forbidden" element={<ForbiddenPage />} />
      <Route path="/error" element={<ErrorPage />} />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <AppShell>
              <HomePage />
            </AppShell>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}
