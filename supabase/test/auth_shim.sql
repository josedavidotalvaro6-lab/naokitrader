-- SOLO para pruebas en PostgreSQL local: imita lo mínimo de Supabase (auth.users, auth.uid(), roles).
-- NO usar en Supabase real.
create schema if not exists auth;
create table if not exists auth.users (id uuid primary key default gen_random_uuid(), instance_id uuid, aud text, role text, email text);
create or replace function auth.uid() returns uuid language sql stable as
$$ select nullif(current_setting('request.jwt.claims', true)::json ->> 'sub', '')::uuid $$;
do $$ begin
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
end $$;
grant usage on schema public, auth to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;
alter default privileges in schema public grant select, insert, update, delete on tables to authenticated;
