/** Header used to propagate a request correlation identifier end to end. */
export const CORRELATION_ID_HEADER = 'x-correlation-id';

const CORRELATION_ID_PATTERN = /^[A-Za-z0-9._:-]{8,128}$/;

/**
 * A correlation ID is accepted from the client only when it is short and made of
 * safe characters, so an attacker cannot use it to inject content into logs.
 */
export function isValidCorrelationId(value: unknown): value is string {
  return typeof value === 'string' && CORRELATION_ID_PATTERN.test(value);
}
