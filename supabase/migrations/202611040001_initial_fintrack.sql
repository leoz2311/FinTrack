begin;

create extension if not exists pgcrypto;

create type public.account_type as enum ('checking', 'cash', 'savings', 'brokerage', 'credit_card', 'other_asset', 'other_liability');
create type public.card_type as enum ('debit', 'credit');
create type public.category_kind as enum ('expense', 'income');
create type public.spending_priority as enum ('essential', 'lifestyle', 'discretionary');
create type public.transaction_kind as enum ('expense', 'income', 'transfer', 'adjustment', 'investment_trade', 'valuation');
create type public.entry_kind as enum ('account', 'expense', 'income', 'equity', 'investment');
create type public.investment_event_type as enum ('purchase', 'sale');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  currency text not null default 'EUR' check (currency = 'EUR'),
  timezone text not null default 'Europe/Zagreb' check (timezone = 'Europe/Zagreb'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  name text not null check (length(trim(name)) between 1 and 80),
  type public.account_type not null,
  currency text not null default 'EUR' check (currency = 'EUR'),
  opening_balance_cents bigint not null default 0,
  description text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, owner_id)
);

create table public.cards (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  account_id uuid not null,
  name text not null check (length(trim(name)) between 1 and 80),
  type public.card_type not null,
  last_four text check (last_four is null or last_four ~ '^[0-9]{4}$'),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, owner_id),
  foreign key (account_id, owner_id) references public.accounts(id, owner_id) on delete restrict
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  name text not null check (length(trim(name)) between 1 and 60),
  kind public.category_kind not null,
  default_priority public.spending_priority,
  color text not null default '#64748b' check (color ~ '^#[0-9a-fA-F]{6}$'),
  icon text not null default 'circle',
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, owner_id),
  unique (owner_id, kind, name),
  check ((kind = 'income' and default_priority is null) or kind = 'expense')
);

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  kind public.transaction_kind not null,
  occurred_at timestamptz not null,
  description text not null check (length(trim(description)) between 1 and 160),
  category_id uuid,
  priority public.spending_priority,
  card_id uuid,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, owner_id),
  foreign key (category_id, owner_id) references public.categories(id, owner_id) on delete restrict,
  foreign key (card_id, owner_id) references public.cards(id, owner_id) on delete restrict,
  check ((kind = 'expense' and category_id is not null and priority is not null) or kind <> 'expense')
);

create table public.transaction_entries (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  transaction_id uuid not null,
  account_id uuid,
  kind public.entry_kind not null,
  amount_cents bigint not null check (amount_cents <> 0),
  created_at timestamptz not null default now(),
  foreign key (transaction_id, owner_id) references public.transactions(id, owner_id) on delete cascade,
  foreign key (account_id, owner_id) references public.accounts(id, owner_id) on delete restrict,
  check ((kind = 'account' and account_id is not null) or (kind <> 'account' and account_id is null))
);

create table public.transaction_history (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  transaction_id uuid,
  action text not null check (action in ('update', 'delete')),
  previous_data jsonb not null,
  changed_at timestamptz not null default now()
);

create table public.budgets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  month date not null check (date_trunc('month', month)::date = month),
  spending_limit_cents bigint not null default 0 check (spending_limit_cents >= 0),
  expected_income_cents bigint check (expected_income_cents is null or expected_income_cents >= 0),
  planned_savings_cents bigint not null default 0 check (planned_savings_cents >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, owner_id),
  unique (owner_id, month)
);

create table public.budget_allocations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  budget_id uuid not null,
  category_id uuid not null,
  amount_cents bigint not null check (amount_cents >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (budget_id, owner_id) references public.budgets(id, owner_id) on delete cascade,
  foreign key (category_id, owner_id) references public.categories(id, owner_id) on delete restrict,
  unique (budget_id, category_id)
);

create table public.savings_goals (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  account_id uuid,
  name text not null check (length(trim(name)) between 1 and 100),
  target_cents bigint not null check (target_cents > 0),
  starting_cents bigint not null default 0 check (starting_cents >= 0),
  target_date date,
  color text not null default '#34d399' check (color ~ '^#[0-9a-fA-F]{6}$'),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, owner_id),
  foreign key (account_id, owner_id) references public.accounts(id, owner_id) on delete restrict
);

create table public.investments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  account_id uuid not null,
  name text not null check (length(trim(name)) between 1 and 100),
  symbol text,
  asset_type text not null check (asset_type in ('stock', 'etf', 'fund', 'bond', 'crypto', 'other')),
  currency text not null default 'EUR',
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, owner_id),
  foreign key (account_id, owner_id) references public.accounts(id, owner_id) on delete restrict
);

create table public.investment_positions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  investment_id uuid not null,
  quantity numeric(28,10) not null check (quantity >= 0),
  cost_basis_cents bigint not null check (cost_basis_cents >= 0),
  as_of timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (investment_id, owner_id) references public.investments(id, owner_id) on delete cascade,
  unique (investment_id)
);

