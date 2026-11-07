create extension if not exists pgcrypto;

create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  account_number text not null unique,
  customer_name text not null,
  email text not null,
  checking_balance numeric(12, 2) not null default 0 check (checking_balance >= 0),
  savings_balance numeric(12, 2) not null default 0 check (savings_balance >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.cards (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  card_hash text not null unique,
  card_last4 char(4) not null,
  pin_hash text not null,
  failed_attempts integer not null default 0 check (failed_attempts between 0 and 3),
  blocked boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.atm_status (
  id text primary key,
  cash_balance numeric(12, 2) not null default 0 check (cash_balance >= 0),
  paper_rolls integer not null default 0 check (paper_rolls >= 0),
  cash_deposits_pending numeric(12, 2) not null default 0 check (cash_deposits_pending >= 0),
  check_deposits_pending numeric(12, 2) not null default 0 check (check_deposits_pending >= 0),
  is_online boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.atm_status add column if not exists is_online boolean not null default true;

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  atm_id text not null references public.atm_status(id),
  account_id uuid not null references public.accounts(id),
  type text not null check (type in ('balance_inquiry', 'withdrawal', 'deposit_cash', 'deposit_check', 'transfer')),
  account_type text not null check (account_type in ('checking', 'savings')),
  amount numeric(12, 2) not null default 0 check (amount >= 0),
  destination_account_number text,
  created_at timestamptz not null default now()
);

create index if not exists transactions_account_created_idx on public.transactions (account_id, created_at desc);
create index if not exists transactions_created_idx on public.transactions (created_at desc);

alter table public.accounts enable row level security;
alter table public.cards enable row level security;
alter table public.atm_status enable row level security;
alter table public.transactions enable row level security;

insert into public.accounts (account_number, customer_name, email, checking_balance, savings_balance)
values ('4821', 'Jordan Lee', 'jordan@example.com', 2840.50, 6150.00),
       ('1937', 'Sam Rivera', 'sam@example.com', 1250.00, 3200.00)
on conflict (account_number) do nothing;

insert into public.cards (account_id, card_hash, card_last4, pin_hash)
select id, encode(digest('4000000000000002', 'sha256'), 'hex'), '0002', crypt('1234', gen_salt('bf'))
from public.accounts where account_number = '4821'
on conflict (card_hash) do nothing;

insert into public.cards (account_id, card_hash, card_last4, pin_hash)
select id, encode(digest('4000000000000010', 'sha256'), 'hex'), '0010', crypt('5678', gen_salt('bf'))
from public.accounts where account_number = '1937'
on conflict (card_hash) do nothing;

insert into public.atm_status (id, cash_balance, paper_rolls, cash_deposits_pending, check_deposits_pending)
values ('ATM-001', 18750, 8, 325, 640)
on conflict (id) do nothing;

create or replace function public.authenticate_atm_card(p_card_hash text, p_pin text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  card_row public.cards%rowtype;
  account_row public.accounts%rowtype;
  attempts integer;
begin
  select * into card_row from public.cards where card_hash = p_card_hash for update;
  if not found then return jsonb_build_object('status', 'invalid'); end if;
  if card_row.blocked then return jsonb_build_object('status', 'blocked'); end if;
  if crypt(p_pin, card_row.pin_hash) <> card_row.pin_hash then
    attempts := card_row.failed_attempts + 1;
    update public.cards set failed_attempts = attempts, blocked = attempts >= 3 where id = card_row.id;
    if attempts >= 3 then return jsonb_build_object('status', 'locked'); end if;
    return jsonb_build_object('status', 'incorrect', 'attemptsRemaining', 3 - attempts);
  end if;
  update public.cards set failed_attempts = 0 where id = card_row.id;
  select * into account_row from public.accounts where id = card_row.account_id;
  if not found then return jsonb_build_object('status', 'invalid'); end if;
  return jsonb_build_object('status', 'ok', 'account', to_jsonb(account_row));
end;
$$;

create or replace function public.process_atm_transaction(
  p_account_id uuid,
  p_type text,
  p_account_type text,
  p_amount numeric,
  p_destination_account_number text,
  p_atm_id text
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  source_account public.accounts%rowtype;
  destination_account public.accounts%rowtype;
  atm public.atm_status%rowtype;
  result public.transactions%rowtype;
  balance numeric(12, 2);
begin
  if p_type not in ('balance_inquiry', 'withdrawal', 'deposit_cash', 'deposit_check', 'transfer')
     or p_account_type not in ('checking', 'savings')
     or p_amount < 0
     or (p_type <> 'balance_inquiry' and p_amount <= 0) then
    raise exception 'Invalid transaction details.';
  end if;

  select * into atm from public.atm_status where id = p_atm_id for update;
  if not found then raise exception 'ATM status was not found.'; end if;
  if not atm.is_online then raise exception 'This ATM is currently offline.'; end if;

  select * into source_account from public.accounts where id = p_account_id for update;
  if not found then raise exception 'Account not found.'; end if;
  balance := case when p_account_type = 'checking' then source_account.checking_balance else source_account.savings_balance end;

  if p_type in ('withdrawal', 'transfer') and balance < p_amount then
    raise exception 'Insufficient account balance.';
  end if;

  if p_type = 'withdrawal' then
    if atm.cash_balance < p_amount then raise exception 'This ATM does not have enough cash for that withdrawal.'; end if;
    if p_account_type = 'checking' then
      update public.accounts set checking_balance = checking_balance - p_amount where id = p_account_id;
    else
      update public.accounts set savings_balance = savings_balance - p_amount where id = p_account_id;
    end if;
    update public.atm_status set cash_balance = cash_balance - p_amount, updated_at = now() where id = p_atm_id;
  elsif p_type = 'transfer' then
    select * into destination_account from public.accounts where account_number = p_destination_account_number for update;
    if not found then raise exception 'Destination account was not found.'; end if;
    if destination_account.id = source_account.id then raise exception 'You cannot transfer to the same account.'; end if;
    if p_account_type = 'checking' then
      update public.accounts set checking_balance = checking_balance - p_amount where id = p_account_id;
    else
      update public.accounts set savings_balance = savings_balance - p_amount where id = p_account_id;
    end if;
    update public.accounts set checking_balance = checking_balance + p_amount where id = destination_account.id;
  elsif p_type in ('deposit_cash', 'deposit_check') then
    if p_account_type = 'checking' then
      update public.accounts set checking_balance = checking_balance + p_amount where id = p_account_id;
    else
      update public.accounts set savings_balance = savings_balance + p_amount where id = p_account_id;
    end if;
    if p_type = 'deposit_cash' then
      update public.atm_status set cash_deposits_pending = cash_deposits_pending + p_amount, updated_at = now() where id = p_atm_id;
    else
      update public.atm_status set check_deposits_pending = check_deposits_pending + p_amount, updated_at = now() where id = p_atm_id;
    end if;
  end if;

  insert into public.transactions (atm_id, account_id, type, account_type, amount, destination_account_number)
  values (p_atm_id, p_account_id, p_type, p_account_type, p_amount, case when p_type = 'transfer' then p_destination_account_number end)
  returning * into result;
  return to_jsonb(result);
end;
$$;

drop function if exists public.maintain_atm(text, numeric, integer, boolean);

create or replace function public.maintain_atm(
  p_atm_id text,
  p_cash_amount numeric,
  p_paper_rolls integer,
  p_collect_deposits boolean,
  p_is_online boolean
) returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_cash_amount < 0 or p_paper_rolls < 0 then raise exception 'Maintenance quantities cannot be negative.'; end if;
  update public.atm_status
  set cash_balance = cash_balance + p_cash_amount,
      paper_rolls = paper_rolls + p_paper_rolls,
      cash_deposits_pending = case when p_collect_deposits then 0 else cash_deposits_pending end,
      check_deposits_pending = case when p_collect_deposits then 0 else check_deposits_pending end,
      is_online = coalesce(p_is_online, is_online),
      updated_at = now()
  where id = p_atm_id;
  if not found then raise exception 'ATM status was not found.'; end if;
end;
$$;

revoke all on function public.process_atm_transaction(uuid, text, text, numeric, text, text) from public, anon, authenticated;
revoke all on function public.maintain_atm(text, numeric, integer, boolean, boolean) from public, anon, authenticated;
revoke all on function public.authenticate_atm_card(text, text) from public, anon, authenticated;
grant execute on function public.process_atm_transaction(uuid, text, text, numeric, text, text) to service_role;
grant execute on function public.maintain_atm(text, numeric, integer, boolean, boolean) to service_role;
grant execute on function public.authenticate_atm_card(text, text) to service_role;
