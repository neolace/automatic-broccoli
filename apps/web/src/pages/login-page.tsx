import { useAuth } from '../auth/use-auth';
import { LoginButton } from '../components/auth/login-button';
import { AuthLoading } from '../components/auth/auth-loading';

/**
 * Entry point only. Credential collection, MFA and Conditional Access happen
 * on Microsoft-hosted pages -- this screen never renders a password field.
 */
export function LoginPage() {
  const { status, failure, clearFailure, signIn } = useAuth();

  if (status === 'redirecting') {
    return <AuthLoading message="Redirecting to Microsoft sign-in..." />;
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-card__logo" aria-hidden="true" />
        <h1>Secure Application</h1>
        <p>Sign in using your corporate account</p>

        <LoginButton />

        {failure ? (
          <div className="login-card__error" role="alert">
            <p>We could not complete sign-in. {failure.message}</p>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                clearFailure();
                void signIn();
              }}
            >
              Try again
            </button>
          </div>
        ) : null}

        <p className="login-card__footer">Protected by Microsoft Entra ID</p>
      </div>
    </div>
  );
}
