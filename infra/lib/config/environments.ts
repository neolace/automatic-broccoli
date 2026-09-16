/**
 * Environment-specific configuration.
 *
 * Only values that truly vary by environment live here: account, region,
 * domain names, log retention, CORS origins and deployment safeguards. The
 * single Entra tenant/app registration identifiers are non-secret and are
 * supplied at synth/deploy time via environment variables so the same code
 * can target dev, test and prod without maintaining near-duplicate stacks.
 */
import { RetentionDays } from 'aws-cdk-lib/aws-logs';

export type EnvironmentName = 'dev' | 'test' | 'prod';

export interface DomainConfig {
  /** Route 53 public hosted zone name, e.g. "example.com". */
  readonly hostedZoneName: string;
  /** Fully qualified domain the SPA is served from, e.g. "app.example.com". */
  readonly siteDomainName: string;
  /** Fully qualified domain the API is served from, e.g. "api.example.com". */
  readonly apiDomainName: string;
}

export interface EnvironmentConfig {
  readonly name: EnvironmentName;
  readonly account?: string;
  readonly region: string;
  /**
   * Origins the API's CORS policy allows for this environment. Always include
   * every origin browsers will use for the SPA (local Vite, custom site
   * domain, or the execute-api site URL). When `domain` is set,
   * `resolveCorsOrigins` also adds `https://<siteDomainName>`.
   */
  readonly corsOrigins: string[];
  readonly logRetention: RetentionDays;
  /**
   * Custom domain, ACM certificate and Route 53 wiring. Omitted for local/dev
   * environments that use the generated API Gateway domains.
   */
  readonly domain?: DomainConfig;
  /** Removal policy safeguard: production resources are retained on stack deletion. */
  readonly isProduction: boolean;
}

const ENVIRONMENTS: Record<EnvironmentName, EnvironmentConfig> = {
  dev: {
    name: 'dev',
    region: process.env.AWS_REGION ?? 'us-east-1',
    corsOrigins: ['http://localhost:5173'],
    logRetention: RetentionDays.TWO_WEEKS,
    isProduction: false,
  },
  test: {
    name: 'test',
    region: process.env.AWS_REGION ?? 'us-east-1',
    // Matches the SPA origin browsers will use once a custom domain is wired
    // (or keep as the documented stand-in until domain is uncommented).
    corsOrigins: ['https://test.app.example.com'],
    logRetention: RetentionDays.ONE_MONTH,
    isProduction: false,
  },
  prod: {
    name: 'prod',
    region: process.env.AWS_REGION ?? 'us-east-1',
    corsOrigins: ['https://app.example.com'],
    logRetention: RetentionDays.SIX_MONTHS,
    isProduction: true,
    // Populate to provision custom domains, ACM certificates and Route 53
    // records for both the SPA and the API. Left undefined until a real
    // domain is owned.
    // domain: {
    //   hostedZoneName: 'example.com',
    //   siteDomainName: 'app.example.com',
    //   apiDomainName: 'api.example.com',
    // },
  },
};

export function loadEnvironmentConfig(name: EnvironmentName): EnvironmentConfig {
  const config = ENVIRONMENTS[name];
  return { ...config, account: process.env.CDK_DEFAULT_ACCOUNT };
}

/**
 * CORS allow-list for the API. Starts from `corsOrigins` and, when a custom
 * site domain is configured, always includes that SPA origin so browsers and
 * the API stay aligned with the same DomainConfig.
 */
export function resolveCorsOrigins(appEnv: EnvironmentConfig): string[] {
  const origins = new Set(appEnv.corsOrigins);
  if (appEnv.domain) {
    origins.add(`https://${appEnv.domain.siteDomainName}`);
  }
  return [...origins];
}

/** Public HTTPS origin of the API for this environment (custom domain when set). */
export function resolveApiOrigin(appEnv: EnvironmentConfig, executeApiUrl: string): string {
  if (appEnv.domain) {
    return `https://${appEnv.domain.apiDomainName}`;
  }
  return executeApiUrl.replace(/\/$/, '');
}

/**
 * Non-secret Entra identifiers required to configure the JWT authorizer and
 * embed the frontend's runtime configuration at deploy time.
 */
export interface EntraConfig {
  readonly tenantId: string;
  readonly clientId: string;
}

export function loadEntraConfig(): EntraConfig {
  const tenantId = process.env.ENTRA_TENANT_ID;
  const clientId = process.env.ENTRA_CLIENT_ID;

  if (!tenantId || !clientId) {
    throw new Error(
      'ENTRA_TENANT_ID and ENTRA_CLIENT_ID must be set to synthesize the API stack. ' +
        'See docs/entra-configuration.md.',
    );
  }

  return { tenantId, clientId };
}
