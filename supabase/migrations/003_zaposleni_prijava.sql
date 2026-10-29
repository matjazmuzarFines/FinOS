-- =====================================================================
-- FIN:OS | 003: prijava zaposlenega v FIN:ME (e-mail, uporabniško ime, račun)
--
-- fos_zaposleni.email            e-mail za prijavo (enoličen med vidnimi zaposlenimi)
-- fos_zaposleni.uporabnisko_ime  uporabniško ime za prijavo (male črke, enolično)
-- fos_zaposleni.id_uporabnika    račun v Supabase Auth (auth.users.id)
--
-- GESLA NI V TEJ TABELI: geslo hrani Supabase Auth (auth.users, bcrypt - enosmerno, ni ga mogoče prebrati).
-- Račun ustvari / spremeni samo strežnik aplikacije (/api/zaposleni/racun, ključ service_role),
-- zato prijavljeni uporabniki teh treh stolpcev ne morejo pisati neposredno (pravice po stolpcih spodaj).
--
-- Zaženi PO 002_vodje.sql. Idempotentno.
-- =====================================================================

alter table fos_zaposleni add column if not exists email text;
alter table fos_zaposleni add column if not exists uporabnisko_ime text;
alter table fos_zaposleni add column if not exists id_uporabnika uuid references auth.users(id);

create unique index if not exists fos_zaposleni_email_uq
  on fos_zaposleni (lower(email)) where visible and email is not null;
create unique index if not exists fos_zaposleni_uporabnisko_ime_uq
  on fos_zaposleni (lower(uporabnisko_ime)) where visible and uporabnisko_ime is not null;
create unique index if not exists fos_zaposleni_uporabnik_uq
  on fos_zaposleni (id_uporabnika) where id_uporabnika is not null;

-- Pravice po stolpcih: aplikacija (authenticated) piše samo podatke zaposlenega, prijavne podatke piše strežnik.
-- POZOR: nov stolpec v fos_zaposleni, ki ga ureja aplikacija, je treba dodati v oba seznama spodaj.
revoke insert, update on fos_zaposleni from anon, authenticated;
grant insert (ime, priimek, st_kartice, id_oddelek) on fos_zaposleni to authenticated;
grant update (ime, priimek, st_kartice, id_oddelek, visible) on fos_zaposleni to authenticated;
