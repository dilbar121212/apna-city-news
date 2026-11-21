export async function onRequestGet({ env }) {
  if (!env.GOOGLE_SCRIPT_URL) return json({ error: "News feed is not configured", news: [] }, 503);
  try {
    const r = await fetch(env.GOOGLE_SCRIPT_URL, { headers: { "accept": "application/json" } });
    if (!r.ok) return json({ error: "News source unavailable", news: [] }, 502);
    const data = await r.json();
    return json({ news: Array.isArray(data.news) ? data.news : (Array.isArray(data) ? data : []) }, 200, {
      "Cache-Control": "public, max-age=30, s-maxage=60"
    });
  } catch {
    return json({ error: "Could not read news feed", news: [] }, 502);
  }
}
function json(data,status=200,extra={}) {
  return new Response(JSON.stringify(data), { status, headers: { "content-type":"application/json; charset=utf-8", "x-content-type-options":"nosniff", ...extra }});
}
