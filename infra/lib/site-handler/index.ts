import { GetObjectCommand, NoSuchKey, S3Client } from '@aws-sdk/client-s3';
import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from 'aws-lambda';

const bucketName = process.env.SITE_BUCKET_NAME as string;
const s3 = new S3Client({});

/**
 * Security headers previously attached by CloudFront's ResponseHeadersPolicy.
 * CSP is tuned for MSAL redirect flows against Entra -- see docs/security.md.
 * `connect-src` includes the API origin from `API_ORIGIN` so the SPA can call
 * the configured API host (not only `'self'`).
 */
export function buildSecurityHeaders(apiOrigin = process.env.API_ORIGIN): Record<string, string> {
  const normalizedApiOrigin = apiOrigin?.trim().replace(/\/$/, '');
  const connectSrc = ["'self'", 'https://login.microsoftonline.com'];
  if (normalizedApiOrigin) {
    connectSrc.push(normalizedApiOrigin);
  }

  return {
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'X-Frame-Options': 'DENY',
    'Content-Security-Policy': [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data:",
      `connect-src ${connectSrc.join(' ')}`,
      "frame-src 'self' https://login.microsoftonline.com",
      "frame-ancestors 'none'",
      "base-uri 'none'",
      "object-src 'none'",
    ].join('; '),
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
  };
}

async function getObject(key: string) {
  const result = await s3.send(new GetObjectCommand({ Bucket: bucketName, Key: key }));
  const body = await result.Body!.transformToByteArray();
  return { body, contentType: result.ContentType ?? 'application/octet-stream' };
}

/**
 * Serves the SPA build from the private site bucket, replacing CloudFront's
 * origin + SPA error-response routing. Requests for paths with a file
 * extension (e.g. `/assets/main-abc123.js`, `/favicon.svg`) map 1:1 to the
 * matching S3 object; a missing one is a genuine 404. Extension-less paths
 * (client-side routes such as `/dashboard`) always resolve to `index.html`
 * so they survive a browser refresh -- see docs/infrastructure.md.
 */
export async function handler(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyStructuredResultV2> {
  const requestPath = event.rawPath || '/';
  const lastSegment = requestPath.slice(requestPath.lastIndexOf('/') + 1);
  const hasExtension = lastSegment.includes('.');
  const key = requestPath === '/' || !hasExtension ? 'index.html' : requestPath.replace(/^\/+/, '');
  const securityHeaders = buildSecurityHeaders();

  try {
    const { body, contentType } = await getObject(key);
    const isImmutableAsset = key !== 'index.html';

    return {
      statusCode: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': isImmutableAsset ? 'public, max-age=31536000, immutable' : 'no-cache',
        ...securityHeaders,
      },
      body: Buffer.from(body).toString('base64'),
      isBase64Encoded: true,
    };
  } catch (error) {
    if (error instanceof NoSuchKey && key !== 'index.html') {
      return {
        statusCode: 404,
        headers: { 'Content-Type': 'text/plain', ...securityHeaders },
        body: 'Not found',
      };
    }

    console.error('Failed to serve', { key, error });
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'text/plain', ...securityHeaders },
      body: 'Internal server error',
    };
  }
}
