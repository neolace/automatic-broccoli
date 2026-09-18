import { CfnOutput, Duration, RemovalPolicy, Stack, type StackProps } from 'aws-cdk-lib';
import {
  CorsHttpMethod,
  DomainName,
  HttpApi,
  HttpMethod,
  type CfnStage,
  type IDomainName,
} from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpJwtAuthorizer } from 'aws-cdk-lib/aws-apigatewayv2-authorizers';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as targets from 'aws-cdk-lib/aws-route53-targets';
import { API_SCOPE_NAME, apiScope, entraIssuer } from '@app/shared';
import type { Construct } from 'constructs';

import { dotnetApiCode } from './api-lambda-bundling';
import {
  resolveCorsOrigins,
  type DomainConfig,
  type EntraConfig,
  type EnvironmentConfig,
} from './config/environments';

export interface ApiStackProps extends StackProps {
  readonly appEnv: EnvironmentConfig;
  readonly entra: EntraConfig;
}

/**
 * The AWS trust boundary: an HTTP API with a native Entra JWT authorizer in
 * front of the C# Lambda handlers. API Gateway validates signature, issuer,
 * audience and the `access_as_user` scope before any handler runs -- see
 * docs/api.md and docs/security.md.
 */
export class ApiStack extends Stack {
  readonly httpApi: HttpApi;
  readonly apiUrl: string;
  readonly functions: lambda.Function[];

  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);

    const { appEnv, entra } = props;

    const code = dotnetApiCode();
    const removalPolicy = appEnv.isProduction ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY;

    // Each handler is a thin adapter (see apps/api/src/App.Api/Handlers); all
    // three share one published assembly and one least-privilege execution
    // role model -- CloudWatch Logs + X-Ray, no other AWS permissions granted.
    const createFunction = (id: string, name: string, handler: string): lambda.Function => {
      const logGroup = new logs.LogGroup(this, `${id}LogGroup`, {
        logGroupName: `/aws/lambda/${name}`,
        retention: appEnv.logRetention,
        removalPolicy,
      });

      return new lambda.Function(this, id, {
        code,
        runtime: lambda.Runtime.DOTNET_10,
        memorySize: 256,
        timeout: Duration.seconds(10),
        environment: { ENVIRONMENT_NAME: appEnv.name },
        functionName: name,
        handler,
        logGroup,
        tracing: lambda.Tracing.ACTIVE,
      });
    };

    const healthFunction = createFunction(
      'HealthFunction',
      `${appEnv.name}-app-api-health`,
      'App.Api::App.Api.Handlers.HealthFunction::FunctionHandler',
    );

    const meFunction = createFunction(
      'MeFunction',
      `${appEnv.name}-app-api-me`,
      'App.Api::App.Api.Handlers.MeFunction::FunctionHandler',
    );

    const applicationFunction = createFunction(
      'ApplicationFunction',
      `${appEnv.name}-app-api-application`,
      'App.Api::App.Api.Handlers.ApplicationFunction::FunctionHandler',
    );

    const issuer = entraIssuer(entra.tenantId);
    const authorizer = new HttpJwtAuthorizer('EntraJwtAuthorizer', issuer, {
      jwtAudience: [entra.clientId],
    });
    const requiredScope = apiScope(entra.clientId).split('/').pop() ?? API_SCOPE_NAME;

    const domainSetup = this.buildDomainSetup(appEnv.domain);

    this.httpApi = new HttpApi(this, 'HttpApi', {
      apiName: `${appEnv.name}-app-api`,
      description:
        'API Gateway HTTP API validating Microsoft Entra access tokens before invoking Lambda.',
      corsPreflight: {
        allowOrigins: resolveCorsOrigins(appEnv),
        allowMethods: [CorsHttpMethod.GET, CorsHttpMethod.POST, CorsHttpMethod.OPTIONS],
        allowHeaders: ['authorization', 'content-type', 'x-correlation-id'],
        maxAge: Duration.hours(1),
      },
      defaultDomainMapping: domainSetup ? { domainName: domainSetup.domainName } : undefined,
    });

    // Public health check: no authorizer, and it must stay free of
    // configuration, dependency or environment details (see docs/api.md).
    this.httpApi.addRoutes({
      path: '/health',
      methods: [HttpMethod.GET],
      integration: new HttpLambdaIntegration('HealthIntegration', healthFunction),
    });

    this.httpApi.addRoutes({
      path: '/api/me',
      methods: [HttpMethod.GET],
      integration: new HttpLambdaIntegration('MeIntegration', meFunction),
      authorizer,
      authorizationScopes: [requiredScope],
    });

    this.httpApi.addRoutes({
      path: '/api/applications',
      methods: [HttpMethod.GET, HttpMethod.POST],
      integration: new HttpLambdaIntegration('ApplicationIntegration', applicationFunction),
      authorizer,
      authorizationScopes: [requiredScope],
    });

    // Access logs: request id, route, status and latency, but never the
    // Authorization header or claims -- see docs/observability.md.
    // HTTP API access-log format cannot read arbitrary request headers, so
    // correlation ids live in Lambda structured logs (tied via requestId).
    const accessLogGroup = new logs.LogGroup(this, 'AccessLogGroup', {
      logGroupName: `/aws/apigateway/${appEnv.name}-app-api-access-logs`,
      retention: appEnv.logRetention,
      removalPolicy,
    });
    accessLogGroup.grantWrite(new iam.ServicePrincipal('apigateway.amazonaws.com'));

    const defaultStage = this.httpApi.defaultStage?.node.defaultChild as CfnStage | undefined;
    if (defaultStage) {
      defaultStage.accessLogSettings = {
        destinationArn: accessLogGroup.logGroupArn,
        format: JSON.stringify({
          requestId: '$context.requestId',
          route: '$context.routeKey',
          method: '$context.httpMethod',
          status: '$context.status',
          integrationStatus: '$context.integrationStatus',
          integrationLatencyMs: '$context.integrationLatency',
          totalLatencyMs: '$context.responseLatency',
          authorizerError: '$context.authorizer.error',
        }),
      };
      defaultStage.defaultRouteSettings = {
        throttlingBurstLimit: 100,
        throttlingRateLimit: 50,
      };
    }

    if (domainSetup) {
      new route53.ARecord(this, 'ApiAliasRecord', {
        zone: domainSetup.hostedZone,
        recordName: appEnv.domain!.apiDomainName,
        target: route53.RecordTarget.fromAlias(
          new targets.ApiGatewayv2DomainProperties(
            domainSetup.domainName.regionalDomainName,
            domainSetup.domainName.regionalHostedZoneId,
          ),
        ),
      });
      this.apiUrl = `https://${appEnv.domain!.apiDomainName}`;
    } else {
      this.apiUrl = this.httpApi.apiEndpoint;
    }

    this.functions = [healthFunction, meFunction, applicationFunction];

    this.addAlarms(this.functions, appEnv);

    new CfnOutput(this, 'ApiUrl', { value: this.apiUrl });
  }

  /**
   * Custom API domain, regional ACM certificate and Route 53 alias -- mirrors
   * the frontend stack path so `DomainConfig.apiDomainName` is fully wired
   * rather than dead configuration. When omitted, callers use the generated
   * execute-api URL.
   */
  private buildDomainSetup(
    domain: DomainConfig | undefined,
  ): { domainName: IDomainName; hostedZone: route53.IHostedZone } | undefined {
    if (!domain) return undefined;

    const hostedZone = route53.HostedZone.fromLookup(this, 'HostedZone', {
      domainName: domain.hostedZoneName,
    });

    const certificate = new acm.Certificate(this, 'ApiCertificate', {
      domainName: domain.apiDomainName,
      validation: acm.CertificateValidation.fromDns(hostedZone),
    });

    const domainName = new DomainName(this, 'ApiDomainName', {
      domainName: domain.apiDomainName,
      certificate,
    });

    return { domainName, hostedZone };
  }

  private addAlarms(functions: lambda.Function[], appEnv: EnvironmentConfig): void {
    for (const fn of functions) {
      new cloudwatch.Alarm(this, `${fn.node.id}ErrorsAlarm`, {
        alarmName: `${appEnv.name}-${fn.node.id}-errors`,
        metric: fn.metricErrors({ period: Duration.minutes(5) }),
        threshold: 1,
        evaluationPeriods: 1,
        comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      });

      new cloudwatch.Alarm(this, `${fn.node.id}ThrottlesAlarm`, {
        alarmName: `${appEnv.name}-${fn.node.id}-throttles`,
        metric: fn.metricThrottles({ period: Duration.minutes(5) }),
        threshold: 1,
        evaluationPeriods: 1,
        comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      });

      new cloudwatch.Alarm(this, `${fn.node.id}DurationAlarm`, {
        alarmName: `${appEnv.name}-${fn.node.id}-duration`,
        metric: fn.metricDuration({ period: Duration.minutes(5), statistic: 'p99' }),
        threshold: Duration.seconds(8).toMilliseconds(),
        evaluationPeriods: 3,
        comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      });
    }

    new cloudwatch.Alarm(this, 'ApiServerErrorAlarm', {
      alarmName: `${appEnv.name}-app-api-5xx`,
      metric: this.httpApi.metricServerError({ period: Duration.minutes(5) }),
      threshold: 1,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    new cloudwatch.Alarm(this, 'ApiLatencyAlarm', {
      alarmName: `${appEnv.name}-app-api-latency`,
      metric: this.httpApi.metricLatency({ period: Duration.minutes(5), statistic: 'p99' }),
      threshold: Duration.seconds(3).toMilliseconds(),
      evaluationPeriods: 3,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
  }
}
