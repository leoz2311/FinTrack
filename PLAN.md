# FinTrack — plan implementacije

## Arhitekturne odluke

- Novac se u aplikaciji i bazi sprema isključivo kao cijeli broj centi (`bigint`).
- Saldo financijskog računa računa se kao početno stanje plus zbroj ledger stavki. Kartice nemaju vlastiti saldo: debitna kartica tereti povezani aktivni račun, a kreditna kartica povezani račun obveze.
- Svaka transakcija sadrži izbalansirane ledger stavke čiji je zbroj nula. Trošak, prihod, kapital i promjena vrijednosti imaju protustavku bez financijskog računa; interni transfer ima dvije računske stavke.
- Sve složene mutacije izvršavaju se atomskim PostgreSQL funkcijama. RLS je uključen na svakoj korisničkoj tablici i vlasništvo se veže uz `auth.uid()`.
- Budžeti su planovi i nikada ne stvaraju ledger stavke. Tržišna promjena ulaganja mijenja neto vrijednost, ali ne ulazi u redovni prihod.
- Izvještajni datumi izračunavaju se u zoni `Europe/Zagreb`; u bazi se spremaju kao `timestamptz`.

## Milestone 1 — temelj, autentikacija i baza

- [ ] React/TypeScript/Vite projekt, Tailwind dizajn sustav, rute i responzivni app shell
- [ ] Supabase klijent, prijava/registracija/odjava i zaštićene rute
- [ ] SQL migracija sa shemom, indeksima, ograničenjima, RPC funkcijama i RLS pravilima
- [ ] Croatian (`hr-HR`) formatiranje, EUR, Europe/Zagreb i dark/light tema

**Kriterij prihvata:** aplikacija se gradi bez grešaka, korisnik bez sesije vidi prijavu, a konfiguracija bez tajni prikazuje jasnu uputu umjesto rušenja.

## Milestone 2 — ledger, računi, kartice i transakcije

- [ ] CRUD i arhiviranje računa, početno stanje i usklađenje uz audit trag
- [ ] Kartice povezane s računom financiranja ili računom kreditne obveze
- [ ] Unos, uređivanje i brisanje prihoda, troška, transfera i usklađenja
- [ ] Pretraga, filtri, sortiranje i detalj računa s izračunatim stanjem

**Kriterij prihvata:** saldo proizlazi isključivo iz početnog stanja i ledger stavki; transferi i otplate kartica ne ulaze u prihod/trošak; mutacije odmah osvježavaju povezane upite.

## Milestone 3 — budžeti i dashboard

- [ ] Neovisni mjesečni budžeti, očekivani prihod, limit i kategorijske alokacije
- [ ] Planirano/stvarno/preostalo, upozorenja i kopiranje prethodnog mjeseca
- [ ] Dashboard s realnim agregatima, filterima, usporedbama, trendovima i praznim stanjima

**Kriterij prihvata:** alokacije ne mijenjaju salda; dashboard nikada ne prikazuje izmišljene financijske podatke.

## Milestone 4 — štednja, ulaganja i analitika

- [ ] Ciljevi štednje i napredak iz stvarnog stanja računa
- [ ] Ručni investicijski instrumenti, pozicije, troškovna osnovica i valuacije
- [ ] Dnevni, tjedni, mjesečni i godišnji prikazi, kategorije, prioriteti i usporedbe
- [ ] Povijesne snimke neto vrijednosti

**Kriterij prihvata:** brokerage gotovina i pozicije nisu dvostruko zbrojene; promjena valuacije utječe na neto vrijednost, ali ne na redovni prihod.

## Milestone 5 — upravljanje podacima i PWA

- [ ] CSV/Excel/JSON izvoz te validirani JSON uvoz s pregledom i detekcijom duplikata
- [ ] PWA manifest, service worker, offline app shell i instalacijske upute
- [ ] Stanja učitavanja/pogreške, pristupačnost, mobilna donja navigacija i desktop sidebar

**Kriterij prihvata:** aplikacija je instalabilna, izvoz je čitljiv, backup ima verziju sheme, a uvoz se ne izvršava bez pregleda.

## Milestone 6 — testovi i završna provjera

- [ ] Vitest testovi financijske logike i rubnih slučajeva vremenske zone
- [ ] SQL/RLS test za izolaciju dvaju korisnika
- [ ] Playwright osnovni tokovi prijave i unosa
- [ ] Build, test i vizualna provjera ključnih viewporta

**Kriterij prihvata:** svih 12 zadanih correctness slučajeva ima automatiziranu pokrivenost ili izričit integracijski test, a build i dostupni testovi prolaze.