create table public.investment_valuations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  investment_id uuid not null,
  market_value_cents bigint not null check (market_value_cents >= 0),
  valued_at timestamptz not null default now(),
  note text,
  created_at timestamptz not null default now(),
  foreign key (investment_id, owner_id) references public.investments(id, owner_id) on delete cascade,
  unique (investment_id, valued_at)
);

create table public.investment_events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  investment_id uuid not null,
  transaction_id uuid not null,
  type public.investment_event_type not null,
  quantity numeric(28,10) not null check (quantity > 0),
  amount_cents bigint not null check (amount_cents > 0),
  occurred_at timestamptz not null,
  created_at timestamptz not null default now(),
  foreign key (investment_id, owner_id) references public.investments(id, owner_id) on delete cascade,
  foreign key (transaction_id, owner_id) references public.transactions(id, owner_id) on delete restrict
);

create table public.balance_snapshots (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  snapshot_date date not null,
  net_worth_cents bigint not null,
  liquid_cents bigint not null,
  investment_cents bigint not null,
  liability_cents bigint not null,
  created_at timestamptz not null default now(),
  unique (owner_id, snapshot_date)
);

create index accounts_owner_active_idx on public.accounts(owner_id) where archived_at is null;
create index cards_owner_active_idx on public.cards(owner_id) where archived_at is null;
create index categories_owner_kind_idx on public.categories(owner_id, kind) where archived_at is null;
create index transactions_owner_occurred_idx on public.transactions(owner_id, occurred_at desc);
create index transactions_owner_kind_idx on public.transactions(owner_id, kind, occurred_at desc);
create index entries_owner_account_idx on public.transaction_entries(owner_id, account_id);
create index entries_transaction_idx on public.transaction_entries(transaction_id);
create index budgets_owner_month_idx on public.budgets(owner_id, month desc);
create index valuations_owner_investment_idx on public.investment_valuations(owner_id, investment_id, valued_at desc);
create index investment_events_owner_idx on public.investment_events(owner_id, investment_id, occurred_at desc);
create index snapshots_owner_date_idx on public.balance_snapshots(owner_id, snapshot_date desc);

create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_touch before update on public.profiles for each row execute function public.touch_updated_at();
create trigger accounts_touch before update on public.accounts for each row execute function public.touch_updated_at();
create trigger cards_touch before update on public.cards for each row execute function public.touch_updated_at();
create trigger categories_touch before update on public.categories for each row execute function public.touch_updated_at();
create trigger transactions_touch before update on public.transactions for each row execute function public.touch_updated_at();
create trigger budgets_touch before update on public.budgets for each row execute function public.touch_updated_at();
create trigger allocations_touch before update on public.budget_allocations for each row execute function public.touch_updated_at();
create trigger goals_touch before update on public.savings_goals for each row execute function public.touch_updated_at();
create trigger investments_touch before update on public.investments for each row execute function public.touch_updated_at();
create trigger positions_touch before update on public.investment_positions for each row execute function public.touch_updated_at();

create or replace function public.validate_card_account()
returns trigger language plpgsql security definer set search_path = public as $$
declare account_kind public.account_type;
begin
  select type into account_kind from public.accounts where id = new.account_id and owner_id = new.owner_id;
  if account_kind is null then raise exception 'Povezani račun ne postoji.'; end if;
  if new.type = 'credit' and account_kind <> 'credit_card' then
    raise exception 'Kreditna kartica mora biti povezana s računom kreditne obveze.';
  end if;
  if new.type = 'debit' and account_kind in ('credit_card', 'other_liability') then
    raise exception 'Debitna kartica mora biti povezana s računom imovine.';
  end if;
  return new;
end;
$$;
create trigger cards_validate before insert or update of account_id, type on public.cards for each row execute function public.validate_card_account();

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name) values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)));
  insert into public.categories (owner_id, name, kind, default_priority, color, icon) values
    (new.id, 'Namirnice', 'expense', 'essential', '#34d399', 'shopping-basket'),
    (new.id, 'Stanovanje', 'expense', 'essential', '#60a5fa', 'house'),
    (new.id, 'Režije', 'expense', 'essential', '#38bdf8', 'zap'),
    (new.id, 'Prijevoz', 'expense', 'essential', '#f59e0b', 'car'),
    (new.id, 'Zdravlje', 'expense', 'essential', '#f87171', 'heart-pulse'),
    (new.id, 'Restorani', 'expense', 'lifestyle', '#fb923c', 'utensils'),
    (new.id, 'Odjeća', 'expense', 'lifestyle', '#a78bfa', 'shirt'),
    (new.id, 'Pretplate', 'expense', 'lifestyle', '#818cf8', 'repeat'),
    (new.id, 'Obrazovanje', 'expense', 'essential', '#2dd4bf', 'graduation-cap'),
    (new.id, 'Putovanja', 'expense', 'lifestyle', '#22d3ee', 'plane'),
    (new.id, 'Zabava', 'expense', 'discretionary', '#e879f9', 'party-popper'),
    (new.id, 'Pokloni', 'expense', 'discretionary', '#f472b6', 'gift'),
    (new.id, 'Ostalo', 'expense', 'discretionary', '#94a3b8', 'circle'),
    (new.id, 'Plaća', 'income', null, '#34d399', 'briefcase-business'),
    (new.id, 'Honorar', 'income', null, '#2dd4bf', 'laptop'),
    (new.id, 'Bonus', 'income', null, '#a3e635', 'sparkles'),
    (new.id, 'Kamate', 'income', null, '#60a5fa', 'percent'),
    (new.id, 'Dar', 'income', null, '#f472b6', 'gift'),
    (new.id, 'Ostali prihod', 'income', null, '#94a3b8', 'circle');
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create or replace function public.assert_balanced_transaction(p_transaction_id uuid, p_owner_id uuid)
returns void language plpgsql set search_path = public as $$
declare entry_total bigint; entry_count integer;
begin
  select coalesce(sum(amount_cents), 0), count(*) into entry_total, entry_count
  from public.transaction_entries where transaction_id = p_transaction_id and owner_id = p_owner_id;
  if entry_count < 2 or entry_total <> 0 then
    raise exception 'Transakcija mora imati najmanje dvije stavke i zbroj stavki mora biti nula.';
  end if;
