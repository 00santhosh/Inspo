// Fetches a page's title, description and preview image for bookmark cards.
// Runs server-side because browsers block reading other sites' HTML (CORS).
// JWT verification is on by default, so only signed-in users can call it.

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const MAX_BYTES = 512 * 1024;
const TIMEOUT_MS = 8000;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

/** Refuse obvious internal targets. Not a complete SSRF guard: DNS can still point at private IPs. */
function isAllowed(url: URL) {
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return false;
  const host = url.hostname.toLowerCase();
  if (host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal')) return false;
  if (/^(127\.|10\.|0\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host)) return false;
  if (host.startsWith('[') || host === '::1') return false;
  return true;
}

function decode(s: string) {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .trim();
}

function meta(html: string, names: string[]) {
  for (const name of names) {
    const re = new RegExp(
      `<meta[^>]+(?:property|name)=["']${name}["'][^>]*content=["']([^"']*)["']|<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${name}["']`,
      'i',
    );
    const m = html.match(re);
    const v = m?.[1] ?? m?.[2];
    if (v) return decode(v);
  }
  return null;
}

async function readCapped(res: Response) {
  const reader = res.body?.getReader();
  if (!reader) return '';
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (total < MAX_BYTES) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    total += value.length;
  }
  await reader.cancel().catch(() => {});
  const buf = new Uint8Array(total);
  let o = 0;
  for (const c of chunks) {
    buf.set(c.subarray(0, Math.min(c.length, total - o)), o);
    o += c.length;
  }
  return new TextDecoder().decode(buf);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Use POST' }, 405);

  let target: URL;
  try {
    const { url } = await req.json();
    target = new URL(String(url));
  } catch {
    return json({ error: 'Body must be {"url": "https://..."}' }, 400);
  }
  if (!isAllowed(target)) return json({ error: 'URL not allowed' }, 400);

  try {
    const res = await fetch(target, {
      redirect: 'follow',
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; InspoCanvasBot/1.0; +link-preview)',
        Accept: 'text/html,application/xhtml+xml',
      },
    });
    const finalUrl = new URL(res.url || target.href);
    if (!isAllowed(finalUrl)) return json({ error: 'URL not allowed' }, 400);

    const type = res.headers.get('content-type') ?? '';
    if (type.startsWith('image/')) {
      await res.body?.cancel();
      return json({ url: finalUrl.href, title: null, description: null, imageUrl: finalUrl.href, siteName: finalUrl.hostname });
    }

    const html = await readCapped(res);
    const docTitle = html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim() || null;
    const title = meta(html, ['og:title', 'twitter:title']) ?? docTitle;
    const image = meta(html, ['og:image:secure_url', 'og:image', 'twitter:image', 'twitter:image:src']);
    return json({
      url: finalUrl.href,
      title: title ? decode(title) : null,
      description: meta(html, ['og:description', 'twitter:description', 'description']),
      imageUrl: image ? new URL(image, finalUrl).href : null,
      siteName: meta(html, ['og:site_name']) ?? finalUrl.hostname.replace(/^www\./, ''),
    });
  } catch (e) {
    return json({ error: `Could not fetch page: ${e instanceof Error ? e.message : String(e)}` }, 502);
  }
});
