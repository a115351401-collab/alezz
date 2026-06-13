// ═══════════════════════════════════════════════════════════
// Secure proxy for Carapis — vehicle listings
// Key lives ONLY in Vercel Environment Variables (AUTO_API_KEY).
//
// Usage from the frontend:
//   /api/cars                          → first page (12 vehicles)
//   /api/cars?page=2&limit=12
//   /api/cars?make=genesis&source=encar
//   /api/cars?diag=1                   → safe diagnostics (no key exposed)
// ═══════════════════════════════════════════════════════════

// v1 endpoint — confirmed working (returns 401, not 404)
// Auth: keys starting with "car_" use Bearer; legacy keys use X-API-Key
const BASE_URL = process.env.CARAPIS_URL || 'https://api.carapis.com/apix/catalog_api';

const ALLOWED_PARAMS = [
  'page', 'page_size', 'search', 'ordering', 'available_only',
  'brand', 'model', 'color', 'body_type', 'fuel_type', 'transmission',
  'min_year', 'max_year', 'min_price', 'max_price',
  'min_mileage', 'max_mileage', 'source',
  // also accept frontend v2-style names and map them below
  'make', 'limit', 'year_min', 'year_max', 'price_min', 'price_max',
  'mileage_min', 'mileage_max',
];

// Map frontend param names → v1 API param names
const PARAM_MAP = {
  make: 'brand',
  limit: 'page_size',
  year_min: 'min_year',
  year_max: 'max_year',
  price_min: 'min_price',
  price_max: 'max_price',
  mileage_min: 'min_mileage',
  mileage_max: 'max_mileage',
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const apiKey = (process.env.CARAPIS_API_KEY || process.env.AUTO_API_KEY || '').trim();

  // Safe diagnostics: /api/cars?diag=1
  if (req.query.diag === '1') {
    return res.status(200).json({
      key_present: Boolean(apiKey),
      key_length: apiKey.length,
      key_prefix: apiKey ? apiKey.slice(0, 6) + '…' : null,
      base_url: BASE_URL,
      key_type: apiKey.startsWith('car_') ? 'bearer (car_ prefix)' : 'x-api-key',
    });
  }

  if (!apiKey) {
    return res.status(500).json({
      error: 'API key not configured. Add AUTO_API_KEY in Vercel → Settings → Environment Variables.',
    });
  }

  // Build query string with v1 param names
  // Note: do NOT pass source=encar — v1 endpoint doesn't support it and returns 404
  const qs = new URLSearchParams({ page: '1', page_size: '12' });
  for (const key of ALLOWED_PARAMS) {
    const value = req.query[key];
    if (value === undefined || value === '') continue;
    if (key === 'source') continue; // v1 ignores source; all results are from encar
    const mapped = PARAM_MAP[key] || key;
    qs.set(mapped, String(value));
  }

  const endpoint = `${BASE_URL}/vehicles/?${qs}`;

  // keys starting with "car_" use Bearer; older keys use X-API-Key
  const authHeader = apiKey.startsWith('car_')
    ? { 'Authorization': `Bearer ${apiKey}` }
    : { 'X-API-Key': apiKey };

  try {
    const upstream = await fetch(endpoint, {
      headers: { ...authHeader, 'Accept': 'application/json' },
      signal: AbortSignal.timeout(25000),
    });
    const body = await upstream.text();

    if (!upstream.ok) {
      console.error('carapis error:', upstream.status, body.slice(0, 300));
      return res.status(502).json({
        error: 'Upstream API request failed.',
        upstream_status: upstream.status,
        endpoint,
        detail: body.slice(0, 500),
      });
    }

    // Parse and normalise for frontend
    let data;
    try {
      data = JSON.parse(body);
    } catch (e) {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.status(200).send(body);
    }

    // Normalise array key (v1 uses "results", but just in case)
    if (!Array.isArray(data.results)) {
      data.results = data.vehicles || data.data || data.listings || [];
    }
    const page = Number(data.page || qs.get('page') || 1);
    const pageSize = Number(data.page_size || data.limit || qs.get('page_size') || 12);
    data.has_next = (page * pageSize) < Number(data.count || 0);

    res.setHeader('Cache-Control', 's-maxage=21600, stale-while-revalidate=86400');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(200).json(data);
  } catch (err) {
    console.error('carapis fetch failed:', err && err.message);
    return res.status(502).json({ error: 'Upstream request timed out or failed. Try again shortly.' });
  }
}
