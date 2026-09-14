import { useMemo } from 'react';

import { environment } from '../config/environment';
import { useAuth } from '../auth/use-auth';
import { createApiClient, type ApiClient } from './api-client';

/** Memoised API client bound to the current token service. */
export function useApiClient(): ApiClient {
  const { tokenService } = useAuth();

  return useMemo(
    () => createApiClient({ baseUrl: environment.apiBaseUrl, tokenService }),
    [tokenService],
  );
}
