export function AuthLoading({ message }: { message: string }) {
  return (
    <div className="auth-loading" role="status" aria-live="polite">
      <span className="spinner" aria-hidden="true" />
      <p>{message}</p>
    </div>
  );
}
