-- 0002: hora de ejecución (orden determinista dentro del día) y límite diario a prueba de concurrencia.

-- Hora local (America/Bogota) de ejecución. Opcional; si falta, se ordena por created_at y luego por id.
alter table public.trades add column if not exists trade_time time;

-- Antes, dos transacciones simultáneas podían contar 0 filas y ambas insertar. Ahora se serializan por
-- (usuario, fecha) con un advisory lock de transacción: la segunda espera al commit de la primera y,
-- al contar después de obtener el lock, ve la fila ya confirmada (READ COMMITTED toma snapshot por sentencia).
create or replace function public.enforce_daily_trade_limit() returns trigger
language plpgsql security invoker set search_path = public as $$
declare lim int; n int;
begin
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

drop trigger if exists trades_daily_limit on public.trades;
create trigger trades_daily_limit before insert or update of trade_date on public.trades
  for each row execute function public.enforce_daily_trade_limit();
