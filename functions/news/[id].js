// Cloudflare Pages Function: one real, indexable page per article at /news/<id>
// Data comes from the same Google Sheet feed (via GOOGLE_SCRIPT_URL) as /api/public-news,
// so new stories get a page automatically — no rebuild needed.
export async function onRequestGet({ env, params }) {
  const id = String(params.id || "").trim();
  const site = "https://apna-city-news.pages.dev";
  const ogFallback = "https://raw.githubusercontent.com/dilbar121212/apna-city-news/main/assets/og-image.png";

  if (!env.GOOGLE_SCRIPT_URL) return htmlPage(503, notFoundHtml(site, "خبر کا فیڈ ترتیب نہیں ہوا"), true);
  let news = [];
  try {
    const r = await fetch(env.GOOGLE_SCRIPT_URL, { headers: { accept: "application/json" } });
    if (!r.ok) return htmlPage(502, notFoundHtml(site, "خبر کا ذریعہ دستیاب نہیں"), true);
    const data = await r.json();
    news = Array.isArray(data.news) ? data.news : (Array.isArray(data) ? data : []);
  } catch {
    return htmlPage(502, notFoundHtml(site, "خبر کا ذریعہ دستیاب نہیں"), true);
  }

  const n = news.find((x) => x && x.id === id);
  if (!n) return htmlPage(404, notFoundHtml(site, "یہ خبر نہیں ملی"), true);

  const url = site + "/news/" + encodeURIComponent(n.id);
  const title = String(n.title || "اپنا سٹی نیوز").trim();
  const summary = String(n.summary || n.body || "").replace(/\s+/g, " ").trim();
  const desc = summary.length > 155 ? summary.slice(0, 152) + "…" : summary;
  const body = String(n.body || n.summary || "");
  const image = String(n.image || "").trim();
  const isDirectImage = /\.(jpe?g|png|webp|gif|avif)(\?|$)/i.test(image);
  const isVideo = /\.(mp4|webm)(\?|$)/i.test(image);
  const yt = ytId(image);
  const ogImage = !isDirectImage ? ogFallback : image;
  const pub = isoDate(n.createdAt) || isoDate(n.updatedAt) || "2026-11-23";
  const upd = isoDate(n.updatedAt) || pub;
  const dateUr = fmtUr(n.createdAt || n.updatedAt);
  const cat = CAT[String(n.category || "")] || "خبر";
  const source = String(n.source || "اپنا سٹی نیوز").trim();
  const sourceLink = /^https?:\/\//i.test(source)
    ? `<a href="${escAttr(source)}" target="_blank" rel="noopener">ماخذ</a>`
    : esc(source);

  const media = isVideo
    ? `<video controls preload="metadata" src="${escAttr(image)}" style="width:100%;border-radius:12px"></video>`
    : yt
    ? `<iframe src="https://www.youtube.com/embed/${yt}" style="width:100%;aspect-ratio:16/9;border:0;border-radius:12px" allowfullscreen loading="lazy"></iframe>`
    : isDirectImage
    ? `<img src="${escAttr(image)}" alt="${escAttr(title)}" style="width:100%;border-radius:12px" loading="lazy">`
    : "";

  const paras = body.split(/\n+/).map((p) => p.trim()).filter(Boolean)
    .map((p) => `<p>${esc(p)}</p>`).join("\n") || `<p>${esc(summary)}</p>`;

  const ld = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: title,
    description: desc,
    image: [ogImage],
    datePublished: pub,
    dateModified: upd,
    author: { "@type": "NewsMediaOrganization", name: "اپنا سٹی نیوز", url: site },
    publisher: { "@type": "NewsMediaOrganization", name: "اپنا سٹی نیوز", url: site },
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    inLanguage: "ur",
    articleSection: cat
  };
  const crumbs = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "ہوم", item: site + "/" },
      { "@type": "ListItem", position: 2, name: title, item: url }
    ]
  };

  const shareText = encodeURIComponent(title + " " + url);
  const page = `<!DOCTYPE html>
<html lang="ur" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} | اپنا سٹی نیوز</title>
<meta name="description" content="${escAttr(desc)}">
<link rel="canonical" href="${url}">
<meta name="robots" content="index, follow, max-image-preview:large">
<meta name="theme-color" content="#0a1f33">
<meta property="og:type" content="article">
<meta property="og:site_name" content="اپنا سٹی نیوز">
<meta property="og:locale" content="ur_PK">
<meta property="og:title" content="${escAttr(title)}">
<meta property="og:description" content="${escAttr(desc)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${escAttr(ogImage)}">
<meta property="og:image:alt" content="${escAttr(title)}">
<meta property="article:published_time" content="${pub}">
<meta property="article:modified_time" content="${upd}">
<meta property="article:section" content="${escAttr(cat)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escAttr(title)}">
<meta name="twitter:description" content="${escAttr(desc)}">
<meta name="twitter:image" content="${escAttr(ogImage)}">
<script type="application/ld+json">${JSON.stringify(ld)}</script>
<script type="application/ld+json">${JSON.stringify(crumbs)}</script>
<style>
body{margin:0;font-family:system-ui,"Noto Nastaliq Urdu",Tahoma,sans-serif;background:#f4f6f8;color:#17202a;line-height:2}
header{background:#0a1f33;color:#fff;padding:14px 16px;position:sticky;top:0}
header a{color:#fff;text-decoration:none;font-weight:800;font-size:20px}
header span{color:#ff3b30}
main{max-width:760px;margin:0 auto;padding:20px 16px 40px;background:#fff}
.pill{display:inline-block;background:#ff3b30;color:#fff;border-radius:999px;padding:2px 12px;font-size:13px}
h1{font-size:26px;line-height:1.7;margin:10px 0}
.meta{color:#667085;font-size:14px;border-bottom:1px solid #e5e8eb;padding-bottom:12px;margin-bottom:16px}
.lead{font-weight:700;font-size:18px}
.share{display:flex;gap:8px;flex-wrap:wrap;margin-top:24px;padding-top:16px;border-top:1px solid #e5e8eb}
.share a,.share button{border:1px solid #d0d5dd;border-radius:999px;padding:6px 14px;text-decoration:none;color:#17202a;background:#fff;font-size:14px;cursor:pointer}
.back{display:inline-block;margin-bottom:12px;color:#0a1f33;text-decoration:none;font-weight:700}
footer{text-align:center;color:#667085;font-size:13px;padding:20px}
</style>
</head>
<body>
<header><a href="/">اپنا سٹی <span>نیوز</span></a></header>
<main>
<a class="back" href="/">← تمام خبریں</a>
<span class="pill">${esc(cat)}</span>
<h1>${esc(title)}</h1>
<div class="meta">${sourceLink} · ${esc(dateUr)}</div>
${media}
<p class="lead">${esc(summary)}</p>
${paras}
<div class="share"><span>شیئر کریں:</span>
<a target="_blank" rel="noopener" href="https://wa.me/?text=${shareText}">WhatsApp</a>
<a target="_blank" rel="noopener" href="https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}">Facebook</a>
<a target="_blank" rel="noopener" href="https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&amp;url=${encodeURIComponent(url)}">X</a>
<button onclick="navigator.clipboard&&navigator.clipboard.writeText('${url}');this.textContent='کاپی ہو گیا ✓'">لنک کاپی کریں</button>
</div>
</main>
<footer>اپنا سٹی نیوز — آپ کے شہر کی ہر خبر، سب سے پہلے</footer>
</body>
</html>`;

  return new Response(page, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, max-age=60, s-maxage=120",
      "x-content-type-options": "nosniff"
    }
  });
}