end;
$$;

create or replace function public.create_financial_transaction(
  p_kind public.transaction_kind,
  p_description text,
  p_amount_cents bigint,
  p_occurred_at timestamptz,
  p_source_account_id uuid,
  p_destination_account_id uuid default null,
  p_category_id uuid default null,
  p_priority public.spending_priority default null,
  p_card_id uuid default null,
  p_notes text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  tx_id uuid := gen_random_uuid();
  effective_source uuid := p_source_account_id;
  card_account uuid;
  card_kind public.card_type;
  category_type public.category_kind;
begin
  if uid is null then raise exception 'Prijava je obavezna.'; end if;
  if p_amount_cents <= 0 then raise exception 'Iznos mora biti veći od nule.'; end if;
  if p_kind not in ('expense', 'income', 'transfer') then raise exception 'Koristite posebnu operaciju za ovu vrstu knjiženja.'; end if;

  if p_card_id is not null then
    select account_id, type into card_account, card_kind from public.cards
    where id = p_card_id and owner_id = uid and archived_at is null;
    if card_account is null then raise exception 'Kartica nije dostupna.'; end if;
    effective_source := card_account;
  end if;

  if not exists (select 1 from public.accounts where id = effective_source and owner_id = uid and archived_at is null) then
    raise exception 'Odabrani račun nije dostupan.';
  end if;

  if p_kind = 'expense' then
    select kind into category_type from public.categories where id = p_category_id and owner_id = uid and archived_at is null;
    if category_type <> 'expense' or p_priority is null then raise exception 'Trošak treba kategoriju i prioritet.'; end if;
    insert into public.transactions(id, owner_id, kind, occurred_at, description, category_id, priority, card_id, notes)
      values (tx_id, uid, p_kind, p_occurred_at, trim(p_description), p_category_id, p_priority, p_card_id, p_notes);
    insert into public.transaction_entries(owner_id, transaction_id, account_id, kind, amount_cents) values
      (uid, tx_id, effective_source, 'account', -p_amount_cents),
      (uid, tx_id, null, 'expense', p_amount_cents);
  elsif p_kind = 'income' then
    if p_card_id is not null then raise exception 'Prihod se ne knjiži karticom.'; end if;
    select kind into category_type from public.categories where id = p_category_id and owner_id = uid and archived_at is null;
    if category_type <> 'income' then raise exception 'Prihod treba prihodovnu kategoriju.'; end if;
    insert into public.transactions(id, owner_id, kind, occurred_at, description, category_id, notes)
      values (tx_id, uid, p_kind, p_occurred_at, trim(p_description), p_category_id, p_notes);
    insert into public.transaction_entries(owner_id, transaction_id, account_id, kind, amount_cents) values
      (uid, tx_id, effective_source, 'account', p_amount_cents),
      (uid, tx_id, null, 'income', -p_amount_cents);
  else
    if p_card_id is not null or p_category_id is not null then raise exception 'Transfer nema karticu ni kategoriju.'; end if;
    if p_destination_account_id is null or p_destination_account_id = effective_source then raise exception 'Odaberite različit odredišni račun.'; end if;
    if not exists (select 1 from public.accounts where id = p_destination_account_id and owner_id = uid and archived_at is null) then
      raise exception 'Odredišni račun nije dostupan.';
    end if;
    insert into public.transactions(id, owner_id, kind, occurred_at, description, notes)
      values (tx_id, uid, p_kind, p_occurred_at, trim(p_description), p_notes);
    insert into public.transaction_entries(owner_id, transaction_id, account_id, kind, amount_cents) values
      (uid, tx_id, effective_source, 'account', -p_amount_cents),
      (uid, tx_id, p_destination_account_id, 'account', p_amount_cents);
  end if;
  perform public.assert_balanced_transaction(tx_id, uid);
  return tx_id;
end;
$$;

create or replace function public.delete_financial_transaction(p_transaction_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); snapshot jsonb;
begin
  select jsonb_build_object('transaction', to_jsonb(t), 'entries', coalesce((select jsonb_agg(to_jsonb(e)) from public.transaction_entries e where e.transaction_id = t.id), '[]'::jsonb))
    into snapshot from public.transactions t where t.id = p_transaction_id and t.owner_id = uid;
  if snapshot is null then raise exception 'Transakcija nije pronađena.'; end if;
  insert into public.transaction_history(owner_id, transaction_id, action, previous_data) values (uid, p_transaction_id, 'delete', snapshot);
  delete from public.transactions where id = p_transaction_id and owner_id = uid;
end;
$$;

create or replace function public.update_financial_transaction(
  p_transaction_id uuid,
  p_kind public.transaction_kind,
  p_description text,
  p_amount_cents bigint,
  p_occurred_at timestamptz,
  p_source_account_id uuid,
  p_destination_account_id uuid default null,
  p_category_id uuid default null,
  p_priority public.spending_priority default null,
  p_card_id uuid default null,
  p_notes text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  effective_source uuid := p_source_account_id;
  card_account uuid;
  category_type public.category_kind;
  snapshot jsonb;
begin
  if uid is null then raise exception 'Prijava je obavezna.'; end if;
  if p_amount_cents <= 0 or p_kind not in ('expense', 'income', 'transfer') then raise exception 'Neispravna vrsta ili iznos.'; end if;
  select jsonb_build_object('transaction', to_jsonb(t), 'entries', coalesce((select jsonb_agg(to_jsonb(e)) from public.transaction_entries e where e.transaction_id = t.id), '[]'::jsonb))
    into snapshot from public.transactions t where t.id = p_transaction_id and t.owner_id = uid;
  if snapshot is null then raise exception 'Transakcija nije pronađena.'; end if;
  insert into public.transaction_history(owner_id, transaction_id, action, previous_data) values (uid, p_transaction_id, 'update', snapshot);

  if p_card_id is not null then
    select account_id into card_account from public.cards where id = p_card_id and owner_id = uid and archived_at is null;
    if card_account is null then raise exception 'Kartica nije dostupna.'; end if;
    effective_source := card_account;
  end if;
  if not exists (select 1 from public.accounts where id = effective_source and owner_id = uid and archived_at is null) then raise exception 'Odabrani račun nije dostupan.'; end if;

  delete from public.transaction_entries where transaction_id = p_transaction_id and owner_id = uid;
  if p_kind = 'expense' then
    select kind into category_type from public.categories where id = p_category_id and owner_id = uid and archived_at is null;
    if category_type <> 'expense' or p_priority is null then raise exception 'Trošak treba kategoriju i prioritet.'; end if;
    update public.transactions set kind = p_kind, occurred_at = p_occurred_at, description = trim(p_description), category_id = p_category_id, priority = p_priority, card_id = p_card_id, notes = p_notes where id = p_transaction_id and owner_id = uid;
    insert into public.transaction_entries(owner_id, transaction_id, account_id, kind, amount_cents) values
      (uid, p_transaction_id, effective_source, 'account', -p_amount_cents), (uid, p_transaction_id, null, 'expense', p_amount_cents);
  elsif p_kind = 'income' then
    select kind into category_type from public.categories where id = p_category_id and owner_id = uid and archived_at is null;
    if category_type <> 'income' or p_card_id is not null then raise exception 'Prihod treba prihodovnu kategoriju i nema karticu.'; end if;
    update public.transactions set kind = p_kind, occurred_at = p_occurred_at, description = trim(p_description), category_id = p_category_id, priority = null, card_id = null, notes = p_notes where id = p_transaction_id and owner_id = uid;
    insert into public.transaction_entries(owner_id, transaction_id, account_id, kind, amount_cents) values
      (uid, p_transaction_id, effective_source, 'account', p_amount_cents), (uid, p_transaction_id, null, 'income', -p_amount_cents);
  else
    if p_destination_account_id is null or p_destination_account_id = effective_source then raise exception 'Odaberite različit odredišni račun.'; end if;
    if not exists (select 1 from public.accounts where id = p_destination_account_id and owner_id = uid and archived_at is null) then raise exception 'Odredišni račun nije dostupan.'; end if;
    update public.transactions set kind = p_kind, occurred_at = p_occurred_at, description = trim(p_description), category_id = null, priority = null, card_id = null, notes = p_notes where id = p_transaction_id and owner_id = uid;
    insert into public.transaction_entries(owner_id, transaction_id, account_id, kind, amount_cents) values
      (uid, p_transaction_id, effective_source, 'account', -p_amount_cents), (uid, p_transaction_id, p_destination_account_id, 'account', p_amount_cents);
  end if;
  perform public.assert_balanced_transaction(p_transaction_id, uid);
  return p_transaction_id;
end;
$$;

create or replace function public.reconcile_account(
  p_account_id uuid,
  p_target_balance_cents bigint,
  p_occurred_at timestamptz,
  p_note text default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); current_balance bigint; difference bigint; tx_id uuid := gen_random_uuid();
begin
  select a.opening_balance_cents + coalesce(sum(e.amount_cents), 0) into current_balance
  from public.accounts a left join public.transaction_entries e on e.account_id = a.id
  where a.id = p_account_id and a.owner_id = uid group by a.id;
  if current_balance is null then raise exception 'Račun nije pronađen.'; end if;
  difference := p_target_balance_cents - current_balance;
  if difference = 0 then raise exception 'Račun je već usklađen.'; end if;
  insert into public.transactions(id, owner_id, kind, occurred_at, description, notes)
    values (tx_id, uid, 'adjustment', p_occurred_at, 'Usklađenje računa', p_note);
  insert into public.transaction_entries(owner_id, transaction_id, account_id, kind, amount_cents) values
    (uid, tx_id, p_account_id, 'account', difference),
    (uid, tx_id, null, 'equity', -difference);
  perform public.assert_balanced_transaction(tx_id, uid);
  return tx_id;
end;
$$;

create or replace function public.save_monthly_budget(
  p_month date,
  p_spending_limit_cents bigint,
  p_expected_income_cents bigint,
  p_planned_savings_cents bigint,
  p_allocations jsonb
) returns uuid language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); budget_uuid uuid; allocation jsonb;
begin
  if uid is null then raise exception 'Prijava je obavezna.'; end if;
  if date_trunc('month', p_month)::date <> p_month then raise exception 'Mjesec mora biti prvi dan mjeseca.'; end if;
  if p_spending_limit_cents < 0 or coalesce(p_expected_income_cents, 0) < 0 or p_planned_savings_cents < 0 then raise exception 'Planirani iznosi ne mogu biti negativni.'; end if;
  insert into public.budgets(owner_id, month, spending_limit_cents, expected_income_cents, planned_savings_cents)
  values (uid, p_month, p_spending_limit_cents, p_expected_income_cents, p_planned_savings_cents)
  on conflict (owner_id, month) do update set spending_limit_cents = excluded.spending_limit_cents, expected_income_cents = excluded.expected_income_cents, planned_savings_cents = excluded.planned_savings_cents
  returning id into budget_uuid;
  delete from public.budget_allocations where budget_id = budget_uuid and owner_id = uid;
  for allocation in select * from jsonb_array_elements(coalesce(p_allocations, '[]'::jsonb)) loop
    if (allocation ->> 'amount_cents')::bigint > 0 then
      if not exists (select 1 from public.categories where id = (allocation ->> 'category_id')::uuid and owner_id = uid and kind = 'expense' and archived_at is null) then raise exception 'Kategorija budžeta nije dostupna.'; end if;
      insert into public.budget_allocations(owner_id, budget_id, category_id, amount_cents) values (uid, budget_uuid, (allocation ->> 'category_id')::uuid, (allocation ->> 'amount_cents')::bigint);
    end if;
  end loop;
  return budget_uuid;
end;
$$;

create or replace function public.record_investment_trade(
  p_investment_id uuid,
  p_type public.investment_event_type,
  p_quantity numeric,
  p_amount_cents bigint,
  p_occurred_at timestamptz
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  brokerage_account uuid;
  investment_name text;
  tx_id uuid := gen_random_uuid();
  old_quantity numeric(28,10) := 0;
  old_cost bigint := 0;
  old_value bigint := 0;
  cost_reduction bigint := 0;
begin
  if uid is null then raise exception 'Prijava je obavezna.'; end if;
  if p_quantity <= 0 or p_amount_cents <= 0 then raise exception 'Količina i iznos moraju biti veći od nule.'; end if;
  select account_id, name into brokerage_account, investment_name from public.investments where id = p_investment_id and owner_id = uid and archived_at is null;
  if brokerage_account is null then raise exception 'Ulaganje nije pronađeno.'; end if;
  select quantity, cost_basis_cents into old_quantity, old_cost from public.investment_positions where investment_id = p_investment_id and owner_id = uid for update;
  old_quantity := coalesce(old_quantity, 0); old_cost := coalesce(old_cost, 0);
  if p_type = 'sale' and p_quantity > old_quantity then raise exception 'Nije moguće prodati više od trenutačne količine.'; end if;
  select market_value_cents into old_value from public.investment_valuations where investment_id = p_investment_id and owner_id = uid order by valued_at desc limit 1;
  old_value := coalesce(old_value, 0);

  insert into public.transactions(id, owner_id, kind, occurred_at, description) values (tx_id, uid, 'investment_trade', p_occurred_at, case when p_type = 'purchase' then 'Kupnja: ' else 'Prodaja: ' end || investment_name);
  if p_type = 'purchase' then
    insert into public.transaction_entries(owner_id, transaction_id, account_id, kind, amount_cents) values
      (uid, tx_id, brokerage_account, 'account', -p_amount_cents), (uid, tx_id, null, 'investment', p_amount_cents);
    insert into public.investment_positions(owner_id, investment_id, quantity, cost_basis_cents, as_of)
      values (uid, p_investment_id, p_quantity, p_amount_cents, p_occurred_at)
      on conflict (investment_id) do update set quantity = public.investment_positions.quantity + excluded.quantity, cost_basis_cents = public.investment_positions.cost_basis_cents + excluded.cost_basis_cents, as_of = excluded.as_of;
    insert into public.investment_valuations(owner_id, investment_id, market_value_cents, valued_at, note) values (uid, p_investment_id, old_value + p_amount_cents, p_occurred_at, 'Automatska valuacija nakon kupnje') on conflict (investment_id, valued_at) do update set market_value_cents = excluded.market_value_cents, note = excluded.note;
  else
    cost_reduction := case when old_quantity = 0 then 0 else round(old_cost * (p_quantity / old_quantity))::bigint end;
    insert into public.transaction_entries(owner_id, transaction_id, account_id, kind, amount_cents) values
      (uid, tx_id, brokerage_account, 'account', p_amount_cents), (uid, tx_id, null, 'investment', -p_amount_cents);
    update public.investment_positions set quantity = quantity - p_quantity, cost_basis_cents = greatest(0, cost_basis_cents - cost_reduction), as_of = p_occurred_at where investment_id = p_investment_id and owner_id = uid;
    insert into public.investment_valuations(owner_id, investment_id, market_value_cents, valued_at, note) values (uid, p_investment_id, greatest(0, old_value - p_amount_cents), p_occurred_at, 'Automatska valuacija nakon prodaje') on conflict (investment_id, valued_at) do update set market_value_cents = excluded.market_value_cents, note = excluded.note;
  end if;
  insert into public.investment_events(owner_id, investment_id, transaction_id, type, quantity, amount_cents, occurred_at) values (uid, p_investment_id, tx_id, p_type, p_quantity, p_amount_cents, p_occurred_at);
  perform public.assert_balanced_transaction(tx_id, uid);
  return tx_id;
end;
$$;

create or replace function public.import_fintrack_backup(p_backup jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid(); item jsonb; tx_json jsonb; entry_json jsonb; imported_transactions integer := 0; skipped_transactions integer := 0; category_map jsonb := '{}'::jsonb; budget_map jsonb := '{}'::jsonb; mapped_category uuid; mapped_budget uuid; tx_uuid uuid;
begin
  if uid is null then raise exception 'Prijava je obavezna.'; end if;
  if (p_backup ->> 'schema_version')::integer <> 1 then raise exception 'Nepodržana verzija backupa.'; end if;

  for item in select * from jsonb_array_elements(coalesce(p_backup -> 'accounts', '[]'::jsonb)) loop
    insert into public.accounts(id, owner_id, name, type, currency, opening_balance_cents, description, archived_at, created_at, updated_at)
    values ((item->>'id')::uuid, uid, item->>'name', (item->>'type')::public.account_type, 'EUR', (item->>'opening_balance_cents')::bigint, item->>'description', (item->>'archived_at')::timestamptz, coalesce((item->>'created_at')::timestamptz, now()), coalesce((item->>'updated_at')::timestamptz, now())) on conflict (id) do nothing;
  end loop;

  for item in select * from jsonb_array_elements(coalesce(p_backup -> 'categories', '[]'::jsonb)) loop
    select id into mapped_category from public.categories where owner_id = uid and kind = (item->>'kind')::public.category_kind and name = item->>'name';
    if mapped_category is null then
      insert into public.categories(id, owner_id, name, kind, default_priority, color, icon, archived_at)
      values ((item->>'id')::uuid, uid, item->>'name', (item->>'kind')::public.category_kind, (item->>'default_priority')::public.spending_priority, coalesce(item->>'color','#64748b'), coalesce(item->>'icon','circle'), (item->>'archived_at')::timestamptz)
      on conflict (id) do nothing returning id into mapped_category;
      mapped_category := coalesce(mapped_category, (item->>'id')::uuid);
    end if;
    category_map := category_map || jsonb_build_object(item->>'id', mapped_category::text);
  end loop;

  for item in select * from jsonb_array_elements(coalesce(p_backup -> 'cards', '[]'::jsonb)) loop
    insert into public.cards(id, owner_id, account_id, name, type, last_four, archived_at)
    values ((item->>'id')::uuid, uid, (item->>'account_id')::uuid, item->>'name', (item->>'type')::public.card_type, item->>'last_four', (item->>'archived_at')::timestamptz) on conflict (id) do nothing;
  end loop;

  for tx_json in select * from jsonb_array_elements(coalesce(p_backup -> 'transactions', '[]'::jsonb)) loop
    tx_uuid := (tx_json->>'id')::uuid;
    if exists (select 1 from public.transactions where id = tx_uuid and owner_id = uid) then skipped_transactions := skipped_transactions + 1; continue; end if;
    mapped_category := case when tx_json->>'category_id' is null then null else (category_map ->> (tx_json->>'category_id'))::uuid end;
    insert into public.transactions(id, owner_id, kind, occurred_at, description, category_id, priority, card_id, notes, created_at, updated_at)
    values (tx_uuid, uid, (tx_json->>'kind')::public.transaction_kind, (tx_json->>'occurred_at')::timestamptz, tx_json->>'description', mapped_category, (tx_json->>'priority')::public.spending_priority, (tx_json->>'card_id')::uuid, tx_json->>'notes', coalesce((tx_json->>'created_at')::timestamptz, now()), coalesce((tx_json->>'updated_at')::timestamptz, now()));
    for entry_json in select * from jsonb_array_elements(coalesce(tx_json -> 'transaction_entries', '[]'::jsonb)) loop
      insert into public.transaction_entries(id, owner_id, transaction_id, account_id, kind, amount_cents, created_at)
      values ((entry_json->>'id')::uuid, uid, tx_uuid, (entry_json->>'account_id')::uuid, (entry_json->>'kind')::public.entry_kind, (entry_json->>'amount_cents')::bigint, coalesce((entry_json->>'created_at')::timestamptz, now())) on conflict (id) do nothing;
    end loop;
    perform public.assert_balanced_transaction(tx_uuid, uid);
    imported_transactions := imported_transactions + 1;
  end loop;

  for item in select * from jsonb_array_elements(coalesce(p_backup -> 'budgets', '[]'::jsonb)) loop
    insert into public.budgets(id, owner_id, month, spending_limit_cents, expected_income_cents, planned_savings_cents)
    values ((item->>'id')::uuid, uid, (item->>'month')::date, (item->>'spending_limit_cents')::bigint, (item->>'expected_income_cents')::bigint, (item->>'planned_savings_cents')::bigint) on conflict (owner_id, month) do nothing;
    select id into mapped_budget from public.budgets where owner_id = uid and month = (item->>'month')::date;
    budget_map := budget_map || jsonb_build_object(item->>'id', mapped_budget::text);
  end loop;
  for item in select * from jsonb_array_elements(coalesce(p_backup -> 'budget_allocations', '[]'::jsonb)) loop
    mapped_category := (category_map ->> (item->>'category_id'))::uuid;
    mapped_budget := (budget_map ->> (item->>'budget_id'))::uuid;
    insert into public.budget_allocations(id, owner_id, budget_id, category_id, amount_cents) values ((item->>'id')::uuid, uid, mapped_budget, mapped_category, (item->>'amount_cents')::bigint) on conflict (budget_id, category_id) do nothing;
  end loop;
  for item in select * from jsonb_array_elements(coalesce(p_backup -> 'savings_goals', '[]'::jsonb)) loop
    insert into public.savings_goals(id, owner_id, account_id, name, target_cents, starting_cents, target_date, color, archived_at) values ((item->>'id')::uuid, uid, (item->>'account_id')::uuid, item->>'name', (item->>'target_cents')::bigint, coalesce((item->>'starting_cents')::bigint,0), (item->>'target_date')::date, coalesce(item->>'color','#34d399'), (item->>'archived_at')::timestamptz) on conflict (id) do nothing;
  end loop;
  for item in select * from jsonb_array_elements(coalesce(p_backup -> 'investments', '[]'::jsonb)) loop
    insert into public.investments(id, owner_id, account_id, name, symbol, asset_type, currency, archived_at) values ((item->>'id')::uuid, uid, (item->>'account_id')::uuid, item->>'name', item->>'symbol', item->>'asset_type', coalesce(item->>'currency','EUR'), (item->>'archived_at')::timestamptz) on conflict (id) do nothing;
  end loop;
  for item in select * from jsonb_array_elements(coalesce(p_backup -> 'investment_positions', '[]'::jsonb)) loop
    insert into public.investment_positions(id, owner_id, investment_id, quantity, cost_basis_cents, as_of) values ((item->>'id')::uuid, uid, (item->>'investment_id')::uuid, (item->>'quantity')::numeric, (item->>'cost_basis_cents')::bigint, (item->>'as_of')::timestamptz) on conflict (investment_id) do nothing;
  end loop;
  for item in select * from jsonb_array_elements(coalesce(p_backup -> 'investment_valuations', '[]'::jsonb)) loop
    insert into public.investment_valuations(id, owner_id, investment_id, market_value_cents, valued_at, note) values ((item->>'id')::uuid, uid, (item->>'investment_id')::uuid, (item->>'market_value_cents')::bigint, (item->>'valued_at')::timestamptz, item->>'note') on conflict (investment_id, valued_at) do nothing;
  end loop;
  return jsonb_build_object('imported_transactions', imported_transactions, 'skipped_transactions', skipped_transactions);
end;
$$;

create or replace function public.capture_balance_snapshot()
returns uuid language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); snapshot_id uuid; account_total bigint; liquid_total bigint; investment_total bigint; liability_total bigint; local_day date;
begin
  if uid is null then raise exception 'Prijava je obavezna.'; end if;
  local_day := (now() at time zone 'Europe/Zagreb')::date;
  select coalesce(sum(balance_cents),0), coalesce(sum(balance_cents) filter (where type in ('checking','cash','savings')),0), abs(coalesce(sum(balance_cents) filter (where type in ('credit_card','other_liability')),0))
  into account_total, liquid_total, liability_total from public.account_balances where owner_id = uid and archived_at is null;
  select coalesce(sum(v.market_value_cents),0) into investment_total from public.investments i
  left join lateral (select market_value_cents from public.investment_valuations iv where iv.investment_id = i.id and iv.owner_id = uid order by valued_at desc limit 1) v on true
  where i.owner_id = uid and i.archived_at is null;
  insert into public.balance_snapshots(owner_id, snapshot_date, net_worth_cents, liquid_cents, investment_cents, liability_cents)
  values (uid, local_day, account_total + investment_total, liquid_total, investment_total, liability_total)
  on conflict (owner_id, snapshot_date) do update set net_worth_cents = excluded.net_worth_cents, liquid_cents = excluded.liquid_cents, investment_cents = excluded.investment_cents, liability_cents = excluded.liability_cents
  returning id into snapshot_id;
  return snapshot_id;
end;
$$;

create or replace view public.account_balances with (security_invoker = true) as
select a.*, a.opening_balance_cents + coalesce(sum(e.amount_cents), 0)::bigint as balance_cents
from public.accounts a
left join public.transaction_entries e on e.account_id = a.id
group by a.id;

alter table public.profiles enable row level security;
alter table public.accounts enable row level security;
alter table public.cards enable row level security;
alter table public.categories enable row level security;
alter table public.transactions enable row level security;
alter table public.transaction_entries enable row level security;
alter table public.transaction_history enable row level security;
alter table public.budgets enable row level security;
alter table public.budget_allocations enable row level security;
alter table public.savings_goals enable row level security;
alter table public.investments enable row level security;
alter table public.investment_positions enable row level security;
alter table public.investment_valuations enable row level security;
alter table public.investment_events enable row level security;
alter table public.balance_snapshots enable row level security;

create policy profiles_owner_all on public.profiles for all using (id = auth.uid()) with check (id = auth.uid());
create policy accounts_owner_all on public.accounts for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy cards_owner_all on public.cards for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy categories_owner_all on public.categories for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy transactions_owner_all on public.transactions for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy entries_owner_all on public.transaction_entries for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy history_owner_read on public.transaction_history for select using (owner_id = auth.uid());
create policy budgets_owner_all on public.budgets for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy allocations_owner_all on public.budget_allocations for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy goals_owner_all on public.savings_goals for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy investments_owner_all on public.investments for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy positions_owner_all on public.investment_positions for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy valuations_owner_all on public.investment_valuations for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy investment_events_owner_read on public.investment_events for select using (owner_id = auth.uid());
create policy snapshots_owner_all on public.balance_snapshots for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

revoke all on public.transaction_entries from anon;
revoke all on public.transaction_history from anon;
revoke all on all tables in schema public from anon;
grant select, insert, update, delete on public.profiles, public.accounts, public.cards, public.categories, public.budgets, public.budget_allocations, public.savings_goals, public.investments to authenticated;
grant select on public.investment_positions, public.balance_snapshots to authenticated;
grant select, insert on public.investment_valuations to authenticated;
grant select on public.investment_events to authenticated;
grant select on public.transactions, public.transaction_entries, public.transaction_history, public.account_balances to authenticated;
revoke execute on function public.create_financial_transaction(public.transaction_kind, text, bigint, timestamptz, uuid, uuid, uuid, public.spending_priority, uuid, text) from public, anon;
revoke execute on function public.delete_financial_transaction(uuid) from public, anon;
revoke execute on function public.update_financial_transaction(uuid, public.transaction_kind, text, bigint, timestamptz, uuid, uuid, uuid, public.spending_priority, uuid, text) from public, anon;
revoke execute on function public.reconcile_account(uuid, bigint, timestamptz, text) from public, anon;
revoke execute on function public.save_monthly_budget(date, bigint, bigint, bigint, jsonb) from public, anon;
revoke execute on function public.record_investment_trade(uuid, public.investment_event_type, numeric, bigint, timestamptz) from public, anon;
revoke execute on function public.import_fintrack_backup(jsonb) from public, anon;
revoke execute on function public.capture_balance_snapshot() from public, anon;
grant execute on function public.create_financial_transaction(public.transaction_kind, text, bigint, timestamptz, uuid, uuid, uuid, public.spending_priority, uuid, text) to authenticated;
grant execute on function public.delete_financial_transaction(uuid) to authenticated;
grant execute on function public.update_financial_transaction(uuid, public.transaction_kind, text, bigint, timestamptz, uuid, uuid, uuid, public.spending_priority, uuid, text) to authenticated;
grant execute on function public.reconcile_account(uuid, bigint, timestamptz, text) to authenticated;
grant execute on function public.save_monthly_budget(date, bigint, bigint, bigint, jsonb) to authenticated;
grant execute on function public.record_investment_trade(uuid, public.investment_event_type, numeric, bigint, timestamptz) to authenticated;
grant execute on function public.import_fintrack_backup(jsonb) to authenticated;
grant execute on function public.capture_balance_snapshot() to authenticated;
revoke execute on function public.assert_balanced_transaction(uuid, uuid) from public, anon, authenticated;

commit;
