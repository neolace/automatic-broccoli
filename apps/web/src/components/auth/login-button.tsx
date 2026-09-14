import { useAuth } from '../../auth/use-auth';

export function LoginButton() {
  const { signIn, status } = useAuth();
  const busy = status === 'redirecting';

  return (
    <button
      type="button"
      className="btn btn-primary"
      onClick={() => void signIn()}
      disabled={busy}
      aria-busy={busy}
    >
      {busy ? 'Redirecting...' : 'Sign in with Microsoft'}
    </button>
  );
}
