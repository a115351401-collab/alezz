// ═══════════════════════════════════════════════════════════
// Secure proxy for Carapis (carapis.com) — Encar catalog data
// The API key lives ONLY in Vercel Environment Variables —
// it never reaches the browser or the git repository.
//
// Usage from the frontend:
//   /api/cars                     → first page (12 vehicles)
//   /api/cars?page=2&page_size=20
//   /api/cars?search=genesis
// ═══════════════════════════════════════════════════════════

const BASE_URL = process.env.CARAPIS_URL || 'https://api.carapis.com/apix/catalog_api';

// Whitelist — mirrors catalog_api's documented valid_parameters
// (server's own 400 response enumerates them).
const ALLOWED_PARAMS = [
  'page', 'page_size', 'search', 'ordering', 'available_only',
  'brand', 'model', 'color', 'body_type', 'fuel_type', 'transmission',
  'min_year', 'max_year', 'min_price', 'max_price',
  'min_mileage', 'max_mileage', 'min_engine_cc', 'max_engine_cc',
  'has_accident', 'inspection_passed', 'is_new_vehicle', 'is_undervalued',
  'features',
];

export default async function handler(req, res) {
  // Public catalog data — allow local dev page (vite) to call the prod API
  res.setHeader('Access-Control-Allow-Origin', '*');

  const apiKey = (process.env.CARAPIS_API_KEY || process.env.AUTO_API_KEY || '').trim();

  // Safe diagnostics: /api/cars?diag=1 — never reveals the key itself
  if (req.query.diag === '1') {
    return res.status(200).json({
      key_present: Boolean(apiKey),
      key_length: apiKey.length,
      key_prefix: apiKey ? apiKey.slice(0, 4) + '…' : null,
      base_url: BASE_URL,
      provider: 'carapis',
    });
  }

  if (!apiKey) {
    return res.status(500).json({
      error: 'API key is not configured. Add AUTO_API_KEY in Vercel → Settings → Environment Variables.',
    });
  }

  const qs = new URLSearchParams({ page: '1', page_size: '12' });
  for (const key of ALLOWED_PARAMS) {
    const value = req.query[key];
    if (value !== undefined && value !== '') qs.set(key, String(value));
  }

  try {
    const upstream = await fetch(`${BASE_URL}/vehicles/?${qs}`, {
      headers: { 'X-API-Key': apiKey },
      signal: AbortSignal.timeout(25000),
    });
    const body = await upstream.text();

    if (!upstream.ok) {
      console.error('carapis error:', upstream.status, body.slice(0, 300));
      return res.status(502).json({
        error: 'Upstream API request failed.',
        upstream_status: upstream.status,
        detail: body.slice(0, 1000),
      });
    }

    // Cache at Vercel's edge for 5 min (+10 min stale) — keeps
    // upstream request count tiny regardless of visitor traffic.
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(200).send(body);
  } catch (err) {
    console.error('carapis fetch failed:', err && err.message);
    return res.status(502).json({ error: 'Upstream request timed out or failed. Try again shortly.' });
  }
}
