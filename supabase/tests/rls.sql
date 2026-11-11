begin;

-- Pokrenuti kroz `supabase test db`; test namjerno koristi dvije odvojene JWT sesije.
insert into auth.users (id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, aud, role)
values
  ('00000000-0000-4000-8000-000000000001', 'vlasnik-a@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{}', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-000000000002', 'vlasnik-b@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{}', 'authenticated', 'authenticated');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
insert into public.accounts (name, type, opening_balance_cents) values ('Privatni račun A', 'checking', 100000);

select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
do $$
declare affected integer;
begin
  if exists (select 1 from public.accounts where name = 'Privatni račun A') then
    raise exception 'RLS kvar: drugi korisnik može čitati račun.';
  end if;
  delete from public.accounts where name = 'Privatni račun A';
  get diagnostics affected = row_count;
  if affected <> 0 then
    raise exception 'RLS kvar: drugi korisnik može brisati račun.';
  end if;
end $$;

rollback;
