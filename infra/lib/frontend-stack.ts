import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { CfnOutput, Duration, RemovalPolicy, Stack, type StackProps } from 'aws-cdk-lib';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import { DomainName, HttpApi, HttpMethod, type IDomainName } from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as targets from 'aws-cdk-lib/aws-route53-targets';
import * as s3 from 'aws-cdk-lib/aws-s3';
import type { Construct } from 'constructs';

import type { DomainConfig, EnvironmentConfig } from './config/environments';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export interface FrontendStackProps extends StackProps {
  readonly appEnv: EnvironmentConfig;
  /**
   * Public HTTPS origin of the API (custom domain or execute-api URL). Wired
   * into the site Lambda as `API_ORIGIN` so CSP `connect-src` allows the SPA
   * to call the API -- see docs/security.md.
   */
  readonly apiOrigin: string;
}

/**
 * The static delivery path: a private S3 bucket that only a Lambda function
 * can read, fronted by an API Gateway HTTP API. The Lambda serves SPA
 * routing (extension-less paths resolve to index.html) and the response
 * security headers that CloudFront's ResponseHeadersPolicy used to attach --
 * see docs/infrastructure.md.
 */
export class FrontendStack extends Stack {
  readonly bucket: s3.Bucket;
  readonly siteFunction: lambda.Function;
  readonly httpApi: HttpApi;
  readonly siteUrl: string;

  constructor(scope: Construct, id: string, props: FrontendStackProps) {
    super(scope, id, props);

    const { appEnv, apiOrigin } = props;
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

    const siteFunctionLogGroup = new logs.LogGroup(this, 'SiteFunctionLogGroup', {
      logGroupName: `/aws/lambda/${appEnv.name}-app-site`,
      retention: appEnv.logRetention,
      removalPolicy,
    });

    this.siteFunction = new NodejsFunction(this, 'SiteFunction', {
      functionName: `${appEnv.name}-app-site`,
      entry: path.join(__dirname, 'site-handler', 'index.ts'),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_24_X,
      memorySize: 256,
      timeout: Duration.seconds(10),
      environment: {
        SITE_BUCKET_NAME: this.bucket.bucketName,
        API_ORIGIN: apiOrigin.replace(/\/$/, ''),
      },
      logGroup: siteFunctionLogGroup,
    });
    this.bucket.grantRead(this.siteFunction);

    const domainSetup = this.buildDomainSetup(props.appEnv.domain);

    this.httpApi = new HttpApi(this, 'HttpApi', {
      apiName: `${appEnv.name}-app-frontend`,
      description: 'Serves the built SPA from the private site bucket via a Lambda integration.',
      defaultDomainMapping: domainSetup ? { domainName: domainSetup.domainName } : undefined,
    });

    // A greedy {proxy+} route does not match the bare root path, so it needs
    // its own route alongside the catch-all for every other path.
    const siteIntegration = new HttpLambdaIntegration('SiteIntegration', this.siteFunction);
    this.httpApi.addRoutes({ path: '/', methods: [HttpMethod.GET], integration: siteIntegration });
    this.httpApi.addRoutes({
      path: '/{proxy+}',
      methods: [HttpMethod.GET],
      integration: siteIntegration,
    });

    if (domainSetup) {
      new route53.ARecord(this, 'SiteAliasRecord', {
        zone: domainSetup.hostedZone,
        recordName: props.appEnv.domain!.siteDomainName,
        target: route53.RecordTarget.fromAlias(
          new targets.ApiGatewayv2DomainProperties(
            domainSetup.domainName.regionalDomainName,
            domainSetup.domainName.regionalHostedZoneId,
          ),
        ),
      });
      this.siteUrl = `https://${props.appEnv.domain!.siteDomainName}`;
    } else {
      this.siteUrl = this.httpApi.apiEndpoint;
    }

    new CfnOutput(this, 'SiteBucketName', { value: this.bucket.bucketName });
    new CfnOutput(this, 'SiteFunctionName', { value: this.siteFunction.functionName });
    new CfnOutput(this, 'SiteUrl', { value: this.siteUrl });
  }

  /**
   * Custom domain, regional ACM certificate and Route 53 hosted zone lookup.
   * Returns undefined when no domain is configured for this environment, in
   * which case the generated `*.execute-api.*.amazonaws.com` domain is used
   * -- see infra/lib/config/environments.ts. Unlike CloudFront, API Gateway
   * regional domains take a certificate in the stack's own region, not
   * necessarily us-east-1.
   */
  private buildDomainSetup(
    domain: DomainConfig | undefined,
  ): { domainName: IDomainName; hostedZone: route53.IHostedZone } | undefined {
    if (!domain) return undefined;

    const hostedZone = route53.HostedZone.fromLookup(this, 'HostedZone', {
      domainName: domain.hostedZoneName,
    });

    const certificate = new acm.Certificate(this, 'SiteCertificate', {
      domainName: domain.siteDomainName,
      validation: acm.CertificateValidation.fromDns(hostedZone),
    });

    const domainName = new DomainName(this, 'SiteDomainName', {
      domainName: domain.siteDomainName,
      certificate,
    });

    return { domainName, hostedZone };
  }
}
