const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response('', { status: 204, headers: CORS_HEADERS });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const body = await req.json();
    const { name, description, url, turnstileToken } = body;

    if (!name || !url) {
      return new Response(JSON.stringify({ error: 'Name and URL are required.' }), {
        status: 400,
        headers: CORS_HEADERS,
      });
    }

    // Verify Cloudflare Turnstile token
    const secret = process.env.TURNSTILE_SECRET_KEY;
    if (!secret) {
      console.error('TURNSTILE_SECRET_KEY not set');
      return new Response(JSON.stringify({ error: 'Server configuration error.' }), {
        status: 500,
        headers: CORS_HEADERS,
      });
    }

    const turnstileRes = await fetch(TURNSTILE_VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        secret,
        response: turnstileToken || '',
      }).toString(),
    });

    const turnstileData = await turnstileRes.json();

    if (!turnstileData.success) {
      console.error('Turnstile verification failed:', JSON.stringify(turnstileData));
      return new Response(JSON.stringify({ error: 'Captcha verification failed.' }), {
        status: 403,
        headers: CORS_HEADERS,
      });
    }

    // Log the verified submission
    console.log('NEW SUBMISSION:', JSON.stringify({ name, description, url, timestamp: new Date().toISOString() }));

    // Forward to Netlify Forms (best-effort, don't block success response)
    try {
      const formRes = await fetch('https://www.designerslack.community/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          'form-name': 'add-community',
          'community-name': name,
          'community-description': description || '',
          'community-url': url,
        }).toString(),
      });

      if (formRes.ok) {
        console.log('Forwarded to Netlify Forms successfully');
      } else {
        console.warn('Netlify Forms returned', formRes.status);
      }
    } catch (formErr) {
      console.warn('Netlify Forms forwarding failed:', formErr.message);
    }

    return new Response(JSON.stringify({ success: true }), { status: 200, headers: CORS_HEADERS });
  } catch (err) {
    console.error('Submit error:', err.message, err.stack);
    return new Response(JSON.stringify({ error: 'Internal server error.' }), {
      status: 500,
      headers: CORS_HEADERS,
    });
  }
}
