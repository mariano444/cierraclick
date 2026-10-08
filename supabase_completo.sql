-- =====================================================================
-- CierraClick · ESQUEMA COMPLETO para Supabase (proyecto NUEVO)
-- Reemplaza a supabase.sql + supabase_catalog.sql + supabase_v2.sql: NO ejecutes esos.
-- Pegalo entero en SQL Editor → Run. Zona horaria de vencimientos: Argentina.
--
-- ¿Ya ejecutaste los archivos anteriores? Descomentá este bloque para borrar todo
-- (⚠ BORRA TODOS LOS DATOS) y volvé a ejecutar el script:
-- drop trigger if exists on_auth_user_created on auth.users;
-- drop function if exists public.handle_new_user() cascade;
-- drop view if exists public.client_summary, public.today_agenda;
-- drop table if exists public.proposal_events, public.catalog_items, public.proposal_options,
--   public.proposals, public.clients, public.businesses cascade;
-- drop function if exists public.today_ar(), public.my_business_ids(), public.enforce_max_options(),
--   public.create_proposal(jsonb), public.get_public_proposal(uuid), public.track_proposal(uuid,text,uuid),
--   public.report_deposit_transfer(uuid), public.renew_proposal(uuid,int), public.record_follow_up(uuid),
--   public.confirm_deposit(uuid), public.mark_lost(uuid), public.refresh_expired(),
--   public.save_catalog_item(jsonb), public.dashboard_stats(), public.get_share_meta(uuid);
-- =====================================================================

create function public.today_ar() returns date
language sql stable as $$ select (now() at time zone 'America/Argentina/Buenos_Aires')::date $$;

-- ============================ TABLAS ============================
create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references auth.users(id) on delete cascade,
  name text not null default 'Mi negocio',
  whatsapp text not null default '',
  payment_link text not null default '',          -- link de Mercado Pago (opcional)
  brand_color text not null default '#0b1220',
  plan text not null default 'demo',
  holder text not null default '',                -- datos para transferir la seña
  bank text not null default '',
  cbu text not null default '' check (cbu = '' or cbu ~ '^[0-9]{22}$'),
  alias text not null default '' check (alias = '' or alias ~ '^[A-Za-z0-9.-]{6,20}$'),
  cuit text not null default '',
  transfer_note text not null default '',
  created_at timestamptz not null default now()
);

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  phone text not null,
  created_at timestamptz not null default now(),
  unique (business_id, phone)
);

