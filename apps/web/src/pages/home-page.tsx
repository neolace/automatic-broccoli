import { useEffect, useState } from 'react';

import type { MeResponse } from '../api/api-types';
import { ApiError } from '../api/api-types';
import { useApiClient } from '../api/use-api-client';

export function HomePage() {
  const apiClient = useApiClient();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    apiClient
      .get<MeResponse>('/api/me')
      .then((result) => {
        if (!cancelled) setMe(result);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message =
          err instanceof ApiError
            ? `${err.message} (reference: ${err.correlationId})`
            : 'Unable to load your profile.';
        setError(message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [apiClient]);

  if (loading) return <p>Loading...</p>;
  if (error) return <p role="alert">{error}</p>;

  return (
    <section>
      <h1>Welcome</h1>
      {me ? (
        <dl>
          <dt>User ID</dt>
          <dd>{me.userId}</dd>
          <dt>Tenant ID</dt>
          <dd>{me.tenantId}</dd>
          <dt>Scopes</dt>
          <dd>{me.scopes.join(', ')}</dd>
        </dl>
      ) : null}
    </section>
  );
}
