const PROXY_PATHS = ['/api', '/uploads'];

function isProxyPath(pathname) {
  return PROXY_PATHS.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export async function onRequest(context) {
  const incomingUrl = new URL(context.request.url);

  if (!isProxyPath(incomingUrl.pathname)) {
    return context.env.ASSETS.fetch(context.request);
  }

  const rawTarget = context.env.API_PROXY_TARGET;
  if (!rawTarget) {
    return new Response('API_PROXY_TARGET is not configured.', { status: 500 });
  }

  let targetBase;
  try {
    targetBase = new URL(rawTarget);
  } catch {
    return new Response('API_PROXY_TARGET is invalid.', { status: 500 });
  }

  const targetUrl = new URL(incomingUrl.pathname + incomingUrl.search, targetBase);
  const headers = new Headers(context.request.headers);
  headers.delete('host');
  headers.set('x-forwarded-host', incomingUrl.host);
  headers.set('x-forwarded-proto', 'https');

  const requestInit = {
    method: context.request.method,
    headers,
    redirect: 'manual',
  };

  if (!['GET', 'HEAD'].includes(context.request.method)) {
    requestInit.body = context.request.body;
  }

  return fetch(new Request(targetUrl, requestInit));
}
