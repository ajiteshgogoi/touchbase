// Environment variables required:
// - SUPABASE_URL: Your Supabase project URL (kept secret)
// - CLIENT_SECRET: A custom secret for additional auth
// - SUPABASE_ANON_KEY: Your Supabase anon key (kept secret)
// - SUPABASE_SERVICE_ROLE_KEY: Your Supabase service role key (kept secret, needed for admin functions)

// List of allowed origins
const allowedOrigins = [
  'https://touchbase.site',
  'https://touchbase-git-staging-ajiteshgogois-projects.vercel.app',
  'http://localhost:5173',  // Vite dev server default port
  'http://localhost:3000'   // Common dev server port
];

// Helper function to set CORS headers
function setCorsHeaders(headers = new Headers(), request) {
  const origin = request.headers.get('Origin');
  
  // Only allow requests from our allowed origins
  if (origin && allowedOrigins.includes(origin)) {
    headers.set('Access-Control-Allow-Origin', origin);
    headers.set('Access-Control-Allow-Credentials', 'true');
  }
  
  if (request.method === 'OPTIONS') {
    headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE, PATCH');
    headers.set('Access-Control-Allow-Headers', [
      'authorization',
      'x-client-info',
      'apikey',
      'content-type',
      'content-profile',
      'x-client-secret',
      'x-supabase-api-version',
      'prefer',
      'range',
      'accept-profile',
      'accept-language',
      'x-my-header'
    ].join(', '));
    headers.set('Access-Control-Max-Age', '86400');
  }
  
  return headers;
}

export default {
  async fetch(request, env) {
    try {
      // Handle preflight requests
      if (request.method === "OPTIONS") {
        const headers = new Headers();
        setCorsHeaders(headers, request);
        return new Response(null, { headers });
      }

      const url = new URL(request.url);
      
      // Skip client secret check for public endpoints
      const publicEndpoints = ['/functions/v1/get-user-stats'];
      const isPublicEndpoint = publicEndpoints.some(endpoint => url.pathname === endpoint);
      
      if (!isPublicEndpoint) {
        const clientSecret = request.headers.get("X-Client-Secret");
        if (!clientSecret || clientSecret !== env.CLIENT_SECRET) {
          const headers = new Headers({ "Content-Type": "application/json" });
          setCorsHeaders(headers, request);
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers
          });
        }
      }

      // Allow auth/v1 and rest/functions routes
      if (!url.pathname.match(/^\/(auth\/v1|rest\/v1|functions\/v1)\//)) {
        const headers = new Headers({ "Content-Type": "application/json" });
        setCorsHeaders(headers, request);
        return new Response(JSON.stringify({ error: "Not Found" }), { 
          status: 404,
          headers
        });
      }

      // Create supabase URL
      const supabaseUrl = new URL(url.pathname, env.SUPABASE_URL);
      supabaseUrl.search = url.search;

      // Forward the request to Supabase
      const headers = new Headers();
      
      // Copy all original headers except client secret
      for (const [key, value] of request.headers.entries()) {
        if (key.toLowerCase() !== 'x-client-secret') {
          headers.set(key, value);
        }
      }
      
      // Add Supabase API key
      headers.set("apikey", env.SUPABASE_ANON_KEY);

      // Handle authorization
      const authorization = headers.get("Authorization");
      const serviceEndpoints = ['/functions/v1/get-user-stats'];
      
      if (url.pathname.startsWith('/functions/v1/')) {
        if (serviceEndpoints.includes(url.pathname)) {
          // Use service role key for admin functions
          headers.set("Authorization", `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`);
        } else if (!authorization) {
          // Require auth token for protected functions
          const headers = new Headers({ "Content-Type": "application/json" });
          setCorsHeaders(headers, request);
          return new Response(JSON.stringify({ error: "Unauthorized - No token provided" }), {
            status: 401,
            headers
          });
        }
      } else if (!authorization) {
        // Use anon key for public endpoints without auth
        headers.set("Authorization", `Bearer ${env.SUPABASE_ANON_KEY}`);
      }
      
      // Forward request to Supabase
      const supabaseRequest = new Request(supabaseUrl, {
        method: request.method,
        headers: headers,
        body: request.body,
      });

      // Get response from Supabase
      const response = await fetch(supabaseRequest);

      // Forward response with Supabase headers plus CORS
      const responseHeaders = new Headers(response.headers);
      setCorsHeaders(responseHeaders, request);

      return new Response(response.body, {
        status: response.status,
        headers: responseHeaders
      });

    } catch (err) {
      console.error("Worker error:", err);
      const headers = new Headers({ "Content-Type": "application/json" });
      setCorsHeaders(headers, request);
      return new Response(JSON.stringify({ error: "Internal Server Error" }), { 
        status: 500,
        headers
      });
    }
  },
};