# IB Club : comptabilité

Webapp de comptabilité en partie double pour IB Club IAE Nice. Next.js (Vercel) + Supabase (base, connexion, stockage des justificatifs).

## Ce que fait l'outil

- Écritures en partie double, numérotées, non modifiables une fois validées (correction par contre-passation)
- Saisie guidée : dépense, recette, règlement fournisseur, encaissement client, retrait/dépôt espèces, écriture libre
- Justificatifs (photo ou PDF) liés à chaque écriture, alerte si une dépense n'en a pas
- Banque : import CSV du relevé, pointage, création d'écriture depuis une ligne, écart de rapprochement
- Notes de frais : dépôt par un membre, validation présidence/trésorier (2 validations au-dessus du seuil), remboursement
- Budget prévisionnel 2026-2027 déjà chargé, suivi prévu / réel par événement, courbe de trésorerie
- Rapports : tableau de bord, bilan mensuel, trimestriel, annuel (bilan, compte de résultat, contributions volontaires, rapport financier AG), par événement, balance, grand livre
- Exports : CSV des écritures, FEC, impression PDF
- Clôture d'exercice guidée avec à-nouveaux automatiques
- Droits : trésorier, présidence, secrétariat, lecture. Journal d'audit en base.

## Mise en ligne (20 minutes)

### 1. Supabase

1. Créer un projet sur supabase.com (région Europe).
2. SQL Editor : coller et exécuter, dans l'ordre, `supabase/001_schema.sql`, `supabase/002_seed.sql`, `supabase/003_storage.sql`.
3. Project Settings > API : noter `Project URL` et la clé `anon public`.
4. Authentication > URL Configuration : Site URL = l'adresse Vercel (voir étape 2), et ajouter `https://TON-SITE.vercel.app/auth/callback` dans Redirect URLs.

### 2. Vercel

1. Mettre ce dossier sur GitHub (sans `node_modules`).
2. vercel.com > Add New Project > importer le dépôt (framework détecté : Next.js).
3. Environment Variables : `NEXT_PUBLIC_SUPABASE_URL` et `NEXT_PUBLIC_SUPABASE_ANON_KEY` (voir `.env.example`).
4. Deploy.

### 3. Premiers pas

1. **Le trésorier (Tino) crée son compte en premier** : le premier compte créé devient trésorier automatiquement.
2. Les autres membres créent leur compte, puis le trésorier leur donne un rôle dans Paramètres > Membres (sans rôle, un compte ne voit rien).
3. Quand les 4 comptes existent : Supabase > Authentication > Sign In / Providers, désactiver « Allow new users to sign up ». Les nouveaux membres passent alors par une invitation (Authentication > Users > Invite).
4. Paramètres : vérifier le nom de la banque et le seuil de double validation. Exercices : vérifier les dates de l'exercice 2026-2027 (1er sept. 2026 au 31 août 2027 par défaut, modifiable tant qu'il n'y a pas d'écriture).

## Points à valider avant usage réel

- Le plan comptable est inspiré du règlement ANC 2018-06. À faire relire par un expert-comptable ou le service vie associative de l'université.
- Avec un solde de départ à 0 €, la trésorerie prévue descend à -300 € (jusqu'à -540 € si le miel est payé avant la vente). Prévoir un apport de départ (avance du BDE, subvention).
- Le budget est importé du document « Budget Prévisionnel 2026-2027 » : modifiable dans l'onglet Budget.

## Développement local

```bash
cp .env.example .env.local   # renseigner les 2 variables
npm install
npm run dev
```

Tests du schéma SQL (Postgres local) : `bash supabase/tests/run.sh` (scénario complet : validation, contre-passation, banque, notes de frais, droits, clôture).
