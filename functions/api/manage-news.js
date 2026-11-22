export async function onRequestPost({ request, env }) {
  if (!env.GOOGLE_SCRIPT_URL || !env.NEWS_API_SECRET) return json({error:"Server is not configured"},503);
  const identity = await verifyIdentity(request, env);
  if (!identity) return json({error:"Sign in with your newsroom account"},401);
  const email = identity.email;
  const role = identity.role;

  let payload;
  try { payload = await request.json(); } catch { return json({error:"Invalid JSON"},400); }
  const action = String(payload.action || "");
  if (!["create","update","delete","list"].includes(action)) return json({error:"Unsupported action"},400);
  if (action === "list") {
    try {
      const upstream = await fetch(env.GOOGLE_SCRIPT_URL, {method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"list",secret:env.NEWS_API_SECRET})});
      const result = await upstream.json();
      if (!upstream.ok || result.ok !== true) return json({error:result.error || "Could not load newsroom records"},502);
      const records = result.news || [];
      return json({ok:true,role,news:role === "admin" ? records : records.filter(n => n.status === "published" || String(n.author || "").toLowerCase() === email)});
    } catch { return json({error:"Could not load Google Sheets records"},502); }
  }
  if (role !== "admin" && action === "delete") return json({error:"Only administrators can delete published stories"},403);
  if (role !== "admin" && action === "update") {
    try {
      const check = await fetch(env.GOOGLE_SCRIPT_URL, {method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"list",secret:env.NEWS_API_SECRET})});
      const data = await check.json();
      const existing = (data.news || []).find(n => String(n.id) === String(payload.id));
      if (!existing || existing.status !== "draft" || String(existing.author || "").toLowerCase() !== email) return json({error:"Editors may only update their own draft stories"},403);
    } catch { return json({error:"Could not verify draft ownership"},502); }
  }
  if (role !== "admin" && payload.status === "published") {
    // Editors may submit stories for editorial review, but cannot publish directly.
    payload.status = "draft";
  }
  const clean = {
    action, id: String(payload.id || "").slice(0,100),
    title: String(payload.title || "").trim().slice(0,220),
    category: String(payload.category || "local"),
    summary: String(payload.summary || "").trim().slice(0,500),
    body: String(payload.body || "").trim().slice(0,20000),
    image: safeUrl(payload.image),
    source: String(payload.source || "نیوز ڈیسک").trim().slice(0,120),
    status: role === "admin" ? (payload.status === "draft" ? "draft" : "published") : "draft",
    featured: role === "admin" && payload.featured === true,
    breaking: role === "admin" && payload.breaking === true,
    author: email
  };
  if (action !== "delete" && (!clean.title || !clean.body)) return json({error:"Headline and story text are required"},400);
  if (!["local","civic","weather_traffic","sports_life"].includes(clean.category)) return json({error:"Invalid category"},400);
  try {
    const upstream = await fetch(env.GOOGLE_SCRIPT_URL, {
      method:"POST", headers:{"content-type":"application/json"},
      body:JSON.stringify({...clean, secret:env.NEWS_API_SECRET})
    });
    const result = await upstream.json();
    if (!upstream.ok || result.ok !== true) return json({error:result.error || "News database rejected the change"},502);
    return json({ok:true, role, result});
  } catch { return json({error:"Could not save to Google Sheets"},502); }
}
function csv(v){return String(v||"").split(",").map(x=>x.trim().toLowerCase()).filter(Boolean)}
function safeUrl(v){try{const u=new URL(String(v||""));return ["https:","http:"].includes(u.protocol)?u.href:""}catch{return ""}}
function safeEqual(a,b){a=String(a||"");b=String(b||"");if(!a||!b||a.length!==b.length)return false;let d=0;for(let i=0;i<a.length;i++)d|=a.charCodeAt(i)^b.charCodeAt(i);return d===0}
async function verifyIdentity(request,env){
  const auth=request.headers.get("authorization")||"";
  const pw=request.headers.get("x-admin-password")||(auth.toLowerCase().startsWith("bearer ")?auth.slice(7):"");
  if(pw){
    if(env.ADMIN_PASSWORD && safeEqual(pw,env.ADMIN_PASSWORD)) return {email:"admin",role:"admin"};
    if(env.EDITOR_PASSWORD && safeEqual(pw,env.EDITOR_PASSWORD)) return {email:"editor",role:"editor"};
    return null;
  }
  const identity=await verifyAccess(request,env);
  if(!identity)return null;
  const email=String(identity.email||"").toLowerCase();
  const admins=csv(env.ADMIN_EMAILS);
  const editors=csv(env.EDITOR_EMAILS);
  const role=admins.includes(email)?"admin":editors.includes(email)?"editor":null;
  if(!role)return null;
  return {email,role};
}
async function verifyAccess(request,env) {
  const token=request.headers.get("Cf-Access-Jwt-Assertion");
  if(!token || !env.CF_ACCESS_TEAM_DOMAIN || !env.CF_ACCESS_AUD) return null;
  const parts=token.split("."); if(parts.length!==3)return null;
  try {
    const payload=JSON.parse(atob(parts[1].replace(/-/g,"+").replace(/_/g,"/")));
    const now=Math.floor(Date.now()/1000);
    const issuer=`https://${env.CF_ACCESS_TEAM_DOMAIN}`;
    const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
    const allowedAudiences = csv(env.CF_ACCESS_AUD);
    if(payload.iss!==issuer || !audiences.some(a => allowedAudiences.includes(String(a))) || payload.exp<now || (payload.nbf && payload.nbf>now)) return null;
    const jwks=await fetch(`${issuer}/cdn-cgi/access/certs`).then(r=>r.json());
    const header=JSON.parse(atob(parts[0].replace(/-/g,"+").replace(/_/g,"/")));
    const jwk=jwks.keys.find(k=>k.kid===header.kid); if(!jwk)return null;
    const key=await crypto.subtle.importKey("jwk",jwk,{name:"RSASSA-PKCS1-v1_5",hash:"SHA-256"},false,["verify"]);
    const data=new TextEncoder().encode(`${parts[0]}.${parts[1]}`);
    const sig=Uint8Array.from(atob(parts[2].replace(/-/g,"+").replace(/_/g,"/")),c=>c.charCodeAt(0));
    if(!await crypto.subtle.verify("RSASSA-PKCS1-v1_5",key,sig,data))return null;
    return payload;
  } catch{return null}
}
function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff"}})}
