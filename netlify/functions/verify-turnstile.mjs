const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

export default async function handler(req) {
  const headers = { 'Content-Type': 'application/json' };

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const { token } = await req.json();

    if (!token) {
      return new Response(JSON.stringify({ success: false, error: 'Missing token.' }), {
        status: 400,
        headers,
      });
    }

    const secret = process.env.TURNSTILE_SECRET_KEY;
    if (!secret) {
      console.error('TURNSTILE_SECRET_KEY not set');
      return new Response(JSON.stringify({ success: false, error: 'Server configuration error.' }), {
        status: 500,
        headers,
      });
    }

    const res = await fetch(TURNSTILE_VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ secret, response: token }).toString(),
    });

    const data = await res.json();

    if (!data.success) {
      console.warn('Turnstile verification failed:', JSON.stringify(data));
      return new Response(JSON.stringify({ success: false, error: 'Verification failed.' }), {
        status: 403,
        headers,
      });
    }

    return new Response(JSON.stringify({ success: true }), { status: 200, headers });
  } catch (err) {
    console.error('Verify error:', err.message);
    return new Response(JSON.stringify({ success: false, error: 'Internal server error.' }), {
      status: 500,
      headers,
    });
  }
}
