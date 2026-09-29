\set ON_ERROR_STOP on
insert into auth.users (id, email) values
 ('00000000-0000-0000-0000-00000000000a','tresorier@ib.fr'),
 ('00000000-0000-0000-0000-00000000000b','presidente@ib.fr'),
 ('00000000-0000-0000-0000-00000000000c','secretaire@ib.fr'),
 ('00000000-0000-0000-0000-00000000000d','inconnu@ib.fr');
update public.profiles set role='president' where email='presidente@ib.fr';
update public.profiles set role='secretaire' where email='secretaire@ib.fr';
do $$ begin
  assert (select role from public.profiles where email='tresorier@ib.fr')='tresorier', 'premier compte = trésorier';
  assert (select role from public.profiles where email='inconnu@ib.fr')='en_attente', 'inconnu en attente';
end $$;

-- ===== Trésorier =====
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000a',false);

-- 1. dépense payée par la banque (cocktail conf 2)
select public.post_entry('2026-10-14','BQ','Cocktail conférence Glize','TICKET-1',
  jsonb_build_array(
    jsonb_build_object('account','6257','debit',150,'label','Cocktail','event_id',(select id::text from public.events where code='CONF2')),
    jsonb_build_object('account','512','credit',150))) as e1 \gset
select set_config('t.e1', :'e1', false) as _xe1 \gset
do $$ begin assert (select status from public.entries where id = current_setting('t.e1')::uuid) = 'validee'; assert (select number from public.entries where id=current_setting('t.e1')::uuid)=1; end $$;

-- 2. écriture déséquilibrée refusée
do $$ begin
  begin
    perform public.post_entry('2026-10-15','OD','Déséquilibrée',null,
      jsonb_build_array(jsonb_build_object('account','6257','debit',10), jsonb_build_object('account','512','credit',9)));
    raise exception 'devrait échouer';
  exception when others then
    assert sqlerrm like '%déséquilibrée%', 'message: ' || sqlerrm;
  end;
end $$;
-- La transaction de la fonction est annulée : pas d'écriture orpheline
do $$ begin assert (select count(*) from public.entries) = 1, 'pas de brouillon orphelin'; end $$;

-- 3. modification / suppression d'une écriture validée refusée
do $$ begin
  begin update public.entries set label='hack' where id=current_setting('t.e1')::uuid; raise exception 'KO'; exception when others then assert sqlerrm like '%modification interdite%'; end;
  begin delete from public.entries where id=current_setting('t.e1')::uuid; raise exception 'KO'; exception when others then assert sqlerrm like '%suppression interdite%'; end;
  begin update public.entry_lines set debit=1 where entry_id=current_setting('t.e1')::uuid and debit>0; raise exception 'KO'; exception when others then assert sqlerrm like '%non modifiables%'; end;
end $$;

-- 4. contre-passation
select public.reverse_entry(current_setting('t.e1')::uuid,'2026-10-16') as rev \gset
select set_config('t.rev', :'rev', false) as _xrev \gset
do $$ begin
  assert (select count(*) from public.entries where reverses_entry_id=current_setting('t.e1')::uuid)=1;
  assert (select sum(debit-credit) from public.v_ledger where account_number='512')=0, 'banque revenue à 0';
  begin perform public.reverse_entry(current_setting('t.e1')::uuid); raise exception 'KO'; exception when others then assert sqlerrm like '%déjà été contre-passée%'; end;
end $$;

-- 5. banque : import + création d'écriture pointée
insert into public.bank_transactions (tx_date,label,amount,import_hash) values
 ('2026-10-01','APPORT BDE',600,'h1'),
 ('2026-11-18','CB TRAITEUR',-150,'h2');
select public.book_bank_transaction((select id from public.bank_transactions where import_hash='h1'),'758','Apport du BDE') as b1 \gset
select set_config('t.b1', :'b1', false) as _xb1 \gset
select public.book_bank_transaction((select id from public.bank_transactions where import_hash='h2'),'6257','Cocktail conférence Asaker',
   (select id from public.events where code='CONF4')) as b2 \gset
select set_config('t.b2', :'b2', false) as _xb2 \gset
do $$ begin
  assert (select count(*) from public.bank_transactions where matched_line_id is not null)=2;
  begin perform public.book_bank_transaction((select id from public.bank_transactions where import_hash='h1'),'758','x'); raise exception 'KO'; exception when others then assert sqlerrm like '%déjà pointée%'; end;
end $$;

-- 6. vente + achat de marchandises (miel), règlement à crédit
select public.post_entry('2026-12-01','AC','Achat miel','FAC-12',
  jsonb_build_array(
    jsonb_build_object('account','607','debit',240,'event_id',(select id::text from public.events where code='NOEL')),
    jsonb_build_object('account','401','credit',240,
      'third_party_id',(select id::text from (select gen_random_uuid() as id) x where false)))) as e_achat \gset
