import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';

import { AuthLoading } from '../components/auth/auth-loading';
import { useAuth } from './use-auth';

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const location = useLocation();

  switch (status) {
    case 'initializing':
      return <AuthLoading message="Restoring your session..." />;
    case 'redirecting':
      return <AuthLoading message="Redirecting to Microsoft sign-in..." />;
    case 'failed':
      return <Navigate to="/error" replace state={{ from: location }} />;
    case 'unauthenticated':
      return <Navigate to="/login" replace state={{ from: location }} />;
    case 'authenticated':
      return <>{children}</>;
  }
}
