-- NaokiTrader: esquema inicial. Ejecutar en el SQL Editor de Supabase o con `supabase db push`.

create table public.settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  initial_capital numeric(14,2) not null default 150 check (initial_capital >= 0),
  risk_pct numeric(5,2) not null default 3 check (risk_pct > 0 and risk_pct <= 100),
  max_trades_per_day int check (max_trades_per_day is null or max_trades_per_day > 0) default 1,
  timezone text not null default 'America/Bogota',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.trades (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  trade_date date not null,
  net_result numeric(14,2) not null,
  status text generated always as (case when net_result > 0 then 'win' when net_result < 0 then 'loss' else 'breakeven' end) stored,
  notes text check (char_length(notes) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index trades_user_date_idx on public.trades (user_id, trade_date);

create table public.cash_flows (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  flow_date date not null,
  amount numeric(14,2) not null check (amount <> 0), -- + depósito, - retiro
  notes text check (char_length(notes) <= 500),
  created_at timestamptz not null default now()
);
create index cash_flows_user_date_idx on public.cash_flows (user_id, flow_date);

-- Límite diario aplicado en la base de datos (no solo en el frontend).
create or replace function public.enforce_daily_trade_limit() returns trigger
language plpgsql security invoker set search_path = public as $$
declare lim int; n int;
begin
  select max_trades_per_day into lim from public.settings where user_id = new.user_id;
  if lim is null then return new; end if;
  select count(*) into n from public.trades
    where user_id = new.user_id and trade_date = new.trade_date and id <> new.id;
  if n >= lim then
    raise exception 'Límite diario de operaciones alcanzado para %', new.trade_date using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger trades_daily_limit before insert or update of trade_date on public.trades
  for each row execute function public.enforce_daily_trade_limit();

create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
create trigger trades_touch before update on public.trades for each row execute function public.touch_updated_at();
create trigger settings_touch before update on public.settings for each row execute function public.touch_updated_at();

-- Crear settings automáticamente al registrarse.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin insert into public.settings (user_id) values (new.id) on conflict do nothing; return new; end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- RLS
alter table public.settings enable row level security;
alter table public.trades enable row level security;
alter table public.cash_flows enable row level security;

create policy settings_select on public.settings for select to authenticated using (user_id = (select auth.uid()));
create policy settings_insert on public.settings for insert to authenticated with check (user_id = (select auth.uid()));
create policy settings_update on public.settings for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy trades_select on public.trades for select to authenticated using (user_id = (select auth.uid()));
create policy trades_insert on public.trades for insert to authenticated with check (user_id = (select auth.uid()));
create policy trades_update on public.trades for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy trades_delete on public.trades for delete to authenticated using (user_id = (select auth.uid()));

create policy flows_select on public.cash_flows for select to authenticated using (user_id = (select auth.uid()));
create policy flows_insert on public.cash_flows for insert to authenticated with check (user_id = (select auth.uid()));
create policy flows_update on public.cash_flows for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy flows_delete on public.cash_flows for delete to authenticated using (user_id = (select auth.uid()));

revoke all on public.settings, public.trades, public.cash_flows from anon;