create table public.proposals (
  id uuid primary key default gen_random_uuid(),          -- se usa como ?p=ID (no adivinable)
  business_id uuid not null references public.businesses(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete restrict,
  kind text not null default 'service' check (kind in ('product','service')),
  title text not null,
  includes text[] not null default '{}',
  conditions text not null default '',
  status text not null default 'sent' check (status in ('sent','viewed','accepted','lost','expired')),
  expires_at date not null default (public.today_ar() + 7),
  payments text[] not null default '{cash,transfer,mp}' check (payments <@ array['cash','transfer','mp']),
  cash_discount numeric(5,2) not null default 0 check (cash_discount between 0 and 50),
  deposit_pct numeric(5,2) not null default 0 check (deposit_pct between 0 and 100),
  views int not null default 0,
  chosen_option_id uuid,
  deposit_started int not null default 0,
  follow_ups int not null default 0,
  last_event text not null default '',
  created_at timestamptz not null default now(),
  last_viewed_at timestamptz,
  last_follow_up_at timestamptz,
  accepted_at timestamptz,
  proof_sent_at timestamptz,      -- el cliente avisó que transfirió
  deposit_paid_at timestamptz     -- el dueño confirmó la seña
);

create table public.proposal_options (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.proposals(id) on delete cascade,
  position int not null default 0,
  name text not null default 'Opción',
  price numeric(14,2) not null default 0 check (price >= 0),
  discount_type text not null default 'percent' check (discount_type in ('percent','fixed')),
  discount_value numeric(14,2) not null default 0 check (discount_value >= 0),
  final_price numeric(14,2) generated always as (
    greatest(0, price - case when discount_type = 'percent'
                             then price * least(discount_value, 100) / 100
                             else least(discount_value, price) end)
  ) stored,
  description text not null default '',
  has_installments boolean not null default false,
  installments int not null default 3 check (installments >= 2),
  has_warranty boolean not null default false,
  warranty text not null default '',
  features text not null default '',      -- una característica por línea
  terms text not null default '',         -- términos y condiciones de la opción
  recommended boolean not null default false
);
create unique index one_recommended_per_proposal on public.proposal_options (proposal_id) where recommended;

alter table public.proposals add constraint proposals_chosen_fk
  foreign key (chosen_option_id) references public.proposal_options(id) on delete set null;

create table public.proposal_events (
  id bigint generated always as identity primary key,
  proposal_id uuid not null references public.proposals(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  type text not null check (type in ('created','view','select','accept','deposit_click','follow_up','renew','proof','deposit_paid','lost')),
  option_id uuid,
  message text not null,
  created_at timestamptz not null default now()
);

create table public.catalog_items (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  kind text not null check (kind in ('product','service')),
  name text not null,
  price numeric(14,2) not null default 0 check (price >= 0),
  discount_type text not null default 'percent' check (discount_type in ('percent','fixed')),
  discount_value numeric(14,2) not null default 0 check (discount_value >= 0),
  description text not null default '',
  has_installments boolean not null default false,
  installments int not null default 3 check (installments >= 2),
  has_warranty boolean not null default false,
  warranty text not null default '',
  features text not null default '',
  terms text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, kind, name)
);

create index on public.clients (business_id);
create index on public.proposals (business_id, created_at desc);
create index on public.proposals (business_id, status, expires_at);
create index on public.proposal_options (proposal_id);
create index on public.proposal_events (business_id, created_at desc);
create index on public.catalog_items (business_id, kind);

-- ============================ VISTAS ============================
create view public.client_summary with (security_invoker = true) as
  select c.id, c.business_id, c.name, c.phone, count(p.id)::int as proposals
  from public.clients c left join public.proposals p on p.client_id = c.id
  group by c.id;

-- Agenda "Hoy": propuestas a seguir, ordenadas por prioridad (0 = más urgente).
create view public.today_agenda with (security_invoker = true) as
  select * from (
    select p.id, p.business_id, c.name as client_name, c.phone, p.status, p.expires_at,
      case
        when p.status = 'accepted' and p.proof_sent_at is not null and p.deposit_paid_at is null then 'verify_deposit'
        when p.status = 'expired' or (p.status in ('sent','viewed') and p.expires_at < public.today_ar()) then 'expired'
        when p.status in ('sent','viewed') and p.expires_at <= public.today_ar() + 2 then 'expiring'
        when p.status = 'viewed' and greatest(coalesce(p.last_viewed_at, p.created_at), coalesce(p.last_follow_up_at, p.created_at)) <= now() - interval '24 hours' then 'viewed_no_reply'
        when p.status = 'sent' and greatest(p.created_at, coalesce(p.last_follow_up_at, p.created_at)) <= now() - interval '24 hours' then 'unopened'
      end as reason
    from public.proposals p join public.clients c on c.id = p.client_id
  ) t where reason is not null;

-- ============================ TRIGGERS ============================
create function public.enforce_max_options() returns trigger
language plpgsql as $$
begin
  if (select count(*) from public.proposal_options where proposal_id = new.proposal_id) >= 4 then
    raise exception 'Máximo 4 opciones por propuesta';
  end if;
  return new;
end $$;
create trigger trg_max_options before insert on public.proposal_options
  for each row execute function public.enforce_max_options();

-- Un negocio por usuario, creado al registrarse (el app envía business_name en el signUp).
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.businesses (owner_id, name)
  values (new.id, coalesce(nullif(trim(new.raw_user_meta_data->>'business_name'), ''), 'Mi negocio'))
  on conflict do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();
insert into public.businesses (owner_id) select id from auth.users on conflict do nothing;

-- ============================ RLS (panel) ============================
create function public.my_business_ids() returns setof uuid
language sql stable security definer set search_path = public as $$
  select id from public.businesses where owner_id = auth.uid()
$$;

alter table public.businesses       enable row level security;
alter table public.clients          enable row level security;
alter table public.proposals        enable row level security;
alter table public.proposal_options enable row level security;
alter table public.proposal_events  enable row level security;
alter table public.catalog_items    enable row level security;

create policy owner_all on public.businesses for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy owner_all on public.clients for all to authenticated
  using (business_id in (select public.my_business_ids())) with check (business_id in (select public.my_business_ids()));
create policy owner_all on public.proposals for all to authenticated
  using (business_id in (select public.my_business_ids())) with check (business_id in (select public.my_business_ids()));
create policy owner_all on public.proposal_events for all to authenticated
  using (business_id in (select public.my_business_ids())) with check (business_id in (select public.my_business_ids()));
create policy owner_all on public.catalog_items for all to authenticated
  using (business_id in (select public.my_business_ids())) with check (business_id in (select public.my_business_ids()));
create policy owner_all on public.proposal_options for all to authenticated
  using (exists (select 1 from public.proposals p where p.id = proposal_options.proposal_id and p.business_id in (select public.my_business_ids())))
  with check (exists (select 1 from public.proposals p where p.id = proposal_options.proposal_id and p.business_id in (select public.my_business_ids())));

-- ============================ FUNCIONES · PANEL (requieren login) ============================
-- supabase.rpc('create_proposal', { p: { kind, client:{name,phone}, title, expiresAt:'YYYY-MM-DD',
--   payments:['cash','transfer','mp'], cashDiscount, depositPct, includes:[], conditions,
--   options:[{name,price,discountType,discountValue,description,hasInstallments,installments,
--             hasWarranty,warranty,features,terms,recommended}] } })  → devuelve el id de la propuesta
create function public.create_proposal(p jsonb) returns uuid
language plpgsql security invoker set search_path = public as $$
declare v_biz uuid; v_client uuid; v_prop uuid; o jsonb; i int := 0; n int; v_exp date; v_phone text;
begin
  select id into v_biz from public.businesses where owner_id = auth.uid();
  if v_biz is null then raise exception 'Sin negocio asociado'; end if;
  n := jsonb_array_length(coalesce(p->'options', '[]'::jsonb));
  if n = 0 then raise exception 'La propuesta necesita al menos una opción'; end if;
  if n > 4 then raise exception 'Máximo 4 opciones por propuesta'; end if;
  if coalesce(trim(p->'client'->>'name'), '') = '' then raise exception 'Falta el nombre del cliente'; end if;
  v_phone := regexp_replace(coalesce(p->'client'->>'phone', ''), '\D', '', 'g');
  if v_phone = '' then raise exception 'Falta el WhatsApp del cliente'; end if;
  v_exp := coalesce((p->>'expiresAt')::date, public.today_ar() + 7);
  if v_exp < public.today_ar() then raise exception 'La fecha de vencimiento ya pasó'; end if;

  insert into public.clients (business_id, name, phone)
  values (v_biz, trim(p->'client'->>'name'), v_phone)
  on conflict (business_id, phone) do update set name = excluded.name
  returning id into v_client;

  insert into public.proposals (business_id, client_id, kind, title, includes, conditions, expires_at,
                                payments, cash_discount, deposit_pct, last_event)
  values (v_biz, v_client, coalesce(p->>'kind', 'service'), coalesce(nullif(trim(p->>'title'), ''), 'Propuesta'),
          coalesce(array(select jsonb_array_elements_text(coalesce(p->'includes', '[]'::jsonb))), '{}'),
          coalesce(p->>'conditions', ''), v_exp,
          coalesce(array(select jsonb_array_elements_text(coalesce(p->'payments', '["cash","transfer","mp"]'::jsonb))), '{}'),
          coalesce((p->>'cashDiscount')::numeric, 0), coalesce((p->>'depositPct')::numeric, 0), 'Propuesta creada.')
  returning id into v_prop;

  for o in select * from jsonb_array_elements(p->'options') loop
    i := i + 1;
    insert into public.proposal_options (proposal_id, position, name, price, discount_type, discount_value, description,
      has_installments, installments, has_warranty, warranty, features, terms, recommended)
    values (v_prop, i, coalesce(nullif(trim(o->>'name'), ''), 'Opción'), coalesce((o->>'price')::numeric, 0),
      coalesce(o->>'discountType', 'percent'), coalesce((o->>'discountValue')::numeric, 0), coalesce(o->>'description', ''),
      coalesce((o->>'hasInstallments')::boolean, false), greatest(2, coalesce((o->>'installments')::int, 3)),
      coalesce((o->>'hasWarranty')::boolean, false), coalesce(o->>'warranty', ''),
      coalesce(o->>'features', ''), coalesce(o->>'terms', ''),
      coalesce((o->>'recommended')::boolean, false) and n > 1);
  end loop;

  insert into public.proposal_events (proposal_id, business_id, type, message)
  values (v_prop, v_biz, 'created', 'Creaste una propuesta para ' || trim(p->'client'->>'name') || '.');
  return v_prop;
end $$;

-- Pasa a "expired" las propuestas vencidas (llamala al abrir el panel).
create function public.refresh_expired() returns int
language plpgsql security invoker set search_path = public as $$
declare n int;
begin
  update public.proposals set status = 'expired', last_event = 'La propuesta venció.'
  where status in ('sent','viewed') and expires_at < public.today_ar();
  get diagnostics n = row_count;
  return n;
end $$;

-- Renueva (por defecto 7 días desde hoy) y reactiva una propuesta vencida.
create function public.renew_proposal(p_id uuid, p_days int default 7) returns date
language plpgsql security invoker set search_path = public as $$
declare p public.proposals; d date;
begin
  select * into p from public.proposals where id = p_id;
  if not found then raise exception 'Propuesta inexistente'; end if;
  if p.status in ('accepted','lost') then raise exception 'Esa propuesta ya está cerrada'; end if;
  d := public.today_ar() + greatest(1, least(p_days, 90));
  update public.proposals set expires_at = d, last_event = 'Propuesta renovada.',
    status = case when status = 'expired' then (case when views > 0 then 'viewed' else 'sent' end) else status end
  where id = p_id;
  insert into public.proposal_events (proposal_id, business_id, type, message)
  values (p_id, p.business_id, 'renew', 'Renovaste la propuesta hasta el ' || to_char(d, 'DD/MM/YYYY') || '.');
  return d;
end $$;

-- Registra que enviaste un seguimiento por WhatsApp.
create function public.record_follow_up(p_id uuid) returns void
language plpgsql security invoker set search_path = public as $$
declare p public.proposals;
begin
  update public.proposals set follow_ups = follow_ups + 1, last_follow_up_at = now(), last_event = 'Seguimiento enviado.'
  where id = p_id returning * into p;
  if not found then raise exception 'Propuesta inexistente'; end if;
  insert into public.proposal_events (proposal_id, business_id, type, message)
  values (p_id, p.business_id, 'follow_up', 'Enviaste un seguimiento.');
end $$;

-- Confirma que la seña fue recibida.
create function public.confirm_deposit(p_id uuid) returns void
language plpgsql security invoker set search_path = public as $$
declare p public.proposals;
begin
  update public.proposals set deposit_paid_at = now(), last_event = 'Seña recibida.'
  where id = p_id and status = 'accepted' returning * into p;
  if not found then raise exception 'La propuesta no está aceptada'; end if;
  insert into public.proposal_events (proposal_id, business_id, type, message)
  values (p_id, p.business_id, 'deposit_paid', 'Confirmaste la seña.');
end $$;

create function public.mark_lost(p_id uuid) returns void
language plpgsql security invoker set search_path = public as $$
declare p public.proposals;
begin
  update public.proposals set status = 'lost', last_event = 'Marcada como perdida.'
  where id = p_id and status <> 'accepted' returning * into p;
  if not found then raise exception 'No se puede marcar como perdida'; end if;
  insert into public.proposal_events (proposal_id, business_id, type, message)
  values (p_id, p.business_id, 'lost', 'Marcaste la propuesta como perdida.');
end $$;

-- Guarda o actualiza un ítem del catálogo (clave: tipo + nombre).
create function public.save_catalog_item(p jsonb) returns uuid
language plpgsql security invoker set search_path = public as $$
declare v_biz uuid; v_id uuid;
begin
  select id into v_biz from public.businesses where owner_id = auth.uid();
  if v_biz is null then raise exception 'Sin negocio asociado'; end if;
  if coalesce(trim(p->>'name'), '') = '' then raise exception 'El nombre es obligatorio'; end if;
  insert into public.catalog_items (business_id, kind, name, price, discount_type, discount_value, description,
    has_installments, installments, has_warranty, warranty, features, terms)
  values (v_biz, coalesce(p->>'kind', 'service'), trim(p->>'name'), coalesce((p->>'price')::numeric, 0),
    coalesce(p->>'discountType', 'percent'), coalesce((p->>'discountValue')::numeric, 0), coalesce(p->>'description', ''),
    coalesce((p->>'hasInstallments')::boolean, false), greatest(2, coalesce((p->>'installments')::int, 3)),
    coalesce((p->>'hasWarranty')::boolean, false), coalesce(p->>'warranty', ''),
    coalesce(p->>'features', ''), coalesce(p->>'terms', ''))
  on conflict (business_id, kind, name) do update set
    price = excluded.price, discount_type = excluded.discount_type, discount_value = excluded.discount_value,
    description = excluded.description, has_installments = excluded.has_installments, installments = excluded.installments,
    has_warranty = excluded.has_warranty, warranty = excluded.warranty, features = excluded.features,
    terms = excluded.terms, updated_at = now()
  returning id into v_id;
  return v_id;
end $$;

-- Métricas del panel en una sola llamada.
create function public.dashboard_stats() returns jsonb
language sql stable security invoker set search_path = public as $$
  with base as (
    select p.*,
      case when p.status in ('sent','viewed') and p.expires_at < public.today_ar() then 'expired' else p.status end as eff,
      (select o.final_price from public.proposal_options o where o.proposal_id = p.id
        order by (o.id = p.chosen_option_id) desc, o.recommended desc, o.position limit 1) as amount
    from public.proposals p)
  select jsonb_build_object(
    'total', count(*),
    'sent', count(*) filter (where eff = 'sent'),
    'viewed', count(*) filter (where eff = 'viewed'),
    'accepted', count(*) filter (where eff = 'accepted'),
    'expired', count(*) filter (where eff = 'expired'),
    'lost', count(*) filter (where eff = 'lost'),
    'views', coalesce(sum(views), 0),
    'conversion', case when count(*) = 0 then 0 else round(100.0 * count(*) filter (where eff = 'accepted') / count(*)) end,
    'pending_amount', coalesce(sum(amount) filter (where eff in ('sent','viewed')), 0),
    'deposits_to_verify', count(*) filter (where eff = 'accepted' and proof_sent_at is not null and deposit_paid_at is null),
    'week_sent', count(*) filter (where created_at > now() - interval '7 days'),
    'week_accepted', count(*) filter (where eff = 'accepted' and accepted_at > now() - interval '7 days'),
    'week_closed_amount', coalesce(sum(amount) filter (where eff = 'accepted' and accepted_at > now() - interval '7 days'), 0))
  from base
$$;

-- ============================ FUNCIONES · PÚBLICAS (link del cliente, sin login) ============================
-- Devuelve la propuesta lista para mostrar. Los datos de pago solo salen cuando ya fue aceptada.
create function public.get_public_proposal(p_id uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', p.id, 'kind', p.kind, 'title', p.title, 'includes', to_jsonb(p.includes), 'conditions', p.conditions,
    'status', case when p.status in ('sent','viewed') and p.expires_at < public.today_ar() then 'expired' else p.status end,
    'expiresAt', p.expires_at, 'payments', to_jsonb(p.payments), 'cashDiscount', p.cash_discount, 'depositPct', p.deposit_pct,
    'chosenOption', p.chosen_option_id, 'proofSentAt', p.proof_sent_at, 'depositPaidAt', p.deposit_paid_at,
    'client', jsonb_build_object('name', c.name),
    'business', jsonb_build_object('name', b.name, 'whatsapp', b.whatsapp, 'brandColor', b.brand_color) ||
      case when p.status = 'accepted' then jsonb_build_object('paymentLink', b.payment_link, 'holder', b.holder,
        'bank', b.bank, 'cbu', b.cbu, 'alias', b.alias, 'cuit', b.cuit, 'transferNote', b.transfer_note)
      else '{}'::jsonb end,
    'options', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', o.id, 'name', o.name, 'price', o.price, 'discountType', o.discount_type, 'discountValue', o.discount_value,
        'finalPrice', o.final_price, 'description', o.description, 'hasInstallments', o.has_installments,
        'installments', o.installments, 'hasWarranty', o.has_warranty, 'warranty', o.warranty,
        'features', o.features, 'terms', o.terms, 'recommended', o.recommended) order by o.position), '[]'::jsonb)
      from public.proposal_options o where o.proposal_id = p.id))
  from public.proposals p
  join public.clients c on c.id = p.client_id
  join public.businesses b on b.id = p.business_id
  where p.id = p_id
