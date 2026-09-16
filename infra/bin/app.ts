#!/usr/bin/env node
import { App } from 'aws-cdk-lib';

import { ApiStack } from '../lib/api-stack';
import {
  type EnvironmentName,
  loadEntraConfig,
  loadEnvironmentConfig,
} from '../lib/config/environments';
import { FrontendStack } from '../lib/frontend-stack';
import { ObservabilityStack } from '../lib/observability-stack';

const app = new App();

const environmentName = (app.node.tryGetContext('environment') ??
  process.env.ENVIRONMENT_NAME ??
  'dev') as EnvironmentName;

const appEnv = loadEnvironmentConfig(environmentName);
const entra = loadEntraConfig();

const env = { account: appEnv.account, region: appEnv.region };
const stackPrefix = `${appEnv.name}-app`;

new FrontendStack(app, `${stackPrefix}-frontend`, { appEnv, env });

const apiStack = new ApiStack(app, `${stackPrefix}-api`, { appEnv, entra, env });

new ObservabilityStack(app, `${stackPrefix}-observability`, {
  appEnv,
  httpApi: apiStack.httpApi,
  functions: apiStack.functions,
  env,
});
