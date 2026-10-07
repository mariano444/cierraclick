# CierraClick — MVP HTML/CSS/JavaScript

Este paquete implementa el MVP planteado en el brief:

- Landing comercial
- Dashboard
- Crear propuesta de producto o servicio con 1 a 4 opciones (agregar/quitar)
- Descuentos por opción (% o monto fijo); garantía y cuotas opcionales
- Link público con `?p=ID`
- Selección y aceptación
- Link de seña para Mercado Pago
- WhatsApp con mensaje prearmado
- Estados: enviada / vista / aceptada / perdida
- Contador de visitas
- Clientes
- Panel “Performance CierraClick”
- Precios
- PWA básica
- Persistencia demo con `localStorage`

## Cómo probarlo

Abrí `index.html` directamente en el navegador. Para que el Service Worker/PWA funcione, conviene servir la carpeta con un servidor local (por ejemplo VS Code Live Server).

## Importante para producción

Este MVP es frontend/demo. No incluye autenticación real, base de datos multiusuario ni secretos de Mercado Pago.

Arquitectura recomendada para la versión real:

HTML/CSS/JS → Supabase (Auth + DB + Edge Functions)
                              ↘ Mercado Pago

En Supabase conviene almacenar:
usuarios, negocios, clientes, propuestas, opciones, visitas, eventos, aceptaciones y pagos.

El `paymentLink` del negocio puede guardarse en el perfil/configuración y aparecer en la propuesta después de la aceptación.

## Performance

Se priorizó:
- JavaScript nativo
- CSS sin framework
- `defer` para el JS
- Poca manipulación del DOM
- Sin imágenes pesadas
- PWA/cache local
- diseño mobile-first
- soporte `prefers-reduced-motion`

Antes de publicar, usar Lighthouse/PageSpeed y optimizar fuentes/analytics según los servicios que se agreguen.

## Siguiente integración técnica

1. Supabase Auth
2. Tablas y RLS
3. Slug público persistente
4. Registro de eventos/visitas
5. Mercado Pago por vendedor
6. Generación de links de WhatsApp
7. Analytics de conversión
8. Dominio personalizado por negocio

## Supabase

Ejecutá `supabase.sql` una sola vez en el SQL Editor de un proyecto nuevo. Crea tablas, RLS, un negocio automático por usuario y las funciones RPC: `create_proposal` (panel), `get_public_proposal` y `track_proposal` (link público, sin login).
