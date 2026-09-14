import { useAuth } from '../../auth/use-auth';

export function LogoutButton() {
  const { signOut } = useAuth();

  return (
    <button type="button" className="btn btn-ghost" onClick={() => void signOut()}>
      Sign out
    </button>
  );
}
