import '@testing-library/jest-dom';

// Polyfill fetch for tests if not present
import { beforeEach } from 'vitest';

if (typeof globalThis.fetch === 'undefined') {
  // @ts-ignore
  globalThis.fetch = (...args: any[]) => Promise.resolve({ ok: true, json: async () => ({}) });
}

beforeEach(() => {
  // reset any global fetch mock installed by a previous test
  // @ts-ignore
  if (globalThis.fetch && (globalThis.fetch as any).mockReset) (globalThis.fetch as any).mockReset();
  // expose current fetch mock (if any) so wrapper can delegate to it
  try {
    if ((globalThis.fetch as any).mock) {
      (globalThis as any).__TEST_FETCH = globalThis.fetch;
    } else {
      (globalThis as any).__TEST_FETCH = undefined;
    }
  } catch {}
});

// Provide basic globals that some libraries rely on when running in Node
// (msw interceptors / undici Request parsing of relative URLs uses global location as base).
if (typeof (globalThis as any).location === 'undefined') {
  try {
    // prefer a real URL object if available
    (globalThis as any).location = { href: 'http://localhost/', origin: 'http://localhost' };
  } catch (e) {
    (globalThis as any).location = { href: 'http://localhost/', origin: 'http://localhost' };
  }
}

if (typeof (globalThis as any).window === 'undefined') (globalThis as any).window = globalThis;
if (typeof (globalThis as any).self === 'undefined') (globalThis as any).self = globalThis;

// Wrap the native/global fetch to normalize relative URLs to absolute ones.
// This prevents undici/msw from throwing on new Request('/path') in Node.
if (!(globalThis as any).__fetch_wrapped) {
  const nativeFetch = (globalThis as any).fetch;
  (globalThis as any).__originalFetch = nativeFetch;
  const wrapped = function (input: any, init?: any) {
    try {
      if (typeof input === 'string' && input.startsWith('/')) {
        const origin = (globalThis as any).location?.origin || 'http://localhost';
        input = origin + input;
      } else if (input && typeof input === 'object' && input.url && typeof input.url === 'string' && input.url.startsWith('/')) {
        const origin = (globalThis as any).location?.origin || 'http://localhost';
        input = new Request(origin + input.url, input as any);
      }
    } catch {}
    const testMock = (globalThis as any).__TEST_FETCH;
    if (typeof testMock === 'function' && testMock !== wrapped) {
      return testMock(input, init);
    }
    return nativeFetch(input, init);
  } as any;
  (globalThis as any).fetch = wrapped;
  (globalThis as any).__fetch_wrapped = true;
}

// Normalize the global Request constructor so code that does `new Request('/path')`
// works in Node tests (whatwg-url / undici require absolute URLs).
if (!(globalThis as any).__request_wrapped) {
  const OriginalRequest = (globalThis as any).Request;
  if (OriginalRequest) {
    (globalThis as any).__originalRequest = OriginalRequest;
    const WrappedRequest: any = function (input: any, init?: any) {
      try {
        if (typeof input === 'string' && input.startsWith('/')) {
          const origin = (globalThis as any).location?.origin || 'http://localhost';
          input = origin + input;
        } else if (input && typeof input === 'object' && typeof input.url === 'string' && input.url.startsWith('/')) {
          const origin = (globalThis as any).location?.origin || 'http://localhost';
          input = origin + input.url;
        }
      } catch (e) {
        // ignore and let OriginalRequest handle it
      }
      // preserve behavior of the original Request constructor
      return new OriginalRequest(input, init);
    };
    // Copy prototype so instanceof checks still work
    WrappedRequest.prototype = OriginalRequest.prototype;
    try {
      (globalThis as any).Request = WrappedRequest;
    } catch (e) {
      // some environments may not allow overwriting Request
    }
  }
  (globalThis as any).__request_wrapped = true;
}

// Provide a noop window.alert for jsdom environment so tests don't crash
// when UI code uses alert() for error messages.
try {
  if (typeof (globalThis as any).alert === 'undefined') {
    (globalThis as any).alert = (..._args: any[]) => { /* no-op in tests */ };
  }
} catch {}
