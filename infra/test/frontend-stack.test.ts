import { App } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { RetentionDays } from 'aws-cdk-lib/aws-logs';
import { describe, it } from 'vitest';

import type { EnvironmentConfig } from '../lib/config/environments';
import { FrontendStack } from '../lib/frontend-stack';

const appEnv: EnvironmentConfig = {
  name: 'dev',
  region: 'us-east-1',
  corsOrigins: ['http://localhost:5173'],
  logRetention: RetentionDays.TWO_WEEKS,
  isProduction: false,
};

function synthesize() {
  const app = new App();
  const stack = new FrontendStack(app, 'TestFrontendStack', {
    appEnv,
    env: { account: '123456789012', region: 'us-east-1' },
  });
  return Template.fromStack(stack);
}

describe('FrontendStack', () => {
  it('blocks all public access to the site bucket', () => {
    const template = synthesize();

    template.hasResourceProperties('AWS::S3::Bucket', {
      PublicAccessBlockConfiguration: {
        BlockPublicAcls: true,
        BlockPublicPolicy: true,
        IgnorePublicAcls: true,
        RestrictPublicBuckets: true,
      },
    });
  });

  it('enables versioning and default encryption on the site bucket', () => {
    const template = synthesize();

    template.hasResourceProperties('AWS::S3::Bucket', {
      VersioningConfiguration: { Status: 'Enabled' },
      BucketEncryption: Match.objectLike({
        ServerSideEncryptionConfiguration: Match.arrayWith([
          Match.objectLike({
            ServerSideEncryptionByDefault: Match.objectLike({ SSEAlgorithm: 'AES256' }),
          }),
        ]),
      }),
    });
  });

  it('grants the site function read-only access to the bucket and nothing else', () => {
    const template = synthesize();

    template.hasResourceProperties(
      'AWS::IAM::Policy',
      Match.objectLike({
        PolicyDocument: Match.objectLike({
          Statement: Match.arrayWith([
            Match.objectLike({
              Action: Match.arrayWith(['s3:GetObject*']),
              Effect: 'Allow',
            }),
          ]),
        }),
      }),
    );
  });

  it('routes both the root path and every other path to the site Lambda over HTTP API', () => {
    const template = synthesize();

    template.resourceCountIs('AWS::ApiGatewayV2::Api', 1);
    template.hasResourceProperties('AWS::ApiGatewayV2::Route', { RouteKey: 'GET /' });
    template.hasResourceProperties('AWS::ApiGatewayV2::Route', { RouteKey: 'GET /{proxy+}' });
    template.hasResourceProperties('AWS::ApiGatewayV2::Integration', {
      IntegrationType: 'AWS_PROXY',
      PayloadFormatVersion: '2.0',
    });
  });

  it('gives the site Lambda function a name and the bucket name as an environment variable', () => {
    const template = synthesize();

    template.hasResourceProperties('AWS::Lambda::Function', {
      FunctionName: `${appEnv.name}-app-site`,
      Environment: Match.objectLike({
        Variables: Match.objectLike({ SITE_BUCKET_NAME: Match.anyValue() }),
      }),
    });
  });
});
