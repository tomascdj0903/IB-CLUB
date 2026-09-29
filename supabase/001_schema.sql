-- =====================================================================
-- IB Club IAE Nice : comptabilité en partie double (Supabase / Postgres)
-- A exécuter une seule fois dans Supabase > SQL Editor (fichier 1/3)
-- =====================================================================
create extension if not exists pgcrypto;

-- ---------- Profils et rôles ----------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  role text not null default 'en_attente'
    check (role in ('tresorier','president','secretaire','lecteur','en_attente')),
  created_at timestamptz not null default now()
);

create or replace function public.has_role(roles text[]) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = any(roles));
$$;

create or replace function public.is_member() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role <> 'en_attente');
$$;

-- Le premier compte créé devient trésorier, les suivants attendent une validation.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id, new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    case when (select count(*) from public.profiles) = 0 then 'tresorier' else 'en_attente' end
  );
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- Paramètres ------------------------------------------------
create table public.settings (
  id int primary key default 1 check (id = 1),
  association_name text not null default 'IB Club IAE Nice',
  rna text,
  address text,
  bank_name text,
  validation_threshold numeric(12,2) not null default 200,  -- au-dessus : 2 validations
  bank_opening_balance numeric(12,2) not null default 0
);

-- ---------- Exercices -------------------------------------------------
create table public.fiscal_years (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  start_date date not null,
  end_date date not null,
  closed boolean not null default false,
  closed_at timestamptz,
  closed_by uuid references public.profiles(id),
  check (end_date > start_date),
  exclude using gist (daterange(start_date, end_date, '[]') with &&)
);

-- ---------- Plan comptable et journaux --------------------------------
create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  number text not null unique check (number ~ '^[0-9]{2,8}$'),
  label text not null,
  class smallint generated always as (left(number, 1)::smallint) stored,
  active boolean not null default true
);

create table public.journals (
  code text primary key,
  label text not null
);

-- ---------- Tiers et événements (analytique) ---------------------------
create table public.third_parties (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind text not null default 'fournisseur'
    check (kind in ('fournisseur','client','membre','financeur','sponsor','autre')),
  email text,
  notes text,
  created_at timestamptz not null default now()
);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  fiscal_year_id uuid not null references public.fiscal_years(id),
  code text not null,
  name text not null,
  event_date date,
  hosted_by_bde boolean not null default false,
  notes text,
  unique (fiscal_year_id, code)
);

create table public.budget_lines (
  id uuid primary key default gen_random_uuid(),
  fiscal_year_id uuid not null references public.fiscal_years(id),
  event_id uuid references public.events(id) on delete cascade,
  account_id uuid not null references public.accounts(id),
  label text,
  amount numeric(12,2) not null check (amount >= 0),
  planned_date date
);

-- ---------- Ecritures -------------------------------------------------
create table public.entries (
  id uuid primary key default gen_random_uuid(),
  fiscal_year_id uuid not null references public.fiscal_years(id),
  journal_code text not null references public.journals(code),
  entry_date date not null,
  label text not null,
  piece_ref text,
  status text not null default 'brouillon' check (status in ('brouillon','validee')),
  number int,
  reverses_entry_id uuid references public.entries(id),
  created_by uuid default auth.uid() references public.profiles(id),
  created_at timestamptz not null default now(),
  validated_at timestamptz,
  validated_by uuid references public.profiles(id),
  unique (fiscal_year_id, number)
);
create index on public.entries (fiscal_year_id, entry_date);

create table public.entry_lines (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.entries(id) on delete cascade,
  account_id uuid not null references public.accounts(id),
  debit numeric(12,2) not null default 0 check (debit >= 0),
  credit numeric(12,2) not null default 0 check (credit >= 0),
  label text,
  third_party_id uuid references public.third_parties(id),
  event_id uuid references public.events(id),
  position int not null default 0,
  check (debit = 0 or credit = 0)
);
create index on public.entry_lines (entry_id);
create index on public.entry_lines (account_id);
create index on public.entry_lines (event_id);

create table public.entry_documents (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.entries(id) on delete cascade,
  storage_path text not null,
  file_name text not null,
  uploaded_by uuid default auth.uid() references public.profiles(id),
  created_at timestamptz not null default now()
);
create index on public.entry_documents (entry_id);

