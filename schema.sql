-- ============================================================
-- Ledger — Trading Journal: Supabase schema
-- Run this once in your Supabase project's SQL editor
-- (Dashboard → SQL Editor → New query → paste → Run)
-- ============================================================

-- 1. TABLES -----------------------------------------------------

create table if not exists public.trades (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  symbol text not null,
  direction text not null check (direction in ('buy','sell')),
  date date not null,
  entry numeric,
  lot numeric,
  sl numeric,
  tp numeric,
  pl numeric not null default 0,
  reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  type text not null check (type in ('deposit','withdrawal')),
  amount numeric not null check (amount > 0),
  date date not null,
  note text,
  created_at timestamptz not null default now()
);

create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  action text not null,      -- insert | update | delete
  entity text not null,      -- trade | transaction
  entity_id uuid,
  summary text,
  detail jsonb,
  created_at timestamptz not null default now()
);

create index if not exists trades_user_date_idx on public.trades(user_id, date);
create index if not exists tx_user_date_idx on public.transactions(user_id, date);
create index if not exists audit_user_time_idx on public.audit_log(user_id, created_at desc);

-- 2. ROW LEVEL SECURITY — each user only ever sees their own rows ----

alter table public.trades enable row level security;
alter table public.transactions enable row level security;
alter table public.audit_log enable row level security;

create policy "trades_owner" on public.trades
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "transactions_owner" on public.transactions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "audit_log_owner_select" on public.audit_log
  for select using (auth.uid() = user_id);

create policy "audit_log_owner_insert" on public.audit_log
  for insert with check (auth.uid() = user_id);

-- 3. AUDIT LOG TRIGGERS — every insert/update/delete is recorded server-side,
--    so the log is trustworthy no matter which device made the change ------

create or replace function public.fn_audit_trades() returns trigger as $$
begin
  if (tg_op = 'INSERT') then
    insert into public.audit_log(user_id, action, entity, entity_id, summary, detail)
    values (new.user_id, 'insert', 'trade', new.id,
            new.symbol || ' · ' || new.direction || ' · R' || new.pl, to_jsonb(new));
    return new;
  elsif (tg_op = 'UPDATE') then
    insert into public.audit_log(user_id, action, entity, entity_id, summary, detail)
    values (new.user_id, 'update', 'trade', new.id,
            'Edited ' || new.symbol, jsonb_build_object('old', to_jsonb(old), 'new', to_jsonb(new)));
    return new;
  elsif (tg_op = 'DELETE') then
    insert into public.audit_log(user_id, action, entity, entity_id, summary, detail)
    values (old.user_id, 'delete', 'trade', old.id,
            'Deleted ' || old.symbol, to_jsonb(old));
    return old;
  end if;
end;
$$ language plpgsql security definer;

drop trigger if exists trades_audit on public.trades;
create trigger trades_audit
  after insert or update or delete on public.trades
  for each row execute function public.fn_audit_trades();

create or replace function public.fn_audit_transactions() returns trigger as $$
begin
  if (tg_op = 'INSERT') then
    insert into public.audit_log(user_id, action, entity, entity_id, summary, detail)
    values (new.user_id, 'insert', 'transaction', new.id,
            initcap(new.type) || ' of R' || new.amount, to_jsonb(new));
    return new;
  elsif (tg_op = 'DELETE') then
    insert into public.audit_log(user_id, action, entity, entity_id, summary, detail)
    values (old.user_id, 'delete', 'transaction', old.id,
            'Deleted ' || old.type || ' of R' || old.amount, to_jsonb(old));
    return old;
  end if;
end;
$$ language plpgsql security definer;

drop trigger if exists tx_audit on public.transactions;
create trigger tx_audit
  after insert or delete on public.transactions
  for each row execute function public.fn_audit_transactions();

-- 4. REALTIME — allow the client to subscribe to live row changes -------
-- (In the Supabase dashboard: Database → Replication → toggle these three
--  tables ON, or run the two lines below.)

alter publication supabase_realtime add table public.trades;
alter publication supabase_realtime add table public.transactions;
alter publication supabase_realtime add table public.audit_log;