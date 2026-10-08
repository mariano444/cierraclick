# Vista previa dinámica en WhatsApp

WhatsApp lee las etiquetas `og:` del HTML que recibe; **no ejecuta JavaScript**. Por eso la vista previa
personalizada la arma el servidor (`functions/index.js`), no la app.

## Puesta en marcha (Cloudflare Pages)
1. Publicá esta carpeta en Cloudflare Pages (con Git o con `wrangler pages deploy`) para que se incluya `functions/`.
2. En Settings → Variables de entorno: `SUPABASE_URL` y `SUPABASE_ANON_KEY` (la clave pública `anon`).
3. En Supabase ejecutá `supabase_share_meta.sql` (ya viene dentro de `supabase_completo.sql`).
4. Probá pegando `https://tu-dominio/?p=ID` en un chat de WhatsApp. Si no aparece, esperá unos segundos.

## Qué muestra
- Título: "Ana, Taller Sur te armó una propuesta: Pintura de living".
- Descripción con datos reales: "Desde $90.000 · hasta 10% OFF · hasta 6 cuotas · reservá con el 30% de seña. Vence mañana: elegí tu opción…".
- Vencida o aceptada: texto distinto. Sin datos o ante un error: texto genérico.
- Las propuestas llevan `noindex` para que Google no las indexe.

## Límites
- WhatsApp guarda la vista previa de cada link: los links ya enviados no se actualizan.
- La imagen es la misma para todas las propuestas (PNG de 1200×630, menos de 300 KB).
- Solo funciona cuando las propuestas están en Supabase, no con los datos guardados en el navegador.
