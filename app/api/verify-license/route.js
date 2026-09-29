export async function GET() {
  const productPermalink = process.env.GUMROAD_PRODUCT_PERMALINK;
  if (!productPermalink) {
    return Response.json({ error: 'Checkout is not configured yet.' }, { status: 503 });
  }
  return Response.json({ purchaseUrl: `https://gumroad.com/l/${encodeURIComponent(productPermalink)}` });
}

export async function POST(request) {
  const productPermalink = process.env.GUMROAD_PRODUCT_PERMALINK;
  if (!productPermalink) {
    return Response.json({ error: 'License verification is not configured yet.' }, { status: 503 });
  }

  let licenseKey;
  try {
    ({ licenseKey } = await request.json());
  } catch {
    return Response.json({ error: 'Enter a valid license key.' }, { status: 400 });
  }

  if (typeof licenseKey !== 'string' || !licenseKey.trim()) {
    return Response.json({ error: 'Enter a valid license key.' }, { status: 400 });
  }

  const body = new URLSearchParams({
    product_permalink: productPermalink,
    license_key: licenseKey.trim(),
    increment_uses_count: 'true',
  });

  try {
    const response = await fetch('https://api.gumroad.com/v2/licenses/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      signal: AbortSignal.timeout(10000),
    });
    const result = await response.json();

    if (!response.ok || !result.success) {
      return Response.json({ error: 'That key could not be verified for this product.' }, { status: 400 });
    }

    return Response.json({ valid: true });
  } catch {
    return Response.json({ error: 'Gumroad could not be reached. Please try again.' }, { status: 502 });
  }
}