function htmlPage(status, body, noindex) {
  return new Response(body, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      ...(noindex ? { "x-robots-tag": "noindex" } : {})
    }
  });
}

function notFoundHtml(site, msg) {
  return `<!DOCTYPE html><html lang="ur" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${esc(msg)} | اپنا سٹی نیوز</title></head><body style="font-family:system-ui,Tahoma,sans-serif;text-align:center;padding:60px 20px"><h1>${esc(msg)}</h1><p><a href="${site}/">← ہوم پیج پر واپس جائیں</a></p></body></html>`;
}

const CAT = { local: "مقامی", civic: "شہری", weather_traffic: "موسم و ٹریفک", sports_life: "کھیل و زندگی" };

function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function escAttr(s) { return esc(s); }

function isoDate(v) {
  if (!v) return "";
  const d = new Date(v);
  if (isNaN(d)) return String(v).slice(0, 10);
  return d.toISOString().slice(0, 10);
}

function fmtUr(v) {
  if (!v) return "";
  const d = new Date(v);
  if (isNaN(d)) return String(v);
  try {
    return d.toLocaleDateString("ur-PK", { day: "numeric", month: "long", year: "numeric" });
  } catch {
    return d.toISOString().slice(0, 10);
  }
}

function ytId(u) {
  if (!u) return "";
  let m = String(u).match(/(?:youtube\.com\/watch\?[^#]*v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]{6,})/);
  return m ? m[1] : "";
}
