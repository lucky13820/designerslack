const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  };

  try {
    const body = await req.json();
    const { name, description, url, turnstileToken } = body;

    if (!name || !url) {
      return new Response(JSON.stringify({ error: 'Name and URL are required.' }), {
        status: 400,
        headers,
      });
    }

    // Verify Cloudflare Turnstile token
    const secret = process.env.TURNSTILE_SECRET_KEY;
    if (!secret) {
      console.error('TURNSTILE_SECRET_KEY not set');
      return new Response(JSON.stringify({ error: 'Server configuration error.' }), {
        status: 500,
        headers,
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
      return new Response(JSON.stringify({ error: 'Captcha verification failed.' }), {
        status: 403,
        headers,
      });
    }

    // Forward to Netlify Forms so submissions appear in the dashboard
    const siteUrl = process.env.URL || 'https://www.designerslack.community';
    const formRes = await fetch(siteUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        'form-name': 'add-community',
        'community-name': name,
        'community-description': description || '',
        'community-url': url,
      }).toString(),
    });

    if (!formRes.ok) {
      // Netlify Forms not enabled — log submission directly
      console.log('SUBMISSION (Netlify Forms unavailable):', JSON.stringify({ name, description, url }));
    }

    return new Response(JSON.stringify({ success: true }), { status: 200, headers });
  } catch (err) {
    console.error('Submit error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error.' }), {
      status: 500,
      headers,
    });
  }
}
