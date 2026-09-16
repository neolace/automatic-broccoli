import type * as S3Module from '@aws-sdk/client-s3';
import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const send = vi.fn();

vi.mock('@aws-sdk/client-s3', async () => {
  const actual = await vi.importActual<typeof S3Module>('@aws-sdk/client-s3');
  class MockS3Client {
    send = send;
  }
  return { ...actual, S3Client: MockS3Client };
});

process.env.SITE_BUCKET_NAME = 'test-site-bucket';
process.env.API_ORIGIN = 'https://api.example.com';

const { handler, buildSecurityHeaders } = await import('../lib/site-handler/index');
const { NoSuchKey } = await import('@aws-sdk/client-s3');

function event(rawPath: string): APIGatewayProxyEventV2 {
  return { rawPath } as APIGatewayProxyEventV2;
}

function objectResult(bytes: Uint8Array, contentType: string) {
  return { ContentType: contentType, Body: { transformToByteArray: async () => bytes } };
}

function sentKey(): unknown {
  return send.mock.calls[0]![0].input.Key;
}

describe('site-handler', () => {
  beforeEach(() => {
    send.mockReset();
    process.env.API_ORIGIN = 'https://api.example.com';
  });

  it('serves index.html for the root path', async () => {
    send.mockResolvedValueOnce(objectResult(Buffer.from('<html>root</html>'), 'text/html'));

    const response = await handler(event('/'));

    expect(response.statusCode).toBe(200);
    expect(sentKey()).toBe('index.html');
  });

  it('serves extension-less client-side routes as index.html without caching', async () => {
    send.mockResolvedValueOnce(objectResult(Buffer.from('<html>spa</html>'), 'text/html'));

    const response = await handler(event('/dashboard/settings'));

    expect(sentKey()).toBe('index.html');
    expect(response.headers?.['Cache-Control']).toBe('no-cache');
  });

  it('maps a path with a file extension straight to the matching S3 key with immutable caching', async () => {
    send.mockResolvedValueOnce(
      objectResult(Buffer.from('console.log(1)'), 'application/javascript'),
    );

    const response = await handler(event('/assets/main-abc123.js'));

    expect(sentKey()).toBe('assets/main-abc123.js');
    expect(response.headers?.['Cache-Control']).toBe('public, max-age=31536000, immutable');
    expect(response.headers?.['Content-Type']).toBe('application/javascript');
  });

  it('returns a genuine 404 when a real asset is missing, without masking it as index.html', async () => {
    send.mockRejectedValueOnce(new NoSuchKey({ message: 'not found', $metadata: {} }));

    const response = await handler(event('/assets/missing.png'));

    expect(response.statusCode).toBe(404);
  });

  it('attaches the security response headers to every response', async () => {
    send.mockResolvedValueOnce(objectResult(Buffer.from('<html/>'), 'text/html'));

    const response = await handler(event('/'));

    expect(response.headers).toMatchObject({
      'Strict-Transport-Security': expect.stringContaining('max-age=31536000'),
      'X-Frame-Options': 'DENY',
      'Content-Security-Policy': expect.stringContaining("frame-ancestors 'none'"),
      'Permissions-Policy': expect.stringContaining('camera=()'),
    });
  });

  it('includes the configured API host in CSP connect-src', async () => {
    send.mockResolvedValueOnce(objectResult(Buffer.from('<html/>'), 'text/html'));

    const response = await handler(event('/'));
    const csp = response.headers?.['Content-Security-Policy'] as string;

    expect(csp).toContain('connect-src');
    expect(csp).toContain('https://api.example.com');
    expect(csp).toContain('https://login.microsoftonline.com');
  });

  it('buildSecurityHeaders uses the provided API origin without a trailing slash', () => {
    const headers = buildSecurityHeaders('https://api.dev.example.com/');
    expect(headers['Content-Security-Policy']).toContain('https://api.dev.example.com');
    expect(headers['Content-Security-Policy']).not.toContain('https://api.dev.example.com/');
  });
});
