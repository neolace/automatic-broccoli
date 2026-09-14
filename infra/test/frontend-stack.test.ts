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

  it('serves the bucket only through CloudFront with an Origin Access Control', () => {
    const template = synthesize();

    template.resourceCountIs('AWS::CloudFront::OriginAccessControl', 1);
    template.hasResourceProperties(
      'AWS::CloudFront::OriginAccessControl',
      Match.objectLike({
        OriginAccessControlConfig: Match.objectLike({ SigningBehavior: 'always' }),
      }),
    );
  });

  it('redirects HTTP to HTTPS', () => {
    const template = synthesize();

    template.hasResourceProperties('AWS::CloudFront::Distribution', {
      DistributionConfig: Match.objectLike({
        DefaultCacheBehavior: Match.objectLike({ ViewerProtocolPolicy: 'redirect-to-https' }),
      }),
    });
  });

  it('routes SPA client-side paths (403/404) back to index.html without caching the fallback', () => {
    const template = synthesize();

    template.hasResourceProperties('AWS::CloudFront::Distribution', {
      DistributionConfig: Match.objectLike({
        CustomErrorResponses: Match.arrayWith([
          Match.objectLike({ ErrorCode: 403, ResponseCode: 200, ResponsePagePath: '/index.html' }),
          Match.objectLike({ ErrorCode: 404, ResponseCode: 200, ResponsePagePath: '/index.html' }),
        ]),
      }),
    });
  });

  it('attaches a response headers policy with HSTS, a restrictive CSP and no frame embedding', () => {
    const template = synthesize();

    template.hasResourceProperties('AWS::CloudFront::ResponseHeadersPolicy', {
      ResponseHeadersPolicyConfig: Match.objectLike({
        SecurityHeadersConfig: Match.objectLike({
          StrictTransportSecurity: Match.objectLike({ Override: true }),
          FrameOptions: Match.objectLike({ FrameOption: 'DENY', Override: true }),
          ContentSecurityPolicy: Match.objectLike({
            ContentSecurityPolicy: Match.stringLikeRegexp("frame-ancestors 'none'"),
          }),
        }),
      }),
    });
  });
});
