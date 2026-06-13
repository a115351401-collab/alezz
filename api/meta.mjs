// ═══════════════════════════════════════════════════════════
// Secure proxy for Carapis v2 metadata (makes, listing detail).
//
//   /api/meta?path=makes
//   /api/meta?path=listings/<id>
// ═══════════════════════════════════════════════════════════

const BASE_URL = process.env.CARAPIS_URL || 'https://api.carapis.com/apix/catalog_api';
const IS_V2 = BASE_URL.includes('/v2');

// v1: brands, models, vehicles/{uuid}
// v2: makes, listings/{id}
const SAFE_PATH = IS_V2
  ? /^(makes|listings\/[0-9a-zA-Z_-]{4,64})$/
  : /^(brands|models|colors|interior_colors|body_types|fuel_types|transmissions|filters|facets|stats|sources|vehicles\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/;

const ALLOWED_PARAMS = IS_V2
  ? ['page', 'limit', 'search', 'source']
  : ['page', 'page_size', 'search', 'brand', 'brand_slug', 'source_code', 'ordering'];

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const apiKey = (process.env.CARAPIS_API_KEY || process.env.AUTO_API_KEY || '').trim();
  if (!apiKey) return res.status(500).json({ error: 'API key is not configured.' });

  const path = String(req.query.path || '').replace(/\/+$/, '');
  if (!SAFE_PATH.test(path)) {
    return res.status(400).json({ error: 'Path not allowed.' });
  }

  const qs = new URLSearchParams();
  for (const key of ALLOWED_PARAMS) {
    const value = req.query[key];
    if (value !== undefined && value !== '') qs.set(key, String(value));
  }
  const query = qs.toString();

  try {
    const authHeader = IS_V2
      ? { 'Authorization': `Bearer ${apiKey}` }
      : { 'X-API-Key': apiKey };
    const upstream = await fetch(`${BASE_URL}/${path}/${query ? '?' + query : ''}`, {
      headers: authHeader,
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
    console.error('meta v2 fetch failed:', err && err.message);
    return res.status(502).json({ error: 'Upstream request timed out or failed.' });
  }
}