$$;

-- Registra vista / elección / aceptación / clic en pagar.
-- supabase.rpc('track_proposal', { p_id, p_type: 'view'|'select'|'accept'|'deposit_click', p_option })
create function public.track_proposal(p_id uuid, p_type text, p_option uuid default null) returns void
language plpgsql security definer set search_path = public as $$
declare p public.proposals; cname text; opt uuid; oname text; msg text; overdue boolean;
begin
  select * into p from public.proposals where id = p_id;
  if not found then raise exception 'Propuesta inexistente'; end if;
  overdue := p.status in ('sent','viewed') and p.expires_at < public.today_ar();
  select name into cname from public.clients where id = p.client_id;
  if p_option is not null then
    select id, name into opt, oname from public.proposal_options where id = p_option and proposal_id = p_id;
    if opt is null then raise exception 'Opción inválida'; end if;
  end if;

  if p_type = 'view' then
    msg := cname || ' abrió una propuesta.';
    update public.proposals set views = views + 1, last_viewed_at = now(),
      status = case when overdue then 'expired' when status = 'sent' then 'viewed' else status end,
      last_event = 'Cliente abrió la propuesta.' where id = p_id;
  elsif p_type in ('select','accept') and (overdue or p.status in ('expired','lost')) then
    raise exception 'La propuesta venció';
  elsif p_type = 'select' then
    if opt is null then raise exception 'Falta la opción'; end if;
    msg := cname || ' seleccionó ' || oname || '.';
    update public.proposals set chosen_option_id = opt, last_event = 'Cliente eligió ' || oname || '.' where id = p_id;
  elsif p_type = 'accept' then
    if p.status = 'accepted' then return; end if;
    opt := coalesce(opt, p.chosen_option_id,
      (select id from public.proposal_options where proposal_id = p_id order by recommended desc, position limit 1));
    msg := cname || ' aceptó la propuesta.';
    update public.proposals set status = 'accepted', accepted_at = now(), chosen_option_id = opt,
      last_event = 'Cliente aceptó la propuesta.' where id = p_id;
  elsif p_type = 'deposit_click' then
    msg := cname || ' inició el pago de la seña.';
    update public.proposals set deposit_started = deposit_started + 1, last_event = 'Cliente fue a pagar la seña.' where id = p_id;
  else
    raise exception 'Tipo de evento inválido';
  end if;

  insert into public.proposal_events (proposal_id, business_id, type, option_id, message)
  values (p_id, p.business_id, p_type, opt, msg);
