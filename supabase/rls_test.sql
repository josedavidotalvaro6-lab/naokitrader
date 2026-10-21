-- Prueba manual de RLS: ejecutar en una base de desarrollo de Supabase.
-- Crea dos usuarios, inserta datos como A y verifica que B no los ve ni los modifica.
begin;
insert into auth.users (id, instance_id, aud, role, email) values
 ('00000000-0000-0000-0000-00000000000a','00000000-0000-0000-0000-000000000000','authenticated','authenticated','a@test.local'),
 ('00000000-0000-0000-0000-00000000000b','00000000-0000-0000-0000-000000000000','authenticated','authenticated','b@test.local');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-00000000000a"}',true);
insert into public.trades (trade_date, net_result) values ('2026-01-05', 10);
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-00000000000b"}',true);
do $$ begin
  assert (select count(*) from public.trades) = 0, 'B ve datos de A';
  update public.trades set net_result = 999; assert not found, 'B modificó datos de A';
  begin insert into public.trades (user_id, trade_date, net_result) values ('00000000-0000-0000-0000-00000000000a','2026-01-06',1);
    raise exception 'B insertó como A'; exception when insufficient_privilege or check_violation then null; end;
end $$;
rollback;
