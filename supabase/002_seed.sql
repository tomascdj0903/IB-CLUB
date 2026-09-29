-- =====================================================================
-- Données de départ IB Club IAE Nice (fichier 2/3). Solde d'ouverture : 0 EUR
-- Plan comptable inspiré du règlement ANC 2018-06 (associations).
-- A FAIRE VALIDER par un expert-comptable ou le service vie associative.
-- =====================================================================
insert into public.settings (id, association_name, rna, address, validation_threshold, bank_opening_balance)
values (1, 'IB Club IAE Nice', 'W062020948', 'IAE Nice, 5 rue du 22ème B.C.A, 06300 Nice', 200, 0)
on conflict (id) do nothing;

insert into public.journals (code, label) values
  ('BQ','Banque'), ('CA','Caisse'), ('AC','Achats et dépenses'),
  ('VE','Ventes et recettes'), ('OD','Opérations diverses'), ('AN','À-nouveaux')
on conflict do nothing;

insert into public.accounts (number, label) values
  ('101','Fonds associatifs sans droit de reprise'),
  ('102','Fonds associatifs avec droit de reprise'),
  ('106','Réserves'),
  ('110','Report à nouveau (solde créditeur)'),
  ('119','Report à nouveau (solde débiteur)'),
  ('120','Résultat de l''exercice (excédent)'),
  ('129','Résultat de l''exercice (déficit)'),
  ('194','Fonds dédiés sur subventions de fonctionnement'),
  ('218','Autres immobilisations corporelles'),
  ('370','Stocks de marchandises'),
  ('401','Fournisseurs'),
  ('411','Usagers, clients et comptes rattachés'),
  ('441','Subventions à recevoir'),
  ('467','Autres comptes débiteurs ou créditeurs (notes de frais)'),
  ('471','Compte d''attente'),
  ('486','Charges constatées d''avance'),
  ('487','Produits constatés d''avance'),
  ('512','Banque'),
  ('530','Caisse'),
  ('580','Virements internes'),
  ('606','Achats non stockés de matières et fournitures'),
  ('6037','Variation des stocks de marchandises'),
  ('6064','Fournitures administratives'),
  ('607','Achats de marchandises'),
  ('611','Sous-traitance générale'),
  ('613','Locations'),
  ('615','Entretien et réparations'),
  ('616','Primes d''assurance'),
  ('618','Divers (documentation, séminaires)'),
  ('622','Honoraires et intermédiaires'),
  ('623','Publicité, publications, relations publiques'),
  ('6251','Voyages et déplacements'),
  ('6257','Réceptions'),
  ('626','Frais postaux et télécommunications'),
  ('627','Services bancaires et assimilés'),
  ('628','Cotisations et divers services extérieurs'),
  ('658','Charges diverses de gestion courante'),
  ('661','Charges d''intérêts'),
  ('671','Charges exceptionnelles'),
  ('681','Dotations aux amortissements'),
  ('706','Prestations de services (billetterie, prestations)'),
  ('707','Ventes de marchandises'),
  ('708','Produits des activités annexes (sponsoring, partenariats)'),
  ('741','Subventions d''exploitation'),
  ('7541','Dons manuels'),
  ('756','Cotisations'),
  ('758','Produits divers de gestion courante'),
  ('768','Autres produits financiers'),
  ('771','Produits exceptionnels'),
  ('789','Report des ressources non utilisées'),
  ('860','Secours en nature (contributions volontaires)'),
  ('861','Mise à disposition gratuite de biens'),
  ('862','Prestations en nature'),
  ('864','Personnel bénévole'),
  ('870','Bénévolat'),
  ('871','Prestations en nature (produits)'),
  ('875','Dons en nature')
on conflict (number) do nothing;

-- Exercice 2026-2027 (dates modifiables tant qu'aucune écriture n'existe)
insert into public.fiscal_years (label, start_date, end_date)
values ('2026-2027', '2026-09-01', '2027-08-31')
on conflict do nothing;

-- Événements et budget prévisionnel 2026-2027 (source : budget prévisionnel certifié)
do $$
declare fy uuid; ev uuid;
begin
  select id into fy from public.fiscal_years where label = '2026-2027';
  if fy is null or exists (select 1 from public.events where fiscal_year_id = fy) then return; end if;

  insert into public.events (fiscal_year_id, code, name, event_date, hosted_by_bde, notes) values
    (fy,'PICKLEBALL','Pickleball (Cannes)', null, false, 'Date à définir'),
    (fy,'CONF1','Conférence 1 : Nora Ferrera','2026-10-07',false,'Amphithéâtre mis à disposition à titre gracieux'),
    (fy,'CONF2','Conférence 2 : Guillaume Glize','2026-10-14',false,'Cocktail d''accueil (~40 personnes)'),
    (fy,'ODYSSEA','Course Odysséa (Cannes)','2026-10-25',false,'Inscriptions prises en charge par les participants'),
    (fy,'CONF3','Conférence 3 : thématique libre','2026-10-28',false,null),
    (fy,'HALLOWEEN','Soirée Halloween Business','2026-10-31',true,'Porté et financé par le BDE'),
    (fy,'CONF4','Conférence 4 : Roland Asaker','2026-11-18',false,'Cocktail d''accueil (~40 personnes)'),
    (fy,'CONF5','Conférence 5 : Jan Jaap','2026-12-02',false,null),
    (fy,'NOEL','Vente de Noël (miel)','2026-12-09',false,'~40 pots achetés 6 EUR, revendus 10 EUR'),
    (fy,'CONF6','Conférence 6 : thématique libre','2026-12-09',false,null),
    (fy,'SKI','Week-end Ski','2027-01-14',true,'Logistique et budget pris en charge par le BDE'),
    (fy,'CHANDELEUR','Opération Chandeleur','2027-02-02',false,'~120 crêpes à ~2 EUR'),
    (fy,'ROSES','Vente Saint-Valentin (roses)','2027-02-14',false,'~100 roses achetées 1,80 EUR, revendues 3 EUR'),
    (fy,'KARTING','Compétition Karting (Gourdon)','2027-02-27',false,'~40 pilotes à 25 EUR');

  insert into public.budget_lines (fiscal_year_id, event_id, account_id, label, amount, planned_date)
  select fy, e.id, a.id, b.label, b.amount, b.d
  from (values
    ('CONF2','6257','Cocktail réception', 150.00, date '2026-10-14'),
    ('CONF4','6257','Cocktail réception', 150.00, date '2026-11-18'),
    ('NOEL','607','Achat de 40 pots de miel', 240.00, date '2026-12-09'),
    ('NOEL','707','Vente de 40 pots à 10 EUR', 400.00, date '2026-12-09'),
    ('CHANDELEUR','607','Ingrédients crêpes', 100.00, date '2027-02-02'),
    ('CHANDELEUR','707','Vente ~120 crêpes', 240.00, date '2027-02-02'),
    ('ROSES','607','Achat de 100 roses', 180.00, date '2027-02-14'),
    ('ROSES','707','Vente de 100 roses à 3 EUR', 300.00, date '2027-02-14'),
    ('KARTING','611','Prestation piste et équipement', 800.00, date '2027-02-27'),
    ('KARTING','706','Billetterie ~40 participants à 25 EUR', 1000.00, date '2027-02-27')
  ) as b(code, acc, label, amount, d)
  join public.events e on e.fiscal_year_id = fy and e.code = b.code
  join public.accounts a on a.number = b.acc;
end $$;
