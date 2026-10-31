-- =====================================================================
-- FIN:OS | 008: funkcije (pravice) uporabnikov - Nastavitve -> Pravice in dostopi
--
-- fos_funkcije                 pravice: koda, ime, opis, kaj obsega (seznam). Nova pravica = nova vrstica tu.
-- ln_fos_zaposleni_funkcije    kateri zaposleni (z računom) ima katero funkcijo (skrit zapis = brez funkcije).
--                              Piše SAMO strežnik (/api/pravice, service_role) - aplikacija samo bere.
-- fos_ima_funkcijo(koda)       ali ima prijavljen uporabnik funkcijo
-- fos_moje_funkcije()          kode funkcij prijavljenega uporabnika (zaklep v aplikaciji)
--
-- super_admin                  dostop do FIN:OS Administracije (prej stolpec fos_zaposleni.super_admin - prenese se sem)
-- kadrovanje                   osebni (občutljivi) podatki zaposlenih: fos_zaposleni_kadrovsko. Brez nje baza teh
--                              podatkov NE vrne - tudi Super Adminu ne. Dodeli / odvzame jo lahko samo, kdor jo ima.
--
-- fos_zaposleni_zaposlitev     podatki o zaposlitvi (pogodba, ure, dopust, izobrazba) - prestavljeni iz
--                              fos_zaposleni_kadrovsko, ker jih potrebuje delovni čas (brez Kadrovanja).
--
-- Zaženi PO 007_kadrovsko.sql. Idempotentno.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Funkcije
-- ---------------------------------------------------------------------
create table if not exists fos_funkcije (
  id          bigint generated always as identity primary key,
  koda        text not null unique,
  ime         text not null,
  opis        text not null,
  obsega      text[] not null default '{}',
  vrstni_red  integer not null default 0,
  visible     boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

drop trigger if exists fos_funkcije_updated_at on fos_funkcije;
create trigger fos_funkcije_updated_at
  before update on fos_funkcije for each row execute function fos_set_updated_at();

insert into fos_funkcije (koda, ime, opis, obsega, vrstni_red) values
  ('super_admin', 'Super Admin',
   'Dostop do FIN:OS Administracije z lastnim računom (e-mail / uporabniško ime in geslo).',
   '{"Administracija: zaposleni, hierarhija, dostopi do aplikacij","Nastavitve: podatki baze, pravice in dostopi","Dodeljevanje funkcij drugim uporabnikom (razen Kadrovanja)","Podatki o zaposlitvi: pogodba, delovni čas, dopust"}', 1),
  ('kadrovanje', 'Kadrovanje',
   'Osebni podatki zaposlenih - brez te funkcije so skriti in jih ni mogoče odkriti, tudi Super Adminu ne.',
   '{"EMŠO, davčna številka, številka zdravstvenega zavarovanja","Datum in kraj rojstva, spol, državljanstvo, osebni telefon in e-mail","Stalno in začasno prebivališče, kilometri do dela","TRR (izplačilo) in kontakt v sili","Dodeljevanje in odvzem funkcije Kadrovanje"}', 2)
on conflict (koda) do update set ime = excluded.ime, opis = excluded.opis, obsega = excluded.obsega, vrstni_red = excluded.vrstni_red;

create table if not exists ln_fos_zaposleni_funkcije (
  id              bigint generated always as identity primary key,
  id_zaposlenega  bigint not null references fos_zaposleni(id),
  id_funkcije     bigint not null references fos_funkcije(id),
  visible         boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create unique index if not exists ln_fos_zaposleni_funkcije_uq
  on ln_fos_zaposleni_funkcije (id_zaposlenega, id_funkcije) where visible;

drop trigger if exists ln_fos_zaposleni_funkcije_updated_at on ln_fos_zaposleni_funkcije;
create trigger ln_fos_zaposleni_funkcije_updated_at
  before update on ln_fos_zaposleni_funkcije for each row execute function fos_set_updated_at();

-- branje za prijavljene, pisanje samo strežnik (service_role obide RLS in pravice)
alter table fos_funkcije enable row level security;
drop policy if exists fos_funkcije_select on fos_funkcije;
create policy fos_funkcije_select on fos_funkcije for select to authenticated using (true);
revoke insert, update, delete on fos_funkcije from anon, authenticated;

alter table ln_fos_zaposleni_funkcije enable row level security;
drop policy if exists ln_fos_zaposleni_funkcije_select on ln_fos_zaposleni_funkcije;
create policy ln_fos_zaposleni_funkcije_select on ln_fos_zaposleni_funkcije for select to authenticated using (true);
revoke insert, update, delete on ln_fos_zaposleni_funkcije from anon, authenticated;

-- prenos Super Admina iz stolpca fos_zaposleni.super_admin (005)
do $$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'fos_zaposleni' and column_name = 'super_admin') then
    insert into ln_fos_zaposleni_funkcije (id_zaposlenega, id_funkcije)
    select z.id, f.id
    from fos_zaposleni z cross join fos_funkcije f
    where f.koda = 'super_admin' and z.super_admin and z.visible
      and not exists (select 1 from ln_fos_zaposleni_funkcije l where l.id_zaposlenega = z.id and l.id_funkcije = f.id and l.visible);
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- Preverjanje
-- ---------------------------------------------------------------------
create or replace function fos_ima_funkcijo(p_koda text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from fos_zaposleni z
    join ln_fos_zaposleni_funkcije l on l.id_zaposlenega = z.id and l.visible
    join fos_funkcije f on f.id = l.id_funkcije and f.visible
    where z.id_uporabnika = auth.uid() and z.visible and f.koda = p_koda
  );
$$;

create or replace function fos_moje_funkcije()
returns text[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(array_agg(f.koda order by f.vrstni_red), '{}')
  from fos_zaposleni z
  join ln_fos_zaposleni_funkcije l on l.id_zaposlenega = z.id and l.visible
  join fos_funkcije f on f.id = l.id_funkcije and f.visible
  where z.id_uporabnika = auth.uid() and z.visible;
$$;

-- Super Admin iz funkcij (prej stolpec); uporablja ga fos_ima_dostop (006)
create or replace function fos_je_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select fos_ima_funkcijo('super_admin');
$$;

revoke all on function fos_ima_funkcijo(text) from public, anon;
revoke all on function fos_moje_funkcije() from public, anon;
revoke all on function fos_je_super_admin() from public, anon;
grant execute on function fos_ima_funkcijo(text) to authenticated;
grant execute on function fos_moje_funkcije() to authenticated;
grant execute on function fos_je_super_admin() to authenticated;

-- fos_ima_dostop (006) brez stolpca super_admin
create or replace function fos_ima_dostop(p_ime text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  z record;
begin
  select id, visible into z
  from fos_zaposleni where id_uporabnika = auth.uid()
  order by visible desc limit 1;

  if not found then
    return true;
  end if;
  if not z.visible then
    return false;
  end if;
  if starts_with(p_ime, 'fos_') or starts_with(p_ime, 'ln_fos_') then
    return fos_je_super_admin();
  end if;

  return exists (
    select 1
    from ln_fos_zaposleni_aplikacije l
    join fos_aplikacije a on a.id = l.id_aplikacije and a.visible
    where l.id_zaposlenega = z.id and l.visible
      and (
        p_ime = any (a.kosare)
        or exists (select 1 from unnest(a.predpone) p where starts_with(p_ime, p) or starts_with(p_ime, 'ln_' || p))
      )
  );
end;
$$;

-- stolpec ni več vir podatka (en vir: ln_fos_zaposleni_funkcije)
alter table fos_zaposleni drop column if exists super_admin;

-- ---------------------------------------------------------------------
-- Zaposlitev (iz fos_zaposleni_kadrovsko)
-- ---------------------------------------------------------------------
create table if not exists fos_zaposleni_zaposlitev (
  id                  bigint generated always as identity primary key,
  id_zaposlenega      bigint not null references fos_zaposleni(id),
  datum_zaposlitve    date,
  vrsta_pogodbe       text check (vrsta_pogodbe in ('nedolocen', 'dolocen', 'studentsko', 'podjemna', 'avtorska', 'prakticno')),
  pogodba_do          date,
  delovno_mesto       text,
  raven_izobrazbe     text,
  izobrazba           text,
  tedenske_ure        numeric(4, 1) check (tedenske_ure > 0 and tedenske_ure <= 60),
  letni_dopust        integer check (letni_dopust >= 0),
  delovna_doba_prej   integer check (delovna_doba_prej >= 0),
  visible             boolean not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create unique index if not exists fos_zaposleni_zaposlitev_zaposleni_uq
  on fos_zaposleni_zaposlitev (id_zaposlenega) where visible;

drop trigger if exists fos_zaposleni_zaposlitev_updated_at on fos_zaposleni_zaposlitev;
create trigger fos_zaposleni_zaposlitev_updated_at
  before update on fos_zaposleni_zaposlitev for each row execute function fos_set_updated_at();

alter table fos_zaposleni_zaposlitev enable row level security;
drop policy if exists fos_zaposleni_zaposlitev_select on fos_zaposleni_zaposlitev;
drop policy if exists fos_zaposleni_zaposlitev_insert on fos_zaposleni_zaposlitev;
drop policy if exists fos_zaposleni_zaposlitev_update on fos_zaposleni_zaposlitev;
create policy fos_zaposleni_zaposlitev_select on fos_zaposleni_zaposlitev for select to authenticated using (true);
create policy fos_zaposleni_zaposlitev_insert on fos_zaposleni_zaposlitev for insert to authenticated with check (true);
create policy fos_zaposleni_zaposlitev_update on fos_zaposleni_zaposlitev for update to authenticated using (true) with check (true);
select fos_zasciti_tabelo('fos_zaposleni_zaposlitev'::regclass);

-- prenos iz prve različice 007 (stolpci zaposlitve v fos_zaposleni_kadrovsko)
do $$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'fos_zaposleni_kadrovsko' and column_name = 'tedenske_ure') then
    insert into fos_zaposleni_zaposlitev (id_zaposlenega, datum_zaposlitve, vrsta_pogodbe, pogodba_do, delovno_mesto, raven_izobrazbe, izobrazba, tedenske_ure, letni_dopust, delovna_doba_prej)
    select k.id_zaposlenega, k.datum_zaposlitve, k.vrsta_pogodbe, k.pogodba_do, k.delovno_mesto, k.raven_izobrazbe, k.izobrazba, k.tedenske_ure, k.letni_dopust, k.delovna_doba_prej
    from fos_zaposleni_kadrovsko k
    where k.visible
      and num_nonnulls(k.datum_zaposlitve, k.vrsta_pogodbe, k.pogodba_do, k.delovno_mesto, k.raven_izobrazbe, k.izobrazba, k.tedenske_ure, k.letni_dopust, k.delovna_doba_prej) > 0
      and not exists (select 1 from fos_zaposleni_zaposlitev p where p.id_zaposlenega = k.id_zaposlenega and p.visible);
    alter table fos_zaposleni_kadrovsko
      drop column datum_zaposlitve, drop column vrsta_pogodbe, drop column pogodba_do, drop column delovno_mesto,
      drop column raven_izobrazbe, drop column izobrazba, drop column tedenske_ure, drop column letni_dopust, drop column delovna_doba_prej;
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- Kadrovanje: osebni podatki samo s funkcijo (velja skupaj s fos_dostop - omejevalni politiki se seštejeta)
-- ---------------------------------------------------------------------
drop policy if exists fos_kadrovanje on fos_zaposleni_kadrovsko;
create policy fos_kadrovanje on fos_zaposleni_kadrovsko as restrictive for all to authenticated
  using ((select fos_ima_funkcijo('kadrovanje'))) with check ((select fos_ima_funkcijo('kadrovanje')));
