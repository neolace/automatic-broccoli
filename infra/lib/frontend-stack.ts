import { CfnOutput, Duration, RemovalPolicy, Stack, type StackProps } from 'aws-cdk-lib';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as targets from 'aws-cdk-lib/aws-route53-targets';
import * as s3 from 'aws-cdk-lib/aws-s3';
import type { Construct } from 'constructs';

import type { DomainConfig, EnvironmentConfig } from './config/environments';

export interface FrontendStackProps extends StackProps {
  readonly appEnv: EnvironmentConfig;
}

/**
 * The static delivery path: a private S3 bucket behind CloudFront with
 * Origin Access Control. Users never reach S3 directly -- see
 * docs/infrastructure.md.
 */
export class FrontendStack extends Stack {
  readonly bucket: s3.Bucket;
  readonly distribution: cloudfront.Distribution;
  readonly siteUrl: string;

  constructor(scope: Construct, id: string, props: FrontendStackProps) {
    super(scope, id, props);

    const { appEnv } = props;
    const removalPolicy = appEnv.isProduction ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY;

    this.bucket = new s3.Bucket(this, 'SiteBucket', {
      // Name intentionally omitted: CloudFormation generates a unique, unguessable name.
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      versioned: true,
      enforceSSL: true,
      removalPolicy,
      autoDeleteObjects: !appEnv.isProduction,
    });

    const responseHeadersPolicy = new cloudfront.ResponseHeadersPolicy(this, 'SecurityHeaders', {
      responseHeadersPolicyName: `${appEnv.name}-app-security-headers`,
      securityHeadersBehavior: {
        strictTransportSecurity: {
          override: true,
          accessControlMaxAge: Duration.days(365),
          includeSubdomains: true,
          preload: true,
        },
        contentTypeOptions: { override: true },
        referrerPolicy: {
          override: true,
          referrerPolicy: cloudfront.HeadersReferrerPolicy.STRICT_ORIGIN_WHEN_CROSS_ORIGIN,
        },
        frameOptions: {
          override: true,
          frameOption: cloudfront.HeadersFrameOption.DENY,
        },
        contentSecurityPolicy: {
          override: true,
          // Tuned for MSAL redirect flows against Entra; tighten further once
          // the production API/CDN domains are final -- see docs/security.md.
          contentSecurityPolicy: [
            "default-src 'self'",
            "script-src 'self'",
            "style-src 'self' 'unsafe-inline'",
            "img-src 'self' data:",
            "connect-src 'self' https://login.microsoftonline.com",
            "frame-src 'self' https://login.microsoftonline.com",
            "frame-ancestors 'none'",
            "base-uri 'none'",
            "object-src 'none'",
          ].join('; '),
        },
      },
      customHeadersBehavior: {
        customHeaders: [
          {
            header: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), payment=()',
            override: true,
          },
        ],
      },
    });

    const domainSetup = this.buildDomainSetup(props.appEnv.domain);

    this.distribution = new cloudfront.Distribution(this, 'Distribution', {
      comment: `${appEnv.name} application frontend`,
      defaultRootObject: 'index.html',
      domainNames: domainSetup?.domainNames,
      certificate: domainSetup?.certificate,
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(this.bucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        responseHeadersPolicy,
        compress: true,
      },
      // SPA routing: unknown paths resolve to index.html so client-side routes
      // survive a browser refresh, without masking genuine 403s from S3 policy.
      errorResponses: [
        {
          httpStatus: 403,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
          ttl: Duration.seconds(0),
        },
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
          ttl: Duration.seconds(0),
        },
      ],
      // Only meaningful with a custom certificate; the shared CloudFront
      // default certificate fixes its own (TLSv1) security policy.
      minimumProtocolVersion: domainSetup
        ? cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021
        : undefined,
      httpVersion: cloudfront.HttpVersion.HTTP2_AND_3,
      enableLogging: appEnv.isProduction,
    });

    if (domainSetup) {
      new route53.ARecord(this, 'SiteAliasRecord', {
        zone: domainSetup.hostedZone,
        recordName: props.appEnv.domain!.siteDomainName,
        target: route53.RecordTarget.fromAlias(new targets.CloudFrontTarget(this.distribution)),
      });
      this.siteUrl = `https://${props.appEnv.domain!.siteDomainName}`;
    } else {
      this.siteUrl = `https://${this.distribution.distributionDomainName}`;
    }

    new CfnOutput(this, 'SiteBucketName', { value: this.bucket.bucketName });
    new CfnOutput(this, 'DistributionId', { value: this.distribution.distributionId });
    new CfnOutput(this, 'SiteUrl', { value: this.siteUrl });
  }

  /**
   * Custom domain, ACM certificate (CloudFront requires us-east-1) and
   * Route 53 hosted zone lookup. Returns undefined when no domain is
   * configured for this environment, in which case the generated
   * `*.cloudfront.net` domain is used -- see infra/lib/config/environments.ts.
   */
  private buildDomainSetup(
    domain: DomainConfig | undefined,
  ):
    | { domainNames: string[]; certificate: acm.ICertificate; hostedZone: route53.IHostedZone }
    | undefined {
    if (!domain) return undefined;

    const hostedZone = route53.HostedZone.fromLookup(this, 'HostedZone', {
      domainName: domain.hostedZoneName,
    });

    // CloudFront requires the certificate to exist in us-east-1. This stack
    // must therefore be deployed with env.region === 'us-east-1' whenever a
    // custom domain is configured (the default region in environments.ts).
    const certificate = new acm.Certificate(this, 'SiteCertificate', {
      domainName: domain.siteDomainName,
      validation: acm.CertificateValidation.fromDns(hostedZone),
    });

    return { domainNames: [domain.siteDomainName], certificate, hostedZone };
  }
}
