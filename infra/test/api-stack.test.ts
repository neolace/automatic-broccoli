import { App } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { RetentionDays } from 'aws-cdk-lib/aws-logs';
import { describe, expect, it } from 'vitest';

import { ApiStack } from '../lib/api-stack';
import type { EnvironmentConfig } from '../lib/config/environments';

const appEnv: EnvironmentConfig = {
  name: 'dev',
  region: 'us-east-1',
  corsOrigins: ['http://localhost:5173'],
  logRetention: RetentionDays.TWO_WEEKS,
  isProduction: false,
};

const entra = {
  tenantId: '11111111-1111-1111-1111-111111111111',
  clientId: '22222222-2222-2222-2222-222222222222',
};

function synthesize(env: EnvironmentConfig = appEnv) {
  const app = new App();
  const stack = new ApiStack(app, 'TestApiStack', {
    appEnv: env,
    entra,
    env: { account: '123456789012', region: 'us-east-1' },
  });
  return { stack, template: Template.fromStack(stack) };
}

describe('ApiStack', () => {
  it('configures the JWT authorizer with the tenant issuer and client audience', () => {
    const { template } = synthesize();

    template.hasResourceProperties('AWS::ApiGatewayV2::Authorizer', {
      AuthorizerType: 'JWT',
      JwtConfiguration: {
        Issuer: `https://login.microsoftonline.com/${entra.tenantId}/v2.0`,
        Audience: [entra.clientId],
      },
    });
  });

  it('requires the access_as_user scope on the protected /api/me and /api/applications routes', () => {
    const { template } = synthesize();

    const routes = template.findResources('AWS::ApiGatewayV2::Route');
    const protectedRoutes = Object.values(routes).filter((route) =>
      ['GET /api/me', 'GET /api/applications', 'POST /api/applications'].includes(
        route.Properties.RouteKey,
      ),
    );

    expect(protectedRoutes).toHaveLength(3);
    for (const route of protectedRoutes) {
      expect(route.Properties.AuthorizationType).toBe('JWT');
      expect(route.Properties.AuthorizationScopes).toEqual(['access_as_user']);
    }
  });

  it('does not attach an authorizer to the public health route', () => {
    const { template } = synthesize();

    const routes = template.findResources('AWS::ApiGatewayV2::Route');
    const healthRoute = Object.values(routes).find(
      (route) => route.Properties.RouteKey === 'GET /health',
    );

    expect(healthRoute).toBeDefined();
    expect(healthRoute?.Properties.AuthorizationType).toBe('NONE');
  });

  it('restricts CORS to the configured origins, not a wildcard', () => {
    const { template } = synthesize();

    template.hasResourceProperties('AWS::ApiGatewayV2::Api', {
      CorsConfiguration: Match.objectLike({
        AllowOrigins: ['http://localhost:5173'],
      }),
    });

    const api = template.findResources('AWS::ApiGatewayV2::Api');
    const origins = Object.values(api)[0]?.Properties.CorsConfiguration.AllowOrigins;
    expect(origins).not.toContain('*');
  });

  it('includes the site domain in CORS when a custom domain is configured', () => {
    const { template } = synthesize({
      ...appEnv,
      name: 'prod',
      corsOrigins: ['https://app.example.com'],
      isProduction: true,
      domain: {
        hostedZoneName: 'example.com',
        siteDomainName: 'app.example.com',
        apiDomainName: 'api.example.com',
      },
    });

    template.hasResourceProperties('AWS::ApiGatewayV2::Api', {
      CorsConfiguration: Match.objectLike({
        AllowOrigins: Match.arrayWith(['https://app.example.com']),
      }),
    });
  });

  it('wires an API custom domain mapping when DomainConfig.apiDomainName is set', () => {
    // HostedZone.fromLookup needs context; provide a fake lookup result via context.
    const app = new App({
      context: {
        'hosted-zone:account=123456789012:domainName=example.com:region=us-east-1': {
          Id: 'Z1234567890ABC',
          Name: 'example.com.',
        },
      },
    });
    const stack = new ApiStack(app, 'TestApiStackWithDomain', {
      appEnv: {
        ...appEnv,
        name: 'prod',
        corsOrigins: ['https://app.example.com'],
        isProduction: true,
        domain: {
          hostedZoneName: 'example.com',
          siteDomainName: 'app.example.com',
          apiDomainName: 'api.example.com',
        },
      },
      entra,
      env: { account: '123456789012', region: 'us-east-1' },
    });
    const template = Template.fromStack(stack);

    template.hasResourceProperties('AWS::ApiGatewayV2::DomainName', {
      DomainName: 'api.example.com',
    });
    template.hasResourceProperties('AWS::CertificateManager::Certificate', {
      DomainName: 'api.example.com',
    });
    expect(stack.apiUrl).toBe('https://api.example.com');
  });

  it('grants each Lambda function only CloudWatch Logs and X-Ray permissions', () => {
    const { template } = synthesize();

    // Basic execution is the managed policy; Tracing.ACTIVE adds a minimal
    // inline X-Ray PutTraceSegments/PutTelemetryRecords policy. Access-log
    // write is a log-group resource policy, not an IAM role policy.
    template.resourceCountIs('AWS::IAM::Role', 3);
    template.resourceCountIs('AWS::IAM::Policy', 3);

    const roles = template.findResources('AWS::IAM::Role');
    for (const role of Object.values(roles)) {
      const managedPolicyArns = JSON.stringify(role.Properties.ManagedPolicyArns);
      expect(managedPolicyArns).toContain('AWSLambdaBasicExecutionRole');
    }

    const policies = template.findResources('AWS::IAM::Policy');
    for (const policy of Object.values(policies)) {
      const actions = JSON.stringify(policy.Properties.PolicyDocument.Statement);
      expect(actions).toContain('xray:PutTraceSegments');
      expect(actions).toContain('xray:PutTelemetryRecords');
      expect(actions).not.toMatch(/s3:|dynamodb:|secretsmanager:/i);
    }
  });

  it('enables active X-Ray tracing on every API Lambda', () => {
    const { template } = synthesize();

    template.resourcePropertiesCountIs(
      'AWS::Lambda::Function',
      { TracingConfig: { Mode: 'Active' } },
      3,
    );
  });

  it('creates a CloudWatch log group with retention for every function', () => {
    const { template } = synthesize();

    template.resourcePropertiesCountIs(
      'AWS::Logs::LogGroup',
      { RetentionInDays: 14 },
      4, // 3 function log groups + 1 API access log group
    );
  });

  it('creates alarms for Lambda errors, throttles, duration and API 5xx/latency', () => {
    const { template } = synthesize();

    const alarms = template.findResources('AWS::CloudWatch::Alarm');
    const alarmNames = Object.values(alarms).map((a) => a.Properties.AlarmName as string);

    expect(alarmNames.filter((n) => n.endsWith('-errors'))).toHaveLength(3);
    expect(alarmNames.filter((n) => n.endsWith('-throttles'))).toHaveLength(3);
    expect(alarmNames.filter((n) => n.endsWith('-duration'))).toHaveLength(3);
    expect(alarmNames).toContain('dev-app-api-5xx');
    expect(alarmNames).toContain('dev-app-api-latency');
  });
});
