import { AuthLoading } from '../components/auth/auth-loading';

/**
 * Rendered while MSAL processes the redirect response. handleRedirectPromise
 * runs once at app bootstrap (see main.tsx); this page is only a visual state.
 */
export function AuthCallbackPage() {
  return <AuthLoading message="Completing sign-in..." />;
}
