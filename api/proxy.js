export default async function handler(req, res) {
  // CORS preflight
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const target = req.query.url;
  if (!target) return res.status(400).send('Missing ?url= parameter');

  // Validate — only allow rule34 domains
  let targetUrl;
  try { targetUrl = new URL(target); } catch { return res.status(400).send('Invalid URL'); }

  const allowed = ['rule34.xxx', 'api.rule34.xxx', 'wimg.rule34.xxx'];
  const ok = allowed.some(d => targetUrl.hostname === d || targetUrl.hostname.endsWith('.' + d));
  if (!ok) return res.status(403).send(`Domain not allowed: ${targetUrl.hostname}`);

  try {
    const upstream = await fetch(targetUrl.toString(), {
      headers: {
        'Referer': 'https://rule34.xxx/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': req.headers['accept'] || '*/*',
      },
    });

    res.status(upstream.status);

    // Forward content-type so browser renders correctly
    const ct = upstream.headers.get('content-type');
    if (ct) res.setHeader('Content-Type', ct);

    // Cache images/video on Vercel's edge for 1 hour
    if (ct?.startsWith('image/') || ct?.startsWith('video/')) {
      res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
    }

    const buffer = await upstream.arrayBuffer();
    res.send(Buffer.from(buffer));
  } catch (err) {
    res.status(502).send(`Proxy error: ${err.message}`);
  }
}
