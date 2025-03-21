// Environment variables required:
// - SUPABASE_URL: Your Supabase project URL (kept secret)
// - CLIENT_SECRET: A custom secret for additional auth
// - SUPABASE_ANON_KEY: Your Supabase anon key (kept secret)
// - SUPABASE_SERVICE_ROLE_KEY: Your Supabase service role key (kept secret, needed for admin functions)

export default {
  async fetch(request, env) {
    try {
      // Handle preflight with all required Supabase headers
      if (request.method === "OPTIONS") {
        const corsHeaders = {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS, PUT, DELETE, PATCH",
          "Access-Control-Allow-Headers": [
            "authorization",
            "x-client-info",
            "apikey",
            "content-type",
            "content-profile",
            "x-client-secret",
            "x-supabase-api-version",
            "prefer",
            "range",
            "accept-profile",
            "accept-language",
            "x-my-header"
          ].join(", "),
          "Access-Control-Max-Age": "86400",
          "Access-Control-Allow-Credentials": "true"
        };
        return new Response(null, { headers: corsHeaders });
      }

      const url = new URL(request.url);
      
      // Skip client secret check for public endpoints
      const publicEndpoints = ['/functions/v1/get-user-stats'];
      const isPublicEndpoint = publicEndpoints.some(endpoint => url.pathname === endpoint);
      
      if (!isPublicEndpoint) {
        const clientSecret = request.headers.get("X-Client-Secret");
        if (!clientSecret || clientSecret !== env.CLIENT_SECRET) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { 
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
              "Access-Control-Allow-Credentials": "true"
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
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Credentials": "true"
          }
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
          return new Response(JSON.stringify({ error: "Unauthorized - No token provided" }), {
            status: 401,
            headers: { 
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
              "Access-Control-Allow-Credentials": "true"
            }
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
      responseHeaders.set("Access-Control-Allow-Origin", "*");
      responseHeaders.set("Access-Control-Allow-Credentials", "true");

      return new Response(response.body, {
        status: response.status,
        headers: responseHeaders
      });

    } catch (err) {
      console.error("Worker error:", err);
      return new Response(JSON.stringify({ error: "Internal Server Error" }), { 
        status: 500,
        headers: { 
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Credentials": "true"
        }
      });
    }
  },
};