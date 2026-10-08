-- CierraClick · datos mínimos para los metadatos de WhatsApp (ejecutar si ya corriste supabase_completo.sql sin esta función)
-- Devuelve SOLO lo necesario para armar la vista previa: nombre de pila, negocio, título, precios, cuotas y vencimiento.
create or replace function public.get_share_meta(p_id uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'client_first', split_part(trim(c.name), ' ', 1),
    'business', b.name, 'title', p.title, 'kind', p.kind,
    'status', case when p.status in ('sent','viewed') and p.expires_at < public.today_ar() then 'expired' else p.status end,
    'expires_at', p.expires_at, 'days_left', p.expires_at - public.today_ar(),
    'deposit_pct', p.deposit_pct,
    'options_count', o.n, 'min_final', o.min_final, 'feat_price', o.feat_price, 'feat_final', o.feat_final,
    'max_off', o.max_off, 'max_inst', o.max_inst)
  from public.proposals p
  join public.clients c on c.id = p.client_id
  join public.businesses b on b.id = p.business_id
  cross join lateral (
    select count(*)::int n, min(final_price) min_final,
      (array_agg(price order by recommended desc, position))[1] feat_price,
      (array_agg(final_price order by recommended desc, position))[1] feat_final,
      max(case when price > 0 then round(100 * (price - final_price) / price) else 0 end)::int max_off,
      max(case when has_installments then installments end) max_inst
    from public.proposal_options where proposal_id = p.id) o
  where p.id = p_id
$$;
revoke execute on function public.get_share_meta(uuid) from public, anon, authenticated;
grant execute on function public.get_share_meta(uuid) to anon, authenticated;
