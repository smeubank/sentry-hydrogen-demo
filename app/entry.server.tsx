import type {DataFunctionArgs, EntryContext} from '@shopify/remix-oxygen';
import {RemixServer} from '@remix-run/react';
import isbot from 'isbot';
import {renderToReadableStream} from 'react-dom/server';
import {createContentSecurityPolicy} from '@shopify/hydrogen';

import * as Sentry from '@sentry/vercel-edge';
import * as SentryRemix from '@sentry/remix';

//const SENTRY_DSN = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn: "https://78ff737bc3ce687a2ffd1d22845947bc@o4506145504559104.ingest.sentry.io/4506190612398080",

  debug: true,
  // Set tracesSampleRate to 1.0 to capture 100%
  // of transactions for performance monitoring.
  // We recommend adjusting this value in production
  tracesSampleRate: 1.0,
});

export async function handleError(
  error: unknown,
  {request}: DataFunctionArgs,
): Promise<void> {
  SentryRemix.captureRemixServerException(error, 'remix.server', request);
}

export default async function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  remixContext: EntryContext,
) {
  const {nonce, header, NonceProvider} = createContentSecurityPolicy({
    defaultSrc: [
      "'self'", 
      "'*.sentry.io'",
      "'https://78ff737bc3ce687a2ffd1d22845947bc@o4506145504559104.ingest.sentry.io/4506190612398080'",
    ],
  });

  const body = await renderToReadableStream(
    <NonceProvider>
      <RemixServer context={remixContext} url={request.url} />
    </NonceProvider>,
    {
      nonce,
      signal: request.signal,
      onError(error) {
        // eslint-disable-next-line no-console
        console.error(error);
        responseStatusCode = 500;
      },
    },
  );

  if (isbot(request.headers.get('user-agent'))) {
    await body.allReady;
  }

  responseHeaders.set('Content-Type', 'text/html');
  responseHeaders.set('Content-Security-Policy', header);

  // Add the document policy header to enable JS profiling
  // This is required for Sentry's profiling integration
  responseHeaders.set('Document-Policy', 'js-profiling');

  return new Response(body, {
    headers: responseHeaders,
    status: responseStatusCode,
  });
}
