// Cloudflare Pages Function para la ruta "/". Sirve el index.html estático con metadatos
// dinámicos cuando el link trae ?p=ID (WhatsApp no ejecuta JavaScript: lee el HTML tal cual).
// Variables de entorno opcionales: SUPABASE_URL y SUPABASE_ANON_KEY. Si faltan se usan los valores
// públicos de config.js (son públicos por diseño: los datos los protege RLS y la función solo expone lo mínimo).
import { UUID, landingMeta, proposalMeta, applyMeta } from "./_lib/meta.js";

const DEFAULT_URL = "https://rnlioprgwhcjzcbcsopq.supabase.co";
const DEFAULT_KEY = "sb_publishable_BOM_9hz5f4oqSyURpejxnQ_uk-YBBXv";

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url), id = url.searchParams.get("p");
  const asset = await env.ASSETS.fetch(new Request(url.origin + "/"));
  let html = await asset.text();
  const headers = new Headers({ "content-type": "text/html; charset=utf-8" });
  let block;

  if (id !== null) {
    // Cualquier link con ?p= es una propuesta: nunca mostramos metadatos de la landing.
    let data = null;
    const base = env.SUPABASE_URL || DEFAULT_URL, key = env.SUPABASE_ANON_KEY || DEFAULT_KEY;
    if (UUID.test(id)) {
      try {
        const r = await fetch(`${base}/rest/v1/rpc/get_share_meta`, {
          method: "POST",
          // Las claves nuevas "sb_publishable_..." no son JWT: con ellas solo va el header apikey.
          headers: { apikey: key, ...(key.startsWith("sb_") ? {} : { authorization: `Bearer ${key}` }), "content-type": "application/json" },
          body: JSON.stringify({ p_id: id })
        });
        if (r.ok) data = await r.json();
      } catch { /* si falla, se usa el texto genérico */ }
    }
    block = proposalMeta(data, url.origin, id);
    // Pinta la clase antes del primer render: la landing no parpadea.
    html = html.replace('<html lang="es">', '<html lang="es" class="proposal-mode">');
    headers.set("x-robots-tag", "noindex, nofollow");
    headers.set("cache-control", "public, max-age=0, s-maxage=60");
  } else {
    block = landingMeta(url.origin);
    headers.set("cache-control", "public, max-age=300");
  }
  return new Response(applyMeta(html, block, url.origin), { headers });
}
