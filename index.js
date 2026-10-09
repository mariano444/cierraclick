// Cloudflare Pages Function para la ruta "/". Sirve el index.html estático con metadatos
// dinámicos cuando el link trae ?p=ID (WhatsApp no ejecuta JavaScript: lee el HTML tal cual).
// Variables de entorno: SUPABASE_URL y SUPABASE_ANON_KEY (la clave pública "anon").
import { UUID, landingMeta, proposalMeta, applyMeta } from "./_lib/meta.js";

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url), id = url.searchParams.get("p");
  const asset = await env.ASSETS.fetch(new Request(url.origin + "/"));
  let html = await asset.text();
  const headers = new Headers({ "content-type": "text/html; charset=utf-8" });
  let block;

  if (id && UUID.test(id)) {
    let data = null;
    if (env.SUPABASE_URL && env.SUPABASE_ANON_KEY) {
      try {
        const r = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/get_share_meta`, {
          method: "POST",
          // Las claves nuevas "sb_publishable_..." no son JWT: con ellas solo va el header apikey.
          headers: { apikey: env.SUPABASE_ANON_KEY, ...(env.SUPABASE_ANON_KEY.startsWith("sb_") ? {} : { authorization: `Bearer ${env.SUPABASE_ANON_KEY}` }), "content-type": "application/json" },
          body: JSON.stringify({ p_id: id })
        });
        if (r.ok) data = await r.json();
      } catch { /* si falla, se usa el texto genérico */ }
    }
    block = proposalMeta(data, url.origin, id);
    headers.set("x-robots-tag", "noindex, nofollow");
    headers.set("cache-control", "public, max-age=0, s-maxage=60");
  } else {
    block = landingMeta(url.origin);
    headers.set("cache-control", "public, max-age=300");
  }
  return new Response(applyMeta(html, block, url.origin), { headers });
}