end $$;

-- El cliente avisa que transfirió la seña (el comprobante lo envía por WhatsApp).
create function public.report_deposit_transfer(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare p public.proposals; cname text;
begin
  select * into p from public.proposals where id = p_id and status = 'accepted';
  if not found then raise exception 'La propuesta no está aceptada'; end if;
  select name into cname from public.clients where id = p.client_id;
  update public.proposals set proof_sent_at = now(), last_event = 'Cliente avisó que transfirió la seña.' where id = p_id;
  insert into public.proposal_events (proposal_id, business_id, type, message)
  values (p_id, p.business_id, 'proof', cname || ' avisó que transfirió la seña.');
end $$;

-- ============================ PERMISOS ============================
revoke all on all tables in schema public from anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;

revoke execute on function
  public.my_business_ids(), public.create_proposal(jsonb), public.refresh_expired(), public.renew_proposal(uuid,int),
  public.record_follow_up(uuid), public.confirm_deposit(uuid), public.mark_lost(uuid), public.save_catalog_item(jsonb),
  public.dashboard_stats(), public.get_public_proposal(uuid), public.track_proposal(uuid,text,uuid),
  public.report_deposit_transfer(uuid) from public, anon, authenticated;

grant execute on function
  public.my_business_ids(), public.create_proposal(jsonb), public.refresh_expired(), public.renew_proposal(uuid,int),
  public.record_follow_up(uuid), public.confirm_deposit(uuid), public.mark_lost(uuid), public.save_catalog_item(jsonb),
  public.dashboard_stats() to authenticated;
grant execute on function
  public.get_public_proposal(uuid), public.track_proposal(uuid,text,uuid), public.report_deposit_transfer(uuid)
  to anon, authenticated;

-- ============================ METADATOS PARA COMPARTIR (WhatsApp) ============================
create function public.get_share_meta(p_id uuid) returns jsonb
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

-- Opcional: avisos en vivo en el panel
-- alter publication supabase_realtime add table public.proposals, public.proposal_events;