-- ---------- Banque ----------------------------------------------------
create table public.bank_transactions (
  id uuid primary key default gen_random_uuid(),
  tx_date date not null,
  label text not null,
  amount numeric(12,2) not null,               -- + encaissement, - décaissement
  import_hash text not null unique,
  matched_line_id uuid unique references public.entry_lines(id) on delete set null,
  imported_at timestamptz not null default now(),
  imported_by uuid default auth.uid() references public.profiles(id)
);
create index on public.bank_transactions (tx_date);

-- ---------- Notes de frais -------------------------------------------
create table public.expense_claims (
  id uuid primary key default gen_random_uuid(),
  claimant_id uuid not null default auth.uid() references public.profiles(id),
  claimant_name text not null,
  description text not null,
  amount numeric(12,2) not null check (amount > 0),
  expense_date date not null,
  account_id uuid references public.accounts(id),
  event_id uuid references public.events(id),
  document_path text,
  status text not null default 'soumise'
    check (status in ('soumise','validee','refusee','remboursee')),
  first_validator uuid references public.profiles(id),
  validated_by uuid references public.profiles(id),
  validated_at timestamptz,
  refusal_reason text,
  validation_entry_id uuid references public.entries(id),
  payment_entry_id uuid references public.entries(id),
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

-- ---------- Journal d'audit ------------------------------------------
create table public.audit_log (
  id bigserial primary key,
  at timestamptz not null default now(),
  user_id uuid,
  table_name text not null,
  row_id text,
  action text not null,
  old_data jsonb,
  new_data jsonb
);

create or replace function public.audit_trigger() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.audit_log (user_id, table_name, row_id, action, old_data, new_data)
  values (
    auth.uid(), tg_table_name,
    coalesce(to_jsonb(new) ->> 'id', to_jsonb(old) ->> 'id'), tg_op,
    case when tg_op <> 'INSERT' then to_jsonb(old) end,
    case when tg_op <> 'DELETE' then to_jsonb(new) end
  );
  return null;
end $$;

create trigger audit_entries after insert or update or delete on public.entries
  for each row execute function public.audit_trigger();
create trigger audit_entry_lines after insert or update or delete on public.entry_lines
  for each row execute function public.audit_trigger();
create trigger audit_claims after insert or update or delete on public.expense_claims
  for each row execute function public.audit_trigger();
create trigger audit_fiscal_years after insert or update or delete on public.fiscal_years
  for each row execute function public.audit_trigger();
create trigger audit_accounts after insert or update or delete on public.accounts
  for each row execute function public.audit_trigger();
create trigger audit_budget after insert or update or delete on public.budget_lines
  for each row execute function public.audit_trigger();
create trigger audit_bank after insert or update or delete on public.bank_transactions
  for each row execute function public.audit_trigger();
create trigger audit_profiles after update or delete on public.profiles
  for each row execute function public.audit_trigger();

-- ---------- Garde-fous : écritures validées = non modifiables ---------
create or replace function public.entries_guard() returns trigger
language plpgsql set search_path = public as $$
declare fy public.fiscal_years;
begin
  if tg_op = 'DELETE' then
    if old.status = 'validee' then
      raise exception 'Écriture validée : suppression interdite (utiliser la contre-passation)';
    end if;
    return old;
  end if;
  if tg_op = 'UPDATE' and old.status = 'validee' then
    raise exception 'Écriture validée : modification interdite (utiliser la contre-passation)';
  end if;
  select * into fy from public.fiscal_years where id = new.fiscal_year_id;
  if fy.closed then raise exception 'Exercice % clôturé', fy.label; end if;
  if new.entry_date < fy.start_date or new.entry_date > fy.end_date then
    raise exception 'La date % est hors de l''exercice % (% au %)', new.entry_date, fy.label, fy.start_date, fy.end_date;
  end if;
  return new;
end $$;

create trigger entries_guard before insert or update or delete on public.entries
  for each row execute function public.entries_guard();

create or replace function public.lines_guard() returns trigger
language plpgsql set search_path = public as $$
declare eid uuid; st text; closed boolean;
begin
  if tg_op = 'UPDATE' and new.entry_id <> old.entry_id then
    raise exception 'Une ligne ne peut pas changer d''écriture';
  end if;
  if tg_op = 'DELETE' then eid := old.entry_id; else eid := new.entry_id; end if;
  select e.status, f.closed into st, closed
    from public.entries e join public.fiscal_years f on f.id = e.fiscal_year_id
    where e.id = eid;
  if st is null then return coalesce(new, old); end if;   -- suppression en cascade
  if st = 'validee' then raise exception 'Écriture validée : lignes non modifiables'; end if;
  if closed then raise exception 'Exercice clôturé'; end if;
  return coalesce(new, old);
end $$;

create trigger lines_guard before insert or update or delete on public.entry_lines
  for each row execute function public.lines_guard();

-- ---------- Fonctions métier -----------------------------------------
create or replace function public._validate_entry(p_entry uuid) returns void
language plpgsql security definer set search_path = public as $$
declare e public.entries; d numeric; c numeric; cnt int; n int;
begin
  select * into e from public.entries where id = p_entry for update;
  if not found then raise exception 'Écriture introuvable'; end if;
  if e.status = 'validee' then return; end if;
  select coalesce(sum(debit),0), coalesce(sum(credit),0), count(*) into d, c, cnt
    from public.entry_lines where entry_id = p_entry;
  if cnt < 2 then raise exception 'Une écriture doit avoir au moins 2 lignes'; end if;
  if d <> c then raise exception 'Écriture déséquilibrée : débit % / crédit %', d, c; end if;
  if d = 0 then raise exception 'Écriture à montant nul'; end if;
  perform 1 from public.fiscal_years where id = e.fiscal_year_id for update;  -- sérialise la numérotation
  select coalesce(max(number), 0) + 1 into n from public.entries where fiscal_year_id = e.fiscal_year_id;
  update public.entries
     set status = 'validee', number = n, validated_at = now(), validated_by = auth.uid()
   where id = p_entry;
end $$;

create or replace function public._post_entry(
  p_date date, p_journal text, p_label text, p_piece text, p_lines jsonb, p_validate boolean
) returns uuid
language plpgsql security definer set search_path = public as $$
declare fy public.fiscal_years; eid uuid; l jsonb; acc uuid; i int := 0;
begin
  select * into fy from public.fiscal_years where p_date between start_date and end_date;
  if not found then raise exception 'Aucun exercice ne couvre la date %', p_date; end if;
  if fy.closed then raise exception 'Exercice % clôturé', fy.label; end if;
  insert into public.entries (fiscal_year_id, journal_code, entry_date, label, piece_ref)
    values (fy.id, p_journal, p_date, p_label, nullif(p_piece, ''))
    returning id into eid;
  for l in select * from jsonb_array_elements(p_lines) loop
    select id into acc from public.accounts where number = (l ->> 'account') and active;
    if acc is null then raise exception 'Compte inconnu ou inactif : %', l ->> 'account'; end if;
    i := i + 1;
    insert into public.entry_lines (entry_id, account_id, debit, credit, label, third_party_id, event_id, position)
    values (
      eid, acc,
      round(coalesce((l ->> 'debit')::numeric, 0), 2),
      round(coalesce((l ->> 'credit')::numeric, 0), 2),
      nullif(l ->> 'label', ''),
      nullif(l ->> 'third_party_id', '')::uuid,
      nullif(l ->> 'event_id', '')::uuid,
      i
    );
  end loop;
  if p_validate then perform public._validate_entry(eid); end if;
  return eid;
end $$;

revoke all on function public._validate_entry(uuid) from public, anon, authenticated;
revoke all on function public._post_entry(date, text, text, text, jsonb, boolean) from public, anon, authenticated;

create or replace function public.post_entry(
  p_date date, p_journal text, p_label text, p_piece text, p_lines jsonb, p_validate boolean default true
) returns uuid
language plpgsql security definer set search_path = public as $$
begin
  if not public.has_role(array['tresorier']) then
    raise exception 'Réservé au trésorier' using errcode = '42501';
  end if;
  return public._post_entry(p_date, p_journal, p_label, p_piece, p_lines, p_validate);
end $$;

create or replace function public.validate_entry(p_entry uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.has_role(array['tresorier']) then
    raise exception 'Réservé au trésorier' using errcode = '42501';
  end if;
  perform public._validate_entry(p_entry);
end $$;

-- Contre-passation : la seule façon de corriger une écriture validée
create or replace function public.reverse_entry(p_entry uuid, p_date date default current_date)
returns uuid
language plpgsql security definer set search_path = public as $$
declare e public.entries; lines jsonb; new_id uuid;
begin
  if not public.has_role(array['tresorier']) then
    raise exception 'Réservé au trésorier' using errcode = '42501';
  end if;
  select * into e from public.entries where id = p_entry;
  if not found or e.status <> 'validee' then raise exception 'Seule une écriture validée se contre-passe'; end if;
  if exists (select 1 from public.entries where reverses_entry_id = p_entry) then
    raise exception 'Cette écriture a déjà été contre-passée';
  end if;
  select jsonb_agg(jsonb_build_object(
      'account', a.number, 'debit', l.credit, 'credit', l.debit,
      'label', coalesce(l.label, ''), 'third_party_id', l.third_party_id, 'event_id', l.event_id)
      order by l.position)
    into lines
    from public.entry_lines l join public.accounts a on a.id = l.account_id
    where l.entry_id = p_entry;
  new_id := public._post_entry(p_date, e.journal_code, 'Contre-passation : ' || e.label, e.piece_ref, lines, false);
  update public.entries set reverses_entry_id = p_entry where id = new_id;
  perform public._validate_entry(new_id);
  return new_id;
end $$;

-- Banque : pointage d'une ligne de relevé sur une ligne d'écriture (compte 512)
create or replace function public.match_bank_transaction(p_tx uuid, p_line uuid) returns void
language plpgsql security definer set search_path = public as $$
declare t public.bank_transactions; l public.entry_lines; acc text; st text;
begin
  if not public.has_role(array['tresorier']) then
    raise exception 'Réservé au trésorier' using errcode = '42501';
  end if;
  select * into t from public.bank_transactions where id = p_tx for update;
  select * into l from public.entry_lines where id = p_line;
  if t.id is null or l.id is null then raise exception 'Ligne introuvable'; end if;
  select a.number into acc from public.accounts a where a.id = l.account_id;
  select e.status into st from public.entries e where e.id = l.entry_id;
  if acc <> '512' then raise exception 'La ligne doit être sur le compte 512 (banque)'; end if;
  if st <> 'validee' then raise exception 'L''écriture doit être validée'; end if;
  if (l.debit - l.credit) <> t.amount then
    raise exception 'Montants différents : relevé % / écriture %', t.amount, (l.debit - l.credit);
  end if;
  update public.bank_transactions set matched_line_id = p_line where id = p_tx;
end $$;

create or replace function public.unmatch_bank_transaction(p_tx uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.has_role(array['tresorier']) then
    raise exception 'Réservé au trésorier' using errcode = '42501';
  end if;
  update public.bank_transactions set matched_line_id = null where id = p_tx;
end $$;

-- Banque : créer l'écriture d'une ligne de relevé et la pointer en une fois
create or replace function public.book_bank_transaction(
  p_tx uuid, p_account text, p_label text, p_event uuid default null,
  p_third uuid default null, p_piece text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare t public.bank_transactions; eid uuid; lines jsonb; bank_line uuid; amt numeric(12,2);
begin
  if not public.has_role(array['tresorier']) then
    raise exception 'Réservé au trésorier' using errcode = '42501';
  end if;
  select * into t from public.bank_transactions where id = p_tx for update;
  if t.id is null then raise exception 'Ligne de relevé introuvable'; end if;
  if t.matched_line_id is not null then raise exception 'Ligne déjà pointée'; end if;
  amt := abs(t.amount);
  if t.amount < 0 then
    lines := jsonb_build_array(
      jsonb_build_object('account', p_account, 'debit', amt, 'credit', 0, 'label', p_label, 'third_party_id', p_third, 'event_id', p_event),
      jsonb_build_object('account', '512', 'debit', 0, 'credit', amt, 'label', t.label));
  else
    lines := jsonb_build_array(
      jsonb_build_object('account', '512', 'debit', amt, 'credit', 0, 'label', t.label),
      jsonb_build_object('account', p_account, 'debit', 0, 'credit', amt, 'label', p_label, 'third_party_id', p_third, 'event_id', p_event));
  end if;
  eid := public._post_entry(t.tx_date, 'BQ', p_label, p_piece, lines, true);
  select l.id into bank_line from public.entry_lines l join public.accounts a on a.id = l.account_id
    where l.entry_id = eid and a.number = '512';
  update public.bank_transactions set matched_line_id = bank_line where id = p_tx;
  return eid;
end $$;

-- Notes de frais -------------------------------------------------------
create or replace function public.validate_claim(p_claim uuid, p_account text default null, p_event uuid default null)
returns void
language plpgsql security definer set search_path = public as $$
declare c public.expense_claims; thr numeric; me uuid := auth.uid(); acc uuid; tp uuid; lines jsonb; eid uuid;
begin
  if not public.has_role(array['tresorier','president']) then
    raise exception 'Réservé au trésorier et à la présidente' using errcode = '42501';
  end if;
  select * into c from public.expense_claims where id = p_claim for update;
  if c.id is null then raise exception 'Note de frais introuvable'; end if;
  if c.status <> 'soumise' then raise exception 'Cette note n''est plus en attente'; end if;
  if c.claimant_id = me then raise exception 'Vous ne pouvez pas valider votre propre note de frais'; end if;
  if p_account is not null then
    select id into acc from public.accounts where number = p_account and active;
    if acc is null then raise exception 'Compte inconnu : %', p_account; end if;
    update public.expense_claims set account_id = acc where id = p_claim;
    c.account_id := acc;
  end if;
  if p_event is not null then
    update public.expense_claims set event_id = p_event where id = p_claim;
    c.event_id := p_event;
  end if;
  if c.account_id is null then raise exception 'Choisir une catégorie (compte) avant validation'; end if;
  select validation_threshold into thr from public.settings where id = 1;
  if c.amount > coalesce(thr, 200) then
    if c.first_validator is null then
      update public.expense_claims set first_validator = me where id = p_claim;
      return;                                     -- 1re validation, il en faut une 2e
    elsif c.first_validator = me then
      raise exception 'Une seconde personne doit valider cette dépense (montant > % €)', thr;
    end if;
  end if;
  select id into tp from public.third_parties where name = c.claimant_name and kind = 'membre' limit 1;
  if tp is null then
    insert into public.third_parties (name, kind) values (c.claimant_name, 'membre') returning id into tp;
  end if;
  lines := jsonb_build_array(
    jsonb_build_object('account', (select number from public.accounts where id = c.account_id),
      'debit', c.amount, 'credit', 0, 'label', c.description, 'event_id', c.event_id),
    jsonb_build_object('account', '467', 'debit', 0, 'credit', c.amount,
      'label', 'À rembourser : ' || c.claimant_name, 'third_party_id', tp));
  eid := public._post_entry(c.expense_date, 'AC', 'Note de frais : ' || c.description, 'NDF-' || left(c.id::text, 8), lines, true);
  update public.expense_claims
     set status = 'validee', validated_by = me, validated_at = now(), validation_entry_id = eid
   where id = p_claim;
  if c.document_path is not null then
    insert into public.entry_documents (entry_id, storage_path, file_name)
    values (eid, c.document_path, regexp_replace(c.document_path, '^.*/', ''));
  end if;
end $$;

create or replace function public.refuse_claim(p_claim uuid, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.has_role(array['tresorier','president']) then
    raise exception 'Réservé au trésorier et à la présidente' using errcode = '42501';
  end if;
  update public.expense_claims set status = 'refusee', refusal_reason = p_reason,
         validated_by = auth.uid(), validated_at = now()
   where id = p_claim and status = 'soumise';
end $$;

create or replace function public.pay_claim(p_claim uuid, p_date date default current_date, p_cash boolean default false)
returns uuid
language plpgsql security definer set search_path = public as $$
declare c public.expense_claims; tp uuid; eid uuid;
begin
  if not public.has_role(array['tresorier']) then
    raise exception 'Réservé au trésorier' using errcode = '42501';
  end if;
  select * into c from public.expense_claims where id = p_claim for update;
  if c.status <> 'validee' then raise exception 'La note doit être validée avant remboursement'; end if;
  select id into tp from public.third_parties where name = c.claimant_name and kind = 'membre' limit 1;
  eid := public._post_entry(p_date, case when p_cash then 'CA' else 'BQ' end,
    'Remboursement note de frais : ' || c.claimant_name,
    'NDF-' || left(c.id::text, 8),
    jsonb_build_array(
      jsonb_build_object('account', '467', 'debit', c.amount, 'credit', 0, 'label', c.description, 'third_party_id', tp),
      jsonb_build_object('account', case when p_cash then '530' else '512' end, 'debit', 0, 'credit', c.amount)),
    true);
  update public.expense_claims set status = 'remboursee', payment_entry_id = eid, paid_at = now() where id = p_claim;
  return eid;
end $$;

-- Clôture d'exercice ----------------------------------------------------
create or replace function public.close_fiscal_year(p_fy uuid, p_next_label text default null)
returns uuid
language plpgsql security definer set search_path = public as $$
declare fy public.fiscal_years; nx public.fiscal_years; res numeric(12,2); r record;
        lines jsonb := '[]'::jsonb; drafts int; nstart date; nend date;
begin
  if not public.has_role(array['tresorier']) then
    raise exception 'Réservé au trésorier' using errcode = '42501';
  end if;
  select * into fy from public.fiscal_years where id = p_fy for update;
  if fy.id is null then raise exception 'Exercice introuvable'; end if;
  if fy.closed then raise exception 'Exercice déjà clôturé'; end if;
  select count(*) into drafts from public.entries where fiscal_year_id = p_fy and status = 'brouillon';
  if drafts > 0 then
    raise exception '% écriture(s) en brouillon : les valider ou les supprimer avant la clôture', drafts;
  end if;

  select coalesce(sum(l.credit - l.debit), 0) into res
    from public.entry_lines l
    join public.entries e on e.id = l.entry_id
    join public.accounts a on a.id = l.account_id
   where e.fiscal_year_id = p_fy and e.status = 'validee' and a.class in (6, 7);

  select * into nx from public.fiscal_years where start_date = fy.end_date + 1;
  if nx.id is null then
    nstart := fy.end_date + 1;
    nend := (nstart + interval '1 year' - interval '1 day')::date;
    insert into public.fiscal_years (label, start_date, end_date)
    values (coalesce(p_next_label, to_char(nstart, 'YYYY') || '-' || to_char(nend, 'YYYY')), nstart, nend)
    returning * into nx;
  end if;

  for r in
    select a.number, l.third_party_id as tp, sum(l.debit - l.credit) as bal
      from public.entry_lines l
      join public.entries e on e.id = l.entry_id
      join public.accounts a on a.id = l.account_id
     where e.fiscal_year_id = p_fy and e.status = 'validee' and a.class between 1 and 5
     group by a.number, l.third_party_id
    having sum(l.debit - l.credit) <> 0
     order by a.number
  loop
    lines := lines || jsonb_build_array(jsonb_build_object(
      'account', r.number, 'debit', greatest(r.bal, 0), 'credit', greatest(-r.bal, 0),
      'label', 'Report à nouveau', 'third_party_id', r.tp));
  end loop;
  if res > 0 then
    lines := lines || jsonb_build_array(jsonb_build_object('account', '120', 'debit', 0, 'credit', res, 'label', 'Résultat ' || fy.label));
  elsif res < 0 then
    lines := lines || jsonb_build_array(jsonb_build_object('account', '129', 'debit', -res, 'credit', 0, 'label', 'Résultat ' || fy.label));
  end if;
  if jsonb_array_length(lines) >= 2 then
    perform public._post_entry(nx.start_date, 'AN', 'À-nouveaux ' || fy.label, null, lines, true);
  end if;
  update public.fiscal_years set closed = true, closed_at = now(), closed_by = auth.uid() where id = p_fy;
  return nx.id;
end $$;

-- ---------- Vues (respectent les droits de l'utilisateur) -------------
create or replace view public.v_ledger with (security_invoker = true) as
select l.id as line_id, e.id as entry_id, e.fiscal_year_id, e.number as entry_number,
       e.journal_code, e.entry_date, e.label as entry_label, e.piece_ref, e.status,
       l.label as line_label, a.id as account_id, a.number as account_number,
       a.label as account_label, a.class, l.debit, l.credit,
       l.third_party_id, l.event_id, l.position
  from public.entry_lines l
  join public.entries e on e.id = l.entry_id
  join public.accounts a on a.id = l.account_id;

create or replace view public.v_entries with (security_invoker = true) as
select e.*,
       coalesce((select sum(l.debit) from public.entry_lines l where l.entry_id = e.id), 0) as total,
       (select count(*) from public.entry_documents d where d.entry_id = e.id) as docs,
       exists (select 1 from public.entry_lines l join public.accounts a on a.id = l.account_id
                where l.entry_id = e.id and a.class = 6) as has_expense
  from public.entries e;

-- ---------- Sécurité par ligne (RLS) ----------------------------------
alter table public.profiles enable row level security;
alter table public.settings enable row level security;
alter table public.fiscal_years enable row level security;
alter table public.accounts enable row level security;
alter table public.journals enable row level security;
alter table public.third_parties enable row level security;
alter table public.events enable row level security;
alter table public.budget_lines enable row level security;
alter table public.entries enable row level security;
alter table public.entry_lines enable row level security;
alter table public.entry_documents enable row level security;
alter table public.bank_transactions enable row level security;
alter table public.expense_claims enable row level security;
alter table public.audit_log enable row level security;

-- Lecture : tout membre validé
create policy read_profiles on public.profiles for select using (id = auth.uid() or public.is_member());
create policy read_settings on public.settings for select using (public.is_member());
create policy read_fy on public.fiscal_years for select using (public.is_member());
create policy read_accounts on public.accounts for select using (public.is_member());
create policy read_journals on public.journals for select using (public.is_member());
create policy read_third on public.third_parties for select using (public.is_member());
create policy read_events on public.events for select using (public.is_member());
create policy read_budget on public.budget_lines for select using (public.is_member());
create policy read_entries on public.entries for select using (public.is_member());
create policy read_lines on public.entry_lines for select using (public.is_member());
create policy read_docs on public.entry_documents for select using (public.is_member());
create policy read_bank on public.bank_transactions for select using (public.is_member());
create policy read_claims on public.expense_claims for select using (public.is_member());
create policy read_audit on public.audit_log for select using (public.has_role(array['tresorier','president']));

-- Ecriture : trésorier
create policy w_profiles on public.profiles for update using (public.has_role(array['tresorier'])) with check (public.has_role(array['tresorier']));
create policy w_settings on public.settings for update using (public.has_role(array['tresorier'])) with check (public.has_role(array['tresorier']));
create policy w_fy on public.fiscal_years for insert with check (public.has_role(array['tresorier']));
create policy w_fy_u on public.fiscal_years for update using (public.has_role(array['tresorier']) and not closed) with check (public.has_role(array['tresorier']));
create policy w_accounts on public.accounts for all using (public.has_role(array['tresorier'])) with check (public.has_role(array['tresorier']));
create policy w_third on public.third_parties for all using (public.has_role(array['tresorier'])) with check (public.has_role(array['tresorier']));
create policy w_events on public.events for all using (public.has_role(array['tresorier'])) with check (public.has_role(array['tresorier']));
create policy w_budget on public.budget_lines for all using (public.has_role(array['tresorier'])) with check (public.has_role(array['tresorier']));
create policy w_entries on public.entries for all using (public.has_role(array['tresorier'])) with check (public.has_role(array['tresorier']));
create policy w_lines on public.entry_lines for all using (public.has_role(array['tresorier'])) with check (public.has_role(array['tresorier']));
create policy w_bank on public.bank_transactions for all using (public.has_role(array['tresorier'])) with check (public.has_role(array['tresorier']));

-- Justificatifs : tout membre peut en ajouter
create policy w_docs_ins on public.entry_documents for insert with check (public.is_member());
create policy w_docs_del on public.entry_documents for delete using (public.has_role(array['tresorier']));

-- Notes de frais : tout membre peut déposer la sienne, les décisions passent par les fonctions
create policy claims_ins on public.expense_claims for insert
  with check (public.is_member() and claimant_id = auth.uid() and status = 'soumise');
create policy claims_del on public.expense_claims for delete
  using (claimant_id = auth.uid() and status = 'soumise');

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
grant execute on function public.has_role(text[]), public.is_member(),
  public.post_entry(date, text, text, text, jsonb, boolean), public.validate_entry(uuid),
  public.reverse_entry(uuid, date), public.match_bank_transaction(uuid, uuid),
  public.unmatch_bank_transaction(uuid),
  public.book_bank_transaction(uuid, text, text, uuid, uuid, text),
  public.validate_claim(uuid, text, uuid), public.refuse_claim(uuid, text),
  public.pay_claim(uuid, date, boolean), public.close_fiscal_year(uuid, text)
  to authenticated;
