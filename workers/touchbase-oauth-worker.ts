interface Env {
  GOOGLE_CLIENT_ID: string
  GOOGLE_CLIENT_SECRET: string
  WORKER_API_KEY: string
  ALLOWED_ORIGINS: string
}

interface TokenExchangeRequest {
  code: string
  redirect_uri: string
}

// List of allowed origins (will be configured in worker environment)
const DEFAULT_ALLOWED_ORIGINS = [
  'https://touchbase.site',
  'https://touchbase-git-staging-ajiteshgogois-projects.vercel.app',
  'http://localhost:5173',
  'http://localhost:3000'  
];

function setCorsHeaders(headers: Headers, origin: string | null) {
  if (origin) {
    headers.set('Access-Control-Allow-Origin', origin);
    headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    headers.set('Access-Control-Allow-Headers', 'Content-Type, X-API-Key');
    headers.set('Access-Control-Max-Age', '86400');
    headers.set('Vary', 'Origin');
  }
  return headers;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    console.log(`${request.method} ${request.url}`);

    // Get allowed origins from environment or fallback to default
    const allowedOrigins = env.ALLOWED_ORIGINS?.split(',') || DEFAULT_ALLOWED_ORIGINS;
    const origin = request.headers.get('Origin');

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      if (origin && !allowedOrigins.includes(origin)) {
        console.log('Preflight rejected for origin:', origin);
        return new Response('Forbidden', { status: 403 });
      }

      const headers = new Headers();
      setCorsHeaders(headers, origin);
      return new Response(null, { headers });
    }

    // Only allow POST requests
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    // Validate API key
    const apiKey = request.headers.get('X-API-Key');
    if (!apiKey || apiKey !== env.WORKER_API_KEY) {
      return new Response('Unauthorized', { status: 401 });
    }

    // Validate origin
    if (origin && !allowedOrigins.includes(origin)) {
      console.log('Request rejected for origin:', origin);
      return new Response('Forbidden', { status: 403 });
    }

    try {
      const body = await request.json() as TokenExchangeRequest;
      const { code, redirect_uri } = body;

      if (!code || !redirect_uri) {
        return new Response('Missing required parameters', { status: 400 });
      }

      // Exchange code for tokens with Google
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          code,
          client_id: env.GOOGLE_CLIENT_ID,
          client_secret: env.GOOGLE_CLIENT_SECRET,
          redirect_uri,
          grant_type: 'authorization_code',
        }),
      });

      if (!tokenResponse.ok) {
        const error = await tokenResponse.text();
        console.error('Token exchange failed:', error);
        return new Response(`Token exchange failed: ${error}`, { 
          status: tokenResponse.status 
        });
      }

      const tokens = await tokenResponse.json();

      // Create response with CORS headers
      const headers = new Headers({
        'Content-Type': 'application/json'
      });
      setCorsHeaders(headers, origin);

      return new Response(JSON.stringify(tokens), { headers });

    } catch (error) {
      console.error('Worker error:', error);
      return new Response('Internal server error', { status: 500 });
    }
  },
};