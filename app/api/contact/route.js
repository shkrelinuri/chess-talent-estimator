const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request) {
  let payload;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: 'Enter a valid message.' }, { status: 400 });
  }

  if (typeof payload.website === 'string' && payload.website.trim()) {
    return Response.json({ sent: true });
  }

  const name = typeof payload.name === 'string' ? payload.name.trim() : '';
  const email = typeof payload.email === 'string' ? payload.email.trim() : '';
  const message = typeof payload.message === 'string' ? payload.message.trim() : '';

  if (name.length < 2 || name.length > 100) {
    return Response.json({ error: 'Enter a name between 2 and 100 characters.' }, { status: 400 });
  }
  if (email.length > 254 || !emailPattern.test(email)) {
    return Response.json({ error: 'Enter a valid email address.' }, { status: 400 });
  }
  if (message.length < 10 || message.length > 5000) {
    return Response.json({ error: 'Your message must be between 10 and 5000 characters.' }, { status: 400 });
  }

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.CONTACT_FROM_EMAIL;
  const to = process.env.NEXT_PUBLIC_CONTACT_EMAIL;
  if (!apiKey || !from || !to) {
    return Response.json({ error: 'Contact email delivery is not configured yet.' }, { status: 503 });
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [to],
        reply_to: email,
        subject: `Chess Talent Estimator message from ${name}`,
        text: `From: ${name} <${email}>\n\n${message}`,
      }),
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      return Response.json({ error: 'The email service could not send your message. Please try again later.' }, { status: 502 });
    }
    return Response.json({ sent: true });
  } catch {
    return Response.json({ error: 'The email service could not be reached. Please try again later.' }, { status: 502 });
  }
}
