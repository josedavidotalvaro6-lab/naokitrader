-- 0003: integridad del libro mayor (capital nunca negativo) garantizada EN LA BASE DE DATOS.
-- Requiere 0001 y 0002 aplicadas antes. Ejecutar en orden.
--
-- Diseño:
--  1) Todo escritor (trades, cash_flows, settings) toma primero un advisory lock de transacción POR USUARIO.
--     Las escrituras del mismo usuario se serializan; la segunda espera al commit/rollback de la primera.
--  2) Tras cada cambio, un trigger AFTER ROW recalcula la línea de tiempo COMPLETA del usuario y aborta la
--     transacción si queda alguna infracción. Así también se validan ediciones y eliminaciones históricas.
--  3) Como la validación corre después de obtener el lock, ve todo lo ya confirmado (READ COMMITTED, el
--     snapshot se toma por sentencia). Requiere nivel de aislamiento READ COMMITTED (por defecto en Supabase).
-- Las reglas replican exactamente lib/finance/core.ts (validateTimeline); hay una prueba de paridad.

create or replace function public.lock_ledger(p_user uuid) returns void
language sql as $$ select pg_advisory_xact_lock(hashtextextended('ledger:' || p_user::text, 0)) $$;

-- Devuelve 0 filas si la línea de tiempo es válida, o 1 fila con la primera infracción.
-- Orden: fecha; ese día primero los flujos externos (sumados) y luego las operaciones por
-- hora (sin hora al final), created_at e id. Reglas: capital < 0 inválido; con capital <= 0 solo
-- se admiten operaciones de resultado 0.
create or replace function public.ledger_first_violation(p_user uuid)
returns table (kind text, vdate date, trade_id uuid, capital_before numeric, attempted numeric)
language plpgsql stable security invoker set search_path = public as $$
declare cap numeric; r record;
begin
  select coalesce((select s.initial_capital from public.settings s where s.user_id = p_user), 150) into cap;
  if cap < 0 then
    return query select 'negative_capital'::text, null::date, null::uuid, cap, cap; return;
  end if;
  for r in
    select x.d, x.ord, x.amt, x.tid from (
      select flow_date as d, 0 as ord, sum(amount) as amt, null::uuid as tid, null::time as t, null::timestamptz as c
        from public.cash_flows where user_id = p_user group by flow_date
      union all
      select trade_date, 1, net_result, id, coalesce(trade_time, time '24:00:00'), created_at
        from public.trades where user_id = p_user
    ) x order by x.d, x.ord, x.t, x.c, x.tid
  loop
    if r.ord = 0 then
      if cap + r.amt < 0 then
        return query select 'negative_capital'::text, r.d, null::uuid, cap, r.amt; return;
      end if;
    elsif r.amt <> 0 then
      if cap <= 0 then
        return query select 'no_capital_to_trade'::text, r.d, r.tid, cap, r.amt; return;
      elsif cap + r.amt < 0 then
        return query select 'negative_capital'::text, r.d, r.tid, cap, r.amt; return;
      end if;
    end if;
    cap := cap + r.amt;
  end loop;
end $$;

create or replace function public.lock_ledger_before() returns trigger
language plpgsql set search_path = public as $$
begin
  perform public.lock_ledger(case when tg_op = 'DELETE' then old.user_id else new.user_id end);
  return case when tg_op = 'DELETE' then old else new end;
end $$;

create or replace function public.enforce_ledger_integrity() returns trigger
language plpgsql set search_path = public as $$
declare uid uuid; v record;
begin
  uid := case when tg_op = 'DELETE' then old.user_id else new.user_id end;
  perform public.lock_ledger(uid);
  select * into v from public.ledger_first_violation(uid);
  if v.kind is not null then
    raise exception 'LEDGER: % el % (capital previo %, importe %)', v.kind, v.vdate, v.capital_before, v.attempted
      using errcode = 'NT001';
  end if;
  return null;
end $$;

-- El límite diario (0002) también toma primero el lock del usuario: orden de bloqueo único (ledger -> día), sin deadlocks.
create or replace function public.enforce_daily_trade_limit() returns trigger
language plpgsql security invoker set search_path = public as $$
declare lim int; n int;
begin
  perform public.lock_ledger(new.user_id);
  select max_trades_per_day into lim from public.settings where user_id = new.user_id;
  if lim is null then return new; end if;
  perform pg_advisory_xact_lock(hashtextextended('trades:' || new.user_id::text || ':' || new.trade_date::text, 0));
  select count(*) into n from public.trades
    where user_id = new.user_id and trade_date = new.trade_date and id <> new.id;
  if n >= lim then
    raise exception 'Límite diario de operaciones alcanzado para %', new.trade_date using errcode = 'P0001';
  end if;
  return new;
end $$;

-- Locks previos a la escritura (nombre 'a_' para que corran antes que otros BEFORE triggers).
drop trigger if exists trades_a_lock on public.trades;
create trigger trades_a_lock before insert or update or delete on public.trades for each row execute function public.lock_ledger_before();
drop trigger if exists cash_flows_a_lock on public.cash_flows;
create trigger cash_flows_a_lock before insert or update or delete on public.cash_flows for each row execute function public.lock_ledger_before();
drop trigger if exists settings_a_lock on public.settings;
create trigger settings_a_lock before insert or update on public.settings for each row execute function public.lock_ledger_before();

-- Validación posterior a la escritura.
drop trigger if exists trades_ledger on public.trades;
create trigger trades_ledger after insert or update or delete on public.trades for each row execute function public.enforce_ledger_integrity();
drop trigger if exists cash_flows_ledger on public.cash_flows;
create trigger cash_flows_ledger after insert or update or delete on public.cash_flows for each row execute function public.enforce_ledger_integrity();
drop trigger if exists settings_ledger on public.settings;
create trigger settings_ledger after insert or update of initial_capital on public.settings for each row execute function public.enforce_ledger_integrity();

-- Las funciones auxiliares no son para anon.
revoke execute on function public.lock_ledger(uuid), public.ledger_first_violation(uuid) from public, anon;
grant execute on function public.lock_ledger(uuid), public.ledger_first_violation(uuid) to authenticated;
