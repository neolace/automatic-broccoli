import { execFileSync } from 'node:child_process';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import * as lambda from 'aws-cdk-lib/aws-lambda';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Root of the C# Lambda project (apps/api), relative to this file. */
export const API_PROJECT_ROOT = path.resolve(__dirname, '..', '..', 'apps', 'api');

function publishArgs(outputDir: string): string[] {
  return [
    'publish',
    'src/App.Api/App.Api.csproj',
    '-c',
    'Release',
    '-o',
    outputDir,
    '--self-contained',
    'false',
  ];
}

function hasLocalDotnetSdk(): boolean {
  try {
    execFileSync('dotnet', ['--version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Packages the single App.Api assembly once. All three handlers
 * (health/me/application) are published into the same output directory and
 * are referenced by different `Assembly::Namespace.Type::Method` handler
 * strings on their respective Lambda functions -- see docs/deployment.md.
 *
 * Builds locally with the installed .NET 10 SDK when available (fast inner
 * loop); otherwise falls back to the official Lambda build image so CI and
 * developers without a local SDK still get a reproducible build.
 */
export function dotnetApiCode(): lambda.Code {
  return lambda.Code.fromAsset(API_PROJECT_ROOT, {
    bundling: {
      image: lambda.Runtime.DOTNET_10.bundlingImage,
      command: ['bash', '-c', `dotnet ${publishArgs('/asset-output').join(' ')}`],
      local: {
        tryBundle(outputDir: string): boolean {
          if (!hasLocalDotnetSdk()) return false;

          execFileSync('dotnet', publishArgs(outputDir), {
            cwd: API_PROJECT_ROOT,
            stdio: 'inherit',
          });
          return true;
        },
      },
    },
  });
}
