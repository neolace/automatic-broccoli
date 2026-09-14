import { useAuth } from '../auth/use-auth';

export function ErrorPage() {
  const { failure, clearFailure, signIn } = useAuth();

  return (
    <section role="alert">
      <h1>Something went wrong</h1>
      <p>{failure?.message ?? 'An unexpected authentication error occurred.'}</p>
      <button
        type="button"
        className="btn btn-primary"
        onClick={() => {
          clearFailure();
          void signIn();
        }}
      >
        Try signing in again
      </button>
    </section>
  );
}
