// ═══════════════════════════════════════════════════════════
// Secure proxy for Carapis v2 metadata (makes, listing detail).
//
//   /api/meta?path=makes
//   /api/meta?path=listings/<id>
// ═══════════════════════════════════════════════════════════

const BASE_URL = process.env.CARAPIS_URL || 'https://api.carapis.com/v2';

// Allow: makes list  OR  single listing by id (alphanumeric + hyphens)
const SAFE_PATH = /^(makes|listings\/[0-9a-zA-Z_-]{4,64})$/;

const ALLOWED_PARAMS = ['page', 'limit', 'search', 'source'];

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
    const upstream = await fetch(`${BASE_URL}/${path}${query ? '?' + query : ''}`, {
      headers: { 'Authorization': `Bearer ${apiKey}` },
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
