// ═══════════════════════════════════════════════════════════
// Secure proxy for Carapis v2 — vehicle listings
// Key lives ONLY in Vercel Environment Variables.
//
// Usage from the frontend:
//   /api/cars                          → first page (12 vehicles)
//   /api/cars?page=2&limit=20
//   /api/cars?make=genesis&source=encar
// ═══════════════════════════════════════════════════════════

// Supports both v1 (legacy) and v2 — set CARAPIS_URL env var to override.
// v2 default: https://api.carapis.com/v2                (Authorization: Bearer, keys start with car_)
// v1 legacy:  https://api.carapis.com/apix/catalog_api  (X-API-Key header)
const BASE_URL = process.env.CARAPIS_URL || 'https://api.carapis.com/v2';
const IS_V2 = BASE_URL.includes('/v2');

const ALLOWED_PARAMS = IS_V2 ? [
  'page', 'limit', 'source',
  'make', 'model',
  'year_min', 'year_max',
  'price_min', 'price_max',
  'fuel_type', 'transmission', 'color',
  'search', 'ordering',
  'mileage_min', 'mileage_max',
] : [
  'page', 'page_size', 'search', 'ordering', 'available_only',
  'brand', 'model', 'color', 'body_type', 'fuel_type', 'transmission',
  'min_year', 'max_year', 'min_price', 'max_price',
  'min_mileage', 'max_mileage', 'min_engine_cc', 'max_engine_cc',
  'has_accident', 'inspection_passed', 'is_new_vehicle', 'is_undervalued',
  'features', 'source',
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
      mode: IS_V2 ? 'v2' : 'v1',
      provider: 'carapis',
    });
  }

  if (!apiKey) {
    return res.status(500).json({
      error: 'API key is not configured. Add AUTO_API_KEY in Vercel → Settings → Environment Variables.',
    });
  }

  // Defaults
  const defaults = IS_V2
    ? { source: 'encar', page: '1', limit: '12' }
    : { page: '1', page_size: '12' };
  const qs = new URLSearchParams(defaults);
  for (const key of ALLOWED_PARAMS) {
    const value = req.query[key];
    if (value !== undefined && value !== '') qs.set(key, String(value));
  }

  const endpoint = IS_V2 ? `${BASE_URL}/listings?${qs}` : `${BASE_URL}/vehicles/?${qs}`;
  const authHeader = IS_V2
    ? { 'Authorization': `Bearer ${apiKey}` }
    : { 'X-API-Key': apiKey };

  try {
    const upstream = await fetch(endpoint, {
      headers: authHeader,
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

    // Parse and normalise for frontend compatibility
    let data;
    try {
      data = JSON.parse(body);
      // Normalise array key: v2 uses "results", v1 may use "vehicles" or "data"
      if (!Array.isArray(data.results)) {
        data.results = data.vehicles || data.data || data.listings || [];
      }
      const page = Number(data.page || qs.get('page') || 1);
      const limit = Number(data.limit || qs.get('limit') || qs.get('page_size') || 12);
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
