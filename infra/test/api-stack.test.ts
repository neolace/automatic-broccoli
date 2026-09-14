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

function synthesize() {
  const app = new App();
  const stack = new ApiStack(app, 'TestApiStack', {
    appEnv,
    entra,
    env: { account: '123456789012', region: 'us-east-1' },
  });
  return Template.fromStack(stack);
}

describe('ApiStack', () => {
  it('configures the JWT authorizer with the tenant issuer and client audience', () => {
    const template = synthesize();

    template.hasResourceProperties('AWS::ApiGatewayV2::Authorizer', {
      AuthorizerType: 'JWT',
      JwtConfiguration: {
        Issuer: `https://login.microsoftonline.com/${entra.tenantId}/v2.0`,
        Audience: [entra.clientId],
      },
    });
  });

  it('requires the access_as_user scope on the protected /api/me and /api/applications routes', () => {
    const template = synthesize();

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
    const template = synthesize();

    const routes = template.findResources('AWS::ApiGatewayV2::Route');
    const healthRoute = Object.values(routes).find(
      (route) => route.Properties.RouteKey === 'GET /health',
    );

    expect(healthRoute).toBeDefined();
    expect(healthRoute?.Properties.AuthorizationType).toBe('NONE');
  });

  it('restricts CORS to the configured origins, not a wildcard', () => {
    const template = synthesize();

    template.hasResourceProperties('AWS::ApiGatewayV2::Api', {
      CorsConfiguration: Match.objectLike({
        AllowOrigins: ['http://localhost:5173'],
      }),
    });

    const api = template.findResources('AWS::ApiGatewayV2::Api');
    const origins = Object.values(api)[0]?.Properties.CorsConfiguration.AllowOrigins;
    expect(origins).not.toContain('*');
  });

  it('grants each Lambda function only the AWS-managed basic execution policy', () => {
    const template = synthesize();

    // No custom inline policies exist: the reference handlers call no other
    // AWS service, so nothing beyond CloudWatch Logs is granted.
    template.resourceCountIs('AWS::IAM::Policy', 0);
    template.resourceCountIs('AWS::IAM::Role', 3);

    const roles = template.findResources('AWS::IAM::Role');
    for (const role of Object.values(roles)) {
      const managedPolicyArns = JSON.stringify(role.Properties.ManagedPolicyArns);
      expect(managedPolicyArns).toContain('AWSLambdaBasicExecutionRole');
    }
  });

  it('creates a CloudWatch log group with retention for every function', () => {
    const template = synthesize();

    template.resourcePropertiesCountIs(
      'AWS::Logs::LogGroup',
      { RetentionInDays: 14 },
      4, // 3 function log groups + 1 API access log group
    );
  });

  it('creates alarms for Lambda errors, throttles, duration and API 5xx/latency', () => {
    const template = synthesize();

    const alarms = template.findResources('AWS::CloudWatch::Alarm');
    const alarmNames = Object.values(alarms).map((a) => a.Properties.AlarmName as string);

    expect(alarmNames.filter((n) => n.endsWith('-errors'))).toHaveLength(3);
    expect(alarmNames.filter((n) => n.endsWith('-throttles'))).toHaveLength(3);
    expect(alarmNames.filter((n) => n.endsWith('-duration'))).toHaveLength(3);
    expect(alarmNames).toContain('dev-app-api-5xx');
    expect(alarmNames).toContain('dev-app-api-latency');
  });
});
