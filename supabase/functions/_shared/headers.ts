/**
 * Shared header utilities for edge functions
 * Combines CORS and security headers consistently across all functions
 */

/** Add CORS headers based on function requirements */
export function addCorsHeaders(headers: Headers = new Headers(), type: 'default' | 'users' = 'default'): Headers {
  headers.set('Access-Control-Allow-Origin', '*');

  if (type === 'users') {
    // Users function specific CORS
    headers.set('Access-Control-Allow-Methods', 'GET, POST');
    headers.set('Access-Control-Allow-Headers', 'Authorization');
  } else {
    // Default CORS (for push-notifications etc)
    headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    headers.set('Access-Control-Allow-Headers', 'authorization, x-client-info, apikey, content-type');
    headers.set('Access-Control-Max-Age', '86400');
    headers.set('Access-Control-Allow-Credentials', 'true');
  }
  return headers;
}

/** Add security headers aligned with production configuration */
export function addSecurityHeaders(headers: Headers = new Headers()): Headers {
  headers.set('X-Frame-Options', 'SAMEORIGIN');
  headers.set('Content-Security-Policy', "default-src 'self'; connect-src 'self' https://*.supabase.co https://*.groq.com https://*.brevo.com https://api.brevo.com https://api.openai.com https://api.openrouter.ai https://openrouter.ai https://*.googleapis.com https://*.firebaseapp.com https://*.appspot.com https://analytics.google.com https://iid-keyserver.googleapis.com https://*.paypal.com https://api-m.paypal.com https://vitals.vercel-insights.com https://va.vercel-scripts.com https://play.google.com https://www.gstatic.com/firebasejs/ wss://*.firebaseio.com https://oauth2.googleapis.com https://androidpublisher.googleapis.com https://fcm.googleapis.com https://deno.land https://esm.sh https://cdn.esm.sh https://fcmregistrations.googleapis.com; script-src 'nonce-${nonce}' 'strict-dynamic' https: 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://* blob:; font-src 'self' data:; frame-ancestors 'self'; object-src 'none'; base-uri 'self'; frame-src https://*.paypal.com https://api-m.paypal.com https://*.firebaseapp.com https://play.google.com; worker-src 'self' blob: https://www.gstatic.com/firebasejs/; child-src 'self' blob:; manifest-src 'self'; media-src 'self'");
  headers.set('Permissions-Policy', "geolocation=self, payment=*, camera=self, microphone=self, magnetometer=self, accelerometer=self, gyroscope=self");
  headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  return headers;
}

/** Create standard response with all headers */
export function createResponse(
  body: unknown,
  init: ResponseInit = {},
  type: 'default' | 'users' = 'default'
): Response {
  const headers = new Headers(init.headers);
  addCorsHeaders(headers, type);

  // Always add content-type for json responses
  if (typeof body === 'object') {
    headers.set('Content-Type', 'application/json');
    body = JSON.stringify(body);
  }

  // Add security headers for non-users endpoints
  if (type === 'default') {
    addSecurityHeaders(headers);
  }

  return new Response(body as BodyInit, {
    ...init,
    headers
  });
}

/** Handle OPTIONS request with CORS headers */
export function handleOptions(): Response {
  const headers = new Headers();
  addCorsHeaders(headers);
  addSecurityHeaders(headers);
  return new Response('ok', { headers });
}