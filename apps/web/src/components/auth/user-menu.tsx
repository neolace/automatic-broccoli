import { useAuth } from '../../auth/use-auth';
import { LogoutButton } from './logout-button';

/**
 * Displays presentation-only account information (name, username). These
 * values must never be used for authorization decisions -- see docs/authorization.md.
 */
export function UserMenu() {
  const { account } = useAuth();
  if (!account) return null;

  return (
    <div className="user-menu">
      <span className="user-menu__name">{account.name ?? account.username}</span>
      <LogoutButton />
    </div>
  );
}