select set_config('t.e_achat', :'e_achat', false) as _xe_achat \gset
select public.post_entry('2026-12-09','VE','Vente pots de miel',null,
  jsonb_build_array(
    jsonb_build_object('account','530','debit',400),
    jsonb_build_object('account','707','credit',400,'event_id',(select id::text from public.events where code='NOEL')))) as e_vente \gset
select set_config('t.e_vente', :'e_vente', false) as _xe_vente \gset

-- ===== Notes de frais =====
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000c',false);
insert into public.expense_claims (claimant_name, description, amount, expense_date)
  values ('Marine S.','Affiches conférence',50,'2026-10-05');
insert into public.expense_claims (claimant_name, description, amount, expense_date)
  values ('Marine S.','Location matériel',300,'2026-10-06');
do $$ begin
  begin update public.expense_claims set status='remboursee'; raise exception 'KO'; exception when others then null; end;
  assert (select count(*) from public.expense_claims where status='soumise')=2, 'update direct impossible';
  begin perform public.validate_claim((select id from public.expense_claims limit 1),'6064'); raise exception 'KO'; exception when others then assert sqlerrm like '%Réservé%'; end;
end $$;

-- présidente valide la petite note
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000b',false);
select public.validate_claim((select id from public.expense_claims where amount=50),'6064');
do $$ begin assert (select status from public.expense_claims where amount=50)='validee'; end $$;
-- grosse note : 2 validations
select public.validate_claim((select id from public.expense_claims where amount=300),'613');
do $$ begin
  assert (select status from public.expense_claims where amount=300)='soumise', 'reste en attente de la 2e validation';
  begin perform public.validate_claim((select id from public.expense_claims where amount=300)); raise exception 'KO'; exception when others then assert sqlerrm like '%seconde personne%', sqlerrm; end;
end $$;
-- présidente ne peut pas poster d'écriture
do $$ begin begin perform public.post_entry('2026-10-05','OD','x',null,'[]'::jsonb); raise exception 'KO'; exception when others then assert sqlerrm like '%Réservé au trésorier%'; end; end $$;

-- trésorier : 2e validation + remboursement
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000a',false);
select public.validate_claim((select id from public.expense_claims where amount=300));
select public.pay_claim((select id from public.expense_claims where amount=300),'2026-12-10') ;
select public.pay_claim((select id from public.expense_claims where amount=50),'2026-12-10',true);
do $$ begin
  assert (select count(*) from public.expense_claims where status='remboursee')=2;
  assert (select coalesce(sum(debit-credit),0) from public.v_ledger where account_number='467' and status='validee')=0, '467 soldé';
end $$;

-- ===== Utilisateur en attente : rien de visible =====
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000d',false);
do $$ begin
  assert (select count(*) from public.entries)=0, 'inconnu ne voit rien';
  assert (select count(*) from public.bank_transactions)=0;
  assert (select count(*) from public.expense_claims)=0;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000a',false);

-- ===== Balance équilibrée =====
do $$ declare d numeric; c numeric; begin
  select sum(debit), sum(credit) into d, c from public.v_ledger where status='validee';
  assert d = c, format('grand livre déséquilibré %s / %s', d, c);
  raise notice 'Grand livre équilibré : % / %', d, c;
end $$;

-- ===== Clôture =====
select public.post_entry('2026-12-15','OD','Brouillon',null,jsonb_build_array(
   jsonb_build_object('account','606','debit',5), jsonb_build_object('account','530','credit',5)), false) as brouillon \gset
select set_config('t.brouillon', :'brouillon', false) as _xbrouillon \gset
do $$ begin begin perform public.close_fiscal_year((select id from public.fiscal_years where label='2026-2027')); raise exception 'KO'; exception when others then assert sqlerrm like '%brouillon%', sqlerrm; end; end $$;
delete from public.entries where id=current_setting('t.brouillon')::uuid;
select public.close_fiscal_year((select id from public.fiscal_years where label='2026-2027')) as nx \gset
select set_config('t.nx', :'nx', false) as _xnx \gset
do $$ declare r record; begin
  assert (select closed from public.fiscal_years where label='2026-2027');
  assert (select label from public.fiscal_years where id=current_setting('t.nx')::uuid)='2027-2028';
  for r in select account_number, sum(debit) d, sum(credit) c from public.v_ledger where fiscal_year_id=current_setting('t.nx')::uuid group by 1 order by 1 loop
    raise notice 'AN % : D % C %', r.account_number, r.d, r.c;
  end loop;
  begin perform public.post_entry('2027-01-10','OD','x',null,'[]'::jsonb); raise exception 'KO'; exception when others then assert sqlerrm like '%clôturé%', sqlerrm; end;
end $$;
do $$ begin
  assert (select coalesce(sum(credit-debit),0) from public.v_ledger where fiscal_year_id=current_setting('t.nx')::uuid and account_number in ('120')) = 
         (select coalesce(sum(credit-debit),0) from public.v_ledger where fiscal_year_id<>current_setting('t.nx')::uuid and class in (6,7) and status='validee'), 'résultat reporté';
end $$;
select count(*) as lignes_audit from public.audit_log;
\echo ALL TESTS PASSED
