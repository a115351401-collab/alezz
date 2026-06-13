// ═══════════════════════════════════════════════════════════
// Secure proxy for Carapis metadata (brands, vehicle detail).
//
//   /api/meta?path=brands
//   /api/meta?path=vehicles/<uuid>
// ═══════════════════════════════════════════════════════════

const BASE_URL = process.env.CARAPIS_URL || 'https://api.carapis.com/apix/catalog_api';

// Safe allowed paths for v1
const SAFE_PATH = /^(brands|models|colors|body_types|fuel_types|transmissions|sources|vehicles\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/;

// Also accept "makes" as an alias for "brands" (frontend may call either)
const PATH_ALIAS = { makes: 'brands' };

const ALLOWED_PARAMS = ['page', 'page_size', 'search', 'brand', 'brand_slug', 'source_code', 'ordering'];

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const apiKey = (process.env.CARAPIS_API_KEY || process.env.AUTO_API_KEY || '').trim();
  if (!apiKey) return res.status(500).json({ error: 'API key is not configured.' });

  let path = String(req.query.path || '').replace(/\/+$/, '');
  // Resolve alias (e.g. "makes" → "brands")
  path = PATH_ALIAS[path] || path;

  if (!SAFE_PATH.test(path)) {
    return res.status(400).json({ error: 'Path not allowed: ' + path });
  }

  const qs = new URLSearchParams();
  for (const key of ALLOWED_PARAMS) {
    const value = req.query[key];
    if (value !== undefined && value !== '') qs.set(key, String(value));
  }
  const query = qs.toString();

  const authHeader = apiKey.startsWith('car_')
    ? { 'Authorization': `Bearer ${apiKey}` }
    : { 'X-API-Key': apiKey };

  try {
    const upstream = await fetch(`${BASE_URL}/${path}/${query ? '?' + query : ''}`, {
      headers: { ...authHeader, 'Accept': 'application/json' },
      signal: AbortSignal.timeout(25000),
    });
    const body = await upstream.text();

    if (!upstream.ok) {
      return res.status(upstream.status === 404 ? 404 : 502).json({
        error: 'Upstream meta request failed.',
        upstream_status: upstream.status,
        detail: body.slice(0, 200),
      });
    }

    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(200).send(body);
  } catch (err) {
    console.error('meta fetch failed:', err && err.message);
    return res.status(502).json({ error: 'Upstream request timed out or failed.' });
  }
}
