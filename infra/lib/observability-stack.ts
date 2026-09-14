import { Stack, type StackProps } from 'aws-cdk-lib';
import type { HttpApi } from 'aws-cdk-lib/aws-apigatewayv2';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import type * as lambda from 'aws-cdk-lib/aws-lambda';
import type { Construct } from 'constructs';

import type { EnvironmentConfig } from './config/environments';

export interface ObservabilityStackProps extends StackProps {
  readonly appEnv: EnvironmentConfig;
  readonly httpApi: HttpApi;
  readonly functions: lambda.Function[];
}

/**
 * A single dashboard answering "is the service healthy, what failed, and
 * where" without opening individual log groups -- see docs/observability.md.
 * Alarms live alongside the resources they protect (ApiStack); this stack
 * only visualises trends.
 */
export class ObservabilityStack extends Stack {
  constructor(scope: Construct, id: string, props: ObservabilityStackProps) {
    super(scope, id, props);

    const { appEnv, httpApi, functions } = props;

    const dashboard = new cloudwatch.Dashboard(this, 'Dashboard', {
      dashboardName: `${appEnv.name}-app-observability`,
    });

    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'API requests and errors',
        left: [httpApi.metricCount(), httpApi.metricClientError(), httpApi.metricServerError()],
        width: 12,
      }),
      new cloudwatch.GraphWidget({
        title: 'API latency (p99)',
        left: [httpApi.metricLatency({ statistic: 'p99' })],
        width: 12,
      }),
    );

    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'Lambda invocations',
        left: functions.map((fn) => fn.metricInvocations()),
        width: 12,
      }),
      new cloudwatch.GraphWidget({
        title: 'Lambda errors and throttles',
        left: functions.map((fn) => fn.metricErrors()),
        right: functions.map((fn) => fn.metricThrottles()),
        width: 12,
      }),
    );

    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'Lambda duration (p99)',
        left: functions.map((fn) => fn.metricDuration({ statistic: 'p99' })),
        width: 24,
      }),
    );
  }
}
