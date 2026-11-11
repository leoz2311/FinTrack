# FinTrack

FinTrack je privatna, instalabilna PWA aplikacija za ručno upravljanje osobnim financijama. Sučelje je na hrvatskom, valuta je EUR, a sva vremenska razgraničenja koriste `Europe/Zagreb`.

## Što je implementirano

- Supabase Auth i RLS na svakoj korisničkoj tablici
- ledger s izbalansiranim stavkama i atomskim RPC operacijama
- računi, debitne/kreditne kartice, usklađenja i audit povijest
- prihodi, troškovi, interni transferi, pretraga, filtri, uređivanje i brisanje
- neovisni mjesečni budžeti, omotnice, očekivani prihod i planirana štednja
- stvarni dashboard bez demo podataka, usporedbe i Recharts grafovi
- ciljevi štednje, brokerage gotovina, pozicije, kupnje/prodaje i ručne valuacije
- analitika po danu, tjednu, mjesecu, godini, kategoriji i prioritetu
- CSV, Excel i verzionirani JSON backup s pregledom i detekcijom duplikata
- dark/light tema, desktop sidebar, mobilna navigacija i PWA service worker
- Vitest correctness testovi, SQL RLS test i Playwright smoke testovi

## Preduvjeti

- Node.js 22 ili noviji
- npm 10 ili noviji
- Supabase projekt ili lokalni Supabase CLI

## Lokalno pokretanje

```powershell
npm install
Copy-Item .env.example .env.local
```

U `.env.local` upišite samo javne browser vrijednosti:

```dotenv
VITE_SUPABASE_URL=https://VAŠ_PROJEKT.supabase.co
VITE_SUPABASE_ANON_KEY=VAŠ_JAVNI_ANON_KLJUČ
```

Nikada ne stavljajte `service_role` ključ u Vite varijable, repozitorij ili browser. Sve varijable s prefiksom `VITE_` dostupne su klijentu.

### Baza

Za hostani projekt otvorite Supabase SQL Editor i izvršite cijelu migraciju:

`supabase/migrations/202611040001_initial_fintrack.sql`

Za lokalni Supabase:

```powershell
supabase start
supabase db reset
```

U Supabase Authentication postavkama:

1. uključite Email provider;
2. dodajte `http://localhost:4173` u Site URL / Redirect URLs za lokalni razvoj;
3. za produkciju dodajte konačnu HTTPS domenu;
4. ostavite anon pristup tablicama blokiran — migracija ne daje anon privilegije.

Pokrenite aplikaciju:

```powershell
npm run dev
```

Otvorite [http://localhost:4173](http://localhost:4173), stvorite privatni račun i počnite dodavanjem financijskog računa.

## Model financijskih podataka

Svaki financijski račun ima početno stanje i izvedeni saldo. Saldo nije zasebno uređiva polje:

```text
saldo = početno_stanje + zbroj(transaction_entries.amount_cents)
```

Iznosi su cijeli brojevi centi (`bigint`). Svaka transakcija ima najmanje dvije stavke čiji je zbroj nula:

- trošak: `− račun`, `+ trošak`
- prihod: `+ račun`, `− prihod`
- transfer: `− izvorni račun`, `+ odredišni račun`
- kreditna kupnja: `− račun obveze`, `+ trošak`
- otplata kartice: `− tekući račun`, `+ račun obveze`
- kupnja ulaganja: `− brokerage gotovina`, `+ pozicija`

Debitna kartica nije račun. Kreditna kartica povezuje se s računom vrste kreditna obveza. Budžetske alokacije ne stvaraju ledger stavke. Tržišna valuacija mijenja neto vrijednost, ali ne ulazi u redovni prihod.

## Testiranje

```powershell
npm test
npm run typecheck
npm run build
```

Playwright prvi put treba preglednik:

```powershell
npx playwright install chromium
npm run test:e2e
```

RLS izolacijski test nalazi se u `supabase/tests/rls.sql` i može se pokrenuti protiv lokalne testne baze:

```powershell
supabase test db
```

Vitest pokriva svih 12 zadanih correctness scenarija, uključujući kreditne kartice, interne transfere, valuacije, budžete i zagrebačke DST granice.

## Produkcijski build i deployment

```powershell
npm run build
npm run preview
```

Sadržaj `dist/` može se objaviti na Vercel, Netlify, Cloudflare Pages ili drugom statičkom hostingu. Konfigurirajte:

- build naredbu: `npm run build`
- output direktorij: `dist`
- SPA fallback svih ruta na `/index.html`
- `VITE_SUPABASE_URL` i `VITE_SUPABASE_ANON_KEY` kao build-time varijable
- HTTPS (obavezan za service worker izvan localhosta)

Za Vercel je uključen `vercel.json`, a za Netlify `public/_redirects`. U Supabase Auth dodajte produkcijsku domenu u Redirect URLs.

### Instalacija kao aplikacija

**Windows (Edge/Chrome):** otvorite produkcijski URL, u adresnoj traci odaberite ikonu *Instaliraj aplikaciju* ili izbornik → Apps → Install FinTrack. Aplikacija se zatim može prikvačiti na Start/Taskbar.

**Android (Chrome):** otvorite URL → izbornik → *Instaliraj aplikaciju* ili *Dodaj na početni zaslon*.

**iPhone/iPad (Safari):** otvorite URL → Share → *Add to Home Screen*. iOS koristi instalirani PWA iz tog prečaca.

Financijski API pozivi namjerno koriste mrežu i ne spremaju privatne odgovore u service-worker cache. Offline je dostupan samo app shell; unos podataka traži vezu kako bi ledger ostao konzistentan.

## Backup i oporavak

U Postavkama redovito preuzmite puni JSON backup. Datoteka sadrži `schema_version: 1`. Uvoz prvo prikazuje broj računa, kategorija, transakcija i prepoznatih duplikata. Sama bazna operacija je atomska: pri pogrešci se cijeli uvoz poništava.

## Sigurnosne napomene

- Aplikacija je namijenjena jednom privatnom korisniku, ali baza ispravno izolira više Supabase korisnika.
- RLS provjerava `owner_id = auth.uid()` za SELECT/INSERT/UPDATE/DELETE.
- Složena financijska knjiženja dostupna su samo kroz `security definer` funkcije s eksplicitnom provjerom vlasnika.
- Nema bankovnih integracija, scraping funkcija ni pohrane bankovnih vjerodajnica.
- Za dodatnu produkcijsku zaštitu uključite MFA u Supabase Authu, dnevne Supabase backupove i redovito preuzimajte JSON kopiju.
