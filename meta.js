// Metadatos para compartir (WhatsApp, Facebook, X, etc.). Lógica pura: sin dependencias de Cloudflare.
export const SITE = "CierraClick";
export const PLACEHOLDER = "https://TU-DOMINIO.com";
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DIAS = ["domingo","lunes","martes","miércoles","jueves","viernes","sábado"];
const MESES = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];

export const money = n => "$" + Math.round(Number(n) || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
export const fecha = iso => { const d = new Date(`${iso}T12:00:00Z`); return `${DIAS[d.getUTCDay()]} ${d.getUTCDate()} de ${MESES[d.getUTCMonth()]}`; };
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const cut = (s, n) => (s.length <= n ? s : s.slice(0, n - 1).replace(/\s+\S*$/, "") + "…");

const GENERIC = {
  title: "Tu propuesta está lista",
  desc: "Mirá las opciones, elegí la que más te sirve y reservá con seña. Todo desde el celular, sin vueltas."
};

// Texto persuasivo según el estado real de la propuesta. Solo usa datos verdaderos (nada de escasez inventada).
export function copyFor(m) {
  if (!m) return GENERIC;
  const first = (m.client_first || "").trim(), biz = m.business || SITE;
  if (m.status === "expired")
    return { title: cut(`Propuesta vencida · ${biz}`, 70), desc: cut(`Esta propuesta venció el ${fecha(m.expires_at)}. Escribile a ${biz} y te la actualizan para retomarla.`, 190) };
  if (m.status === "accepted")
    return { title: cut(`Propuesta aceptada ✔ · ${biz}`, 70), desc: "Ya confirmaste tu opción. Entrá para ver cómo reservar con la seña y descargar tu constancia." };
  if (m.status === "lost") return GENERIC;

  const multi = Number(m.options_count) > 1, off = Number(m.max_off) || 0, left = Number(m.days_left);
  const bits = [];
  const names = Array.isArray(m.option_names) ? m.option_names.filter(Boolean).slice(0, 3) : [];
  if (multi && names.length) bits.push(`${Number(m.options_count)} opciones: ${names.join(", ")}`);
  if (multi) bits.push(`desde ${money(m.min_final)}`);
  else if (Number(m.feat_price) > Number(m.feat_final)) bits.push(`${money(m.feat_final)} (antes ${money(m.feat_price)})`);
  else bits.push(money(m.feat_final));
  if (off > 0) bits.push(multi ? `hasta ${off}% OFF` : `${off}% OFF`);
  if (Number(m.max_inst) > 1) bits.push(`hasta ${Number(m.max_inst)} cuotas`);
  if (Number(m.deposit_pct) > 0) bits.push(`reservá con el ${Number(m.deposit_pct)}% de seña`);
  const urgency = left <= 0 ? "Vence hoy" : left === 1 ? "Vence mañana" : left <= 3 ? `Vence en ${left} días` : `Válida hasta el ${fecha(m.expires_at)}`;
  return {
    title: cut(`${first ? first + ", " : ""}${biz} te armó una propuesta: ${m.title}`, 70),
    desc: cut(`${bits.join(" · ")}. ${urgency}: elegí${multi ? " tu opción" : ""} y confirmá desde el celular.`, 190)
  };
}

export function metaBlock({ title, desc, url, image, alt, noindex }) {
  const t = esc(title), d = esc(desc), u = esc(url), i = esc(image), a = esc(alt);
  return [
    `<title>${t}</title>`,
    `<meta name="description" content="${d}">`,
    `<link rel="canonical" href="${u}">`,
    noindex ? `<meta name="robots" content="noindex, nofollow">` : "",
    `<meta property="og:type" content="website">`,
    `<meta property="og:site_name" content="${SITE}">`,
    `<meta property="og:locale" content="es_AR">`,
    `<meta property="og:title" content="${t}">`,
    `<meta property="og:description" content="${d}">`,
    `<meta property="og:url" content="${u}">`,
    `<meta property="og:image" content="${i}">`,
    `<meta property="og:image:type" content="image/png">`,
    `<meta property="og:image:width" content="1200">`,
    `<meta property="og:image:height" content="630">`,
    `<meta property="og:image:alt" content="${a}">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${t}">`,
    `<meta name="twitter:description" content="${d}">`,
    `<meta name="twitter:image" content="${i}">`
  ].filter(Boolean).join("\n    ");
}

export const landingMeta = (origin = PLACEHOLDER) => metaBlock({
  title: "CierraClick · Propuestas que se cierran por WhatsApp",
  desc: "Armá una propuesta con opciones, descuentos y seña en minutos. Tu cliente la elige desde el celular y vos cerrás más ventas.",
  url: origin + "/", image: origin + "/og-landing.png", alt: "CierraClick: propuestas con opciones y seña, listas para enviar por WhatsApp"
});

export const proposalMeta = (m, origin, id) => {
  const c = copyFor(m);
  return metaBlock({ title: c.title, desc: c.desc, url: `${origin}/?p=${id}`, image: origin + "/og-propuesta.png",
    alt: "Tu propuesta: elegí una opción y reservá con seña", noindex: true });
};

// Reemplaza el bloque entre marcadores y el dominio de ejemplo. Usa función para que "$" en los precios no se interprete.
export function applyMeta(html, block, origin) {
  return html.replace(/<!--OG:start-->[\s\S]*?<!--OG:end-->/, () => `<!--OG:start-->\n    ${block}\n    <!--OG:end-->`)
    .split(PLACEHOLDER).join(origin);
}
