// ═══════════════════════════════════════════════════════════
// Secure proxy for auto-api.com (Encar listings)
// The API key lives ONLY in Vercel Environment Variables —
// it never reaches the browser or the git repository.
//
// Usage from the frontend:
//   /api/cars                          → first page of Encar offers
//   /api/cars?page=2                   → pagination
//   /api/cars?brand=Genesis&year_from=2021&price_to=5000
// ═══════════════════════════════════════════════════════════
import { Client } from '@autoapicom/client';

// Whitelist — only these query params are forwarded upstream.
// Anything else a visitor appends is silently dropped.
const ALLOWED_PARAMS = [
  'page', 'brand', 'model', 'configuration', 'complectation',
  'transmission', 'color', 'body_type', 'engine_type',
  'year_from', 'year_to', 'mileage_from', 'mileage_to',
  'price_from', 'price_to',
];

export default async function handler(req, res) {
  const apiKey = process.env.AUTO_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: 'AUTO_API_KEY is not configured. Add it in Vercel → Settings → Environment Variables.',
    });
  }

  const client = new Client(apiKey, process.env.AUTO_API_URL || 'https://api1.auto-api.com');

  const params = { page: 1 };
  for (const key of ALLOWED_PARAMS) {
    const value = req.query[key];
    if (value !== undefined && value !== '') params[key] = value;
  }

  try {
    const offers = await client.getOffers('encar', params);
    // Cache at Vercel's edge for 5 min (+10 min stale) — keeps
    // upstream request count tiny regardless of visitor traffic.
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    return res.status(200).json(offers);
  } catch (err) {
    // Never leak the key or upstream URL details to the client
    console.error('auto-api error:', err && err.message);
    return res.status(502).json({ error: 'Upstream API request failed. Try again shortly.' });
  }
}
