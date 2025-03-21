// Environment variables required:
// - SUPABASE_URL: Your Supabase project URL (kept secret)
// - CLIENT_SECRET: A custom secret for additional auth
// - SUPABASE_ANON_KEY: Your Supabase anon key (kept secret)
// - SUPABASE_SERVICE_ROLE_KEY: Your Supabase service role key (kept secret, needed for admin functions)

function addCorsHeaders(headers = new Headers()) {
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'authorization, x-client-info, apikey, content-type, x-client-secret');
  headers.set('Access-Control-Max-Age', '86400');
  headers.set('Access-Control-Allow-Credentials', 'true');
  return headers;
}

function addSecurityHeaders(headers = new Headers()) {
  headers.set('X-Frame-Options', 'SAMEORIGIN');
  headers.set('Content-Security-Policy', "default-src 'self'; connect-src 'self' https://*.supabase.co https://*.groq.com https://*.brevo.com https://api.brevo.com https://api.openai.com https://api.openrouter.ai https://openrouter.ai https://*.googleapis.com https://*.firebaseapp.com https://*.appspot.com https://analytics.google.com https://iid-keyserver.googleapis.com https://*.paypal.com https://api-m.paypal.com https://vitals.vercel-insights.com https://va.vercel-scripts.com https://play.google.com https://www.gstatic.com/firebasejs/ wss://*.firebaseio.com https://oauth2.googleapis.com https://androidpublisher.googleapis.com https://fcm.googleapis.com https://deno.land https://esm.sh https://cdn.esm.sh https://fcmregistrations.googleapis.com https://api.touchbase.site https://touchbase-proxy.az-ajitesh.workers.dev; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.paypal.com https://va.vercel-scripts.com https://*.firebaseapp.com https://*.googleapis.com https://www.gstatic.com https://play.google.com https://www.gstatic.com/firebasejs/ https://deno.land https://esm.sh https://cdn.esm.sh https://static.cloudflareinsights.com; style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; img-src 'self' data: https://* blob:; font-src 'self' data:; frame-ancestors 'self'; object-src 'none'; base-uri 'self'; frame-src https://*.paypal.com https://api-m.paypal.com https://*.firebaseapp.com https://play.google.com; worker-src 'self' blob: https://www.gstatic.com/firebasejs/; child-src 'self' blob:; manifest-src 'self'; media-src 'self'");
  headers.set('Permissions-Policy', "geolocation=self, payment=*, camera=self, microphone=self, magnetometer=self, accelerometer=self, gyroscope=self");
  headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  return headers;
}

export default {
  async fetch(request, env) {
    try {
      // Handle CORS preflight
      if (request.method === "OPTIONS") {
        const headers = new Headers();
        addCorsHeaders(headers);
        addSecurityHeaders(headers);
        return new Response('ok', { headers });
      }

      const url = new URL(request.url);

      // Public function endpoints
      const publicEndpoints = ['/functions/v1/get-user-stats'];

      // Skip client secret validation for public endpoints
      const isPublicEndpoint = publicEndpoints.some(endpoint => url.pathname === endpoint);
      if (!isPublicEndpoint) {
        const clientSecret = request.headers.get("X-Client-Secret");
        if (!clientSecret || clientSecret !== env.CLIENT_SECRET) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: {
              "Content-Type": "application/json",
              ...Object.fromEntries(addCorsHeaders(new Headers())),
            }
          });
        }
      }

      // Allow auth/v1 and rest/functions routes
      if (!url.pathname.match(/^\/(auth\/v1|rest\/v1|functions\/v1)\//)) {
        return new Response(JSON.stringify({ error: "Not Found" }), { 
          status: 404,
          headers: {
            "Content-Type": "application/json",
            ...Object.fromEntries(addCorsHeaders(new Headers())),
          }
        });
      }

      // Create supabase URL
      const supabaseUrl = new URL(url.pathname, env.SUPABASE_URL);
      supabaseUrl.search = url.search;

      // Forward the request to Supabase
      const headers = new Headers(request.headers);
      
      // Add/override required headers
      headers.set("apikey", env.SUPABASE_ANON_KEY);
      headers.delete("X-Client-Secret");

      // Handle authorization for different endpoints
      const authorization = headers.get("Authorization");
      
      // List of service-role endpoints that require elevated access
      const serviceEndpoints = ['/functions/v1/get-user-stats'];
      
      if (url.pathname.startsWith('/functions/v1/')) {
        if (serviceEndpoints.includes(url.pathname)) {
          // For service endpoints, use service role key
          headers.set("Authorization", `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`);
        } else {
          // For protected functions, ensure JWT token is present
          if (!authorization) {
            return new Response(JSON.stringify({ error: "Unauthorized - No token provided" }), {
              status: 401,
              headers: {
                "Content-Type": "application/json",
                ...Object.fromEntries(addCorsHeaders(new Headers())),
              }
            });
          }
        }
      } else {
        // For non-function endpoints, use anon key if no auth present
        if (!authorization) {
          headers.set("Authorization", `Bearer ${env.SUPABASE_ANON_KEY}`);
        }
      }
      
      const supabaseRequest = new Request(supabaseUrl, {
        method: request.method,
        headers: headers,
        body: request.body,
      });

      // Forward the response from Supabase
      const response = await fetch(supabaseRequest);
      const responseHeaders = new Headers(response.headers);
      
      // Add CORS headers
      addCorsHeaders(responseHeaders);
      
      // Only add security headers for non-function endpoints
      if (!url.pathname.startsWith('/functions/v1/')) {
        addSecurityHeaders(responseHeaders);
      }
      
      // Add caching headers for rate limiting
      responseHeaders.set("Cache-Control", "public, max-age=10");

      // Create final response
      return new Response(response.body, {
        status: response.status,
        headers: responseHeaders,
      });

    } catch (err) {
      console.error("Worker error:", err);
      return new Response(JSON.stringify({ error: "Internal Server Error" }), { 
        status: 500,
        headers: {
          "Content-Type": "application/json",
          ...Object.fromEntries(addCorsHeaders(new Headers())),
        }
      });
    }
  },
};