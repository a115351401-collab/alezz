// ═══════════════════════════════════════════════════════════
// Secure proxy for Carapis v2 — vehicle listings
// Key lives ONLY in Vercel Environment Variables.
//
// Usage from the frontend:
//   /api/cars                          → first page (12 vehicles)
//   /api/cars?page=2&limit=20
//   /api/cars?make=genesis&source=encar
// ═══════════════════════════════════════════════════════════

const BASE_URL = process.env.CARAPIS_URL || 'https://api.carapis.com/v2';

const ALLOWED_PARAMS = [
  'page', 'limit', 'source',
  'make', 'model',
  'year_min', 'year_max',
  'price_min', 'price_max',
  'fuel_type', 'transmission', 'color',
  'search', 'ordering',
  'mileage_min', 'mileage_max',
];

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const apiKey = (process.env.CARAPIS_API_KEY || process.env.AUTO_API_KEY || '').trim();

  // Safe diagnostics: /api/cars?diag=1
  if (req.query.diag === '1') {
    return res.status(200).json({
      key_present: Boolean(apiKey),
      key_length: apiKey.length,
      key_prefix: apiKey ? apiKey.slice(0, 4) + '…' : null,
      base_url: BASE_URL,
      provider: 'carapis-v2',
    });
  }

  if (!apiKey) {
    return res.status(500).json({
      error: 'API key is not configured. Add AUTO_API_KEY in Vercel → Settings → Environment Variables.',
    });
  }

  // Defaults: encar source, page 1, 12 results
  const qs = new URLSearchParams({ source: 'encar', page: '1', limit: '12' });
  for (const key of ALLOWED_PARAMS) {
    const value = req.query[key];
    if (value !== undefined && value !== '') qs.set(key, String(value));
  }

  try {
    const upstream = await fetch(`${BASE_URL}/listings?${qs}`, {
      headers: { 'Authorization': `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(25000),
    });
    const body = await upstream.text();

    if (!upstream.ok) {
      console.error('carapis v2 error:', upstream.status, body.slice(0, 300));
      return res.status(502).json({
        error: 'Upstream API request failed.',
        upstream_status: upstream.status,
        detail: body.slice(0, 1000),
      });
    }

    // Parse and add has_next for frontend compatibility
    let data;
    try {
      data = JSON.parse(body);
      const page = Number(data.page || 1);
      const limit = Number(data.limit || 12);
      data.has_next = (page * limit) < Number(data.count || 0);
    } catch (e) {
      // If parse fails, send raw body
      res.setHeader('Cache-Control', 's-maxage=21600, stale-while-revalidate=86400');
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.status(200).send(body);
    }

    res.setHeader('Cache-Control', 's-maxage=21600, stale-while-revalidate=86400');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(200).json(data);
  } catch (err) {
    console.error('carapis v2 fetch failed:', err && err.message);
    return res.status(502).json({ error: 'Upstream request timed out or failed. Try again shortly.' });
  }
}
