-- =====================================================================
-- FIN:OS | 022: FIN:TV - zasloni (TV-ji v proizvodnji), seznami predvajanja, okna
-- POTRJENO 2026-11-12 - zaženi v Supabase -> SQL Editor.
--
-- fos_tv_seznami   seznam predvajanja. Vsak zaslon dobi svojega; POVEZANI zasloni kažejo ISTI seznam
--                  (fos_tv_povezi). Odveži (fos_tv_odvezi) = zaslon dobi kopijo skupnega seznama.
-- fos_tv_zasloni   TV (računalnik ob TV-ju): ime, lokacija, zgoščen ključ (sha256, kot krmilnik 021), seznam,
--                  zadnji stik, kaj se trenutno vrti, ukaz (osvezi / ime) z zaporedno številko.
-- fos_tv_okna      okno v seznamu: vrsta slika / video / pdf / obvestilo, vrstni red, trajanje (s; pri PDF na
--                  stran, pri videu dolžina videa), prehod, velja od-do, aktivno. Datoteke so v Storage košari
--                  fos-tv (pot v `datoteka`, pri PDF strani kot slike 4K v `strani`). `vsebina` (jsonb):
--                  prilagoditev slike (zapolni / celo), obvestilo (naslov, besedilo, barva, ikona).
--
-- TV (Edge --app čez cel zaslon) NE dostopa do baze neposredno: kliče FIN:OS /api/tv s ključem zaslona,
-- strežnik (service_role) vrne vsebino in podpisane povezave do datotek. Ukraden ključ zna samo brati vsebino
-- svojega zaslona. Ključ se zamenja (fos_tv_nov_kljuc) ali zaslon onemogoči (visible).
--
-- Dostop: tabele fos_tv_* so za Administracijo (Super Admin, fos_ima_dostop); košara fos-tv prek aplikacije
-- "FIN:TV" v fos_aplikacije (kasneje lahko FIN:TV dobi kadrovska brez Administracije).
--
-- Zaženi PO 021. Idempotentno.
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------
-- Tabele
-- ---------------------------------------------------------------------
create table if not exists fos_tv_seznami (
  id          bigint generated always as identity primary key,
  ime         text not null default '',
  visible     boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists fos_tv_zasloni (
  id           bigint generated always as identity primary key,
  ime          text not null check (btrim(ime) <> ''),
  lokacija     text not null default '',
  kljuc_hash   text not null,
  id_seznama   bigint not null references fos_tv_seznami(id),
  zadnji_stik  timestamptz,
  trenutno     text,                                    -- kaj se vrti (javi TV ob stiku)
  verzija      text,                                    -- verzija predvajalnika (brskalnik)
  ukaz         text check (ukaz in ('osvezi', 'ime')),  -- zadnji ukaz iz Administracije
  ukaz_st      integer not null default 0,              -- vsak nov ukaz +1 (TV ga izvede enkrat)
  visible      boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create unique index if not exists fos_tv_zasloni_kljuc_uq on fos_tv_zasloni (kljuc_hash);

create table if not exists fos_tv_okna (
  id          bigint generated always as identity primary key,
  id_seznama  bigint not null references fos_tv_seznami(id),
  vrsta       text not null check (vrsta in ('slika', 'video', 'pdf', 'obvestilo')),
  naslov      text not null default '',
  vrstni_red  integer not null default 0,
  trajanje_s  integer not null default 10 check (trajanje_s between 1 and 3600),
  prehod      text not null default 'pojemanje' check (prehod in ('brez', 'pojemanje', 'drsenje', 'povecava', 'zavesa')),
  velja_od    timestamptz,
  velja_do    timestamptz,
  aktivno     boolean not null default true,
  datoteka    text,                                     -- pot v košari fos-tv (slika, video, izvirni PDF)
  strani      text[] not null default '{}',             -- PDF: strani kot slike (pot v košari), vrtijo se po vrsti
  vsebina     jsonb not null default '{}'::jsonb,
  visible     boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  check (velja_do is null or velja_od is null or velja_do > velja_od)
);
create index if not exists fos_tv_okna_seznam_ix on fos_tv_okna (id_seznama, vrstni_red) where visible;

do $$
declare t text;
begin
  foreach t in array array['fos_tv_seznami', 'fos_tv_zasloni', 'fos_tv_okna'] loop
    execute format('drop trigger if exists %1$s_updated_at on %1$s', t);
    execute format('create trigger %1$s_updated_at before update on %1$s for each row execute function fos_set_updated_at()', t);
    execute format('alter table %s enable row level security', t);
    execute format('drop policy if exists %1$s_select on %1$s', t);
    execute format('create policy %1$s_select on %1$s for select to authenticated using (true)', t);
    execute format('drop policy if exists %1$s_insert on %1$s', t);
    execute format('create policy %1$s_insert on %1$s for insert to authenticated with check (true)', t);
    execute format('drop policy if exists %1$s_update on %1$s', t);
    execute format('create policy %1$s_update on %1$s for update to authenticated using (true) with check (true)', t);
    perform fos_zasciti_tabelo(t::regclass);
  end loop;
end;
$$;

-- zaslon: ključa (hash) aplikacija ne bere; nov zaslon in ključ samo prek funkcij, seznam samo prek povezi / odvezi
revoke all on fos_tv_zasloni from anon, authenticated;
grant select (id, ime, lokacija, id_seznama, zadnji_stik, trenutno, verzija, ukaz, ukaz_st, visible, created_at, updated_at) on fos_tv_zasloni to authenticated;
grant update (ime, lokacija, visible) on fos_tv_zasloni to authenticated;

-- ---------------------------------------------------------------------
-- Zaslon in ključ (Administracija); fos_nov_kljuc / fos_hash_kljuca sta iz 021
-- ---------------------------------------------------------------------
create or replace function fos_tv_kljuc()
returns text
language sql
volatile
set search_path = public, extensions
as $$
  select 'tv_' || encode(gen_random_bytes(24), 'hex');
$$;
revoke all on function fos_tv_kljuc() from public, anon, authenticated;

-- Nov zaslon (z novim praznim seznamom); vrne ključ - pokaže se samo enkrat.
create or replace function fos_tv_nov_zaslon(p_ime text, p_lokacija text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  k text := fos_tv_kljuc();
  s bigint;
begin
  if not fos_ureja_fin_os() then raise exception 'Zaslon doda samo Administracija (Super Admin).'; end if;
  insert into fos_tv_seznami (ime) values (btrim(p_ime)) returning id into s;
  insert into fos_tv_zasloni (ime, lokacija, kljuc_hash, id_seznama) values (btrim(p_ime), coalesce(btrim(p_lokacija), ''), fos_hash_kljuca(k), s);
  return k;
end;
$$;

-- Nov ključ (star preneha delovati takoj).
create or replace function fos_tv_nov_kljuc(p_id bigint)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  k text := fos_tv_kljuc();
begin
  if not fos_ureja_fin_os() then raise exception 'Ključ zamenja samo Administracija (Super Admin).'; end if;
  update fos_tv_zasloni set kljuc_hash = fos_hash_kljuca(k) where id = p_id;
  if not found then raise exception 'Zaslona ni.'; end if;
  return k;
end;
$$;

-- Poveži: zaslon p_id kaže seznam zaslona p_z - z njim gredo vsi, ki so bili že povezani s p_id (cela skupina).
-- Vsebina p_id se ne kaže več (okna ostanejo v bazi); katero vsebino obdržita, izbere Administracija (smer klica).
create or replace function fos_tv_povezi(p_id bigint, p_z bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  cilj bigint;
  star bigint;
begin
  if not fos_ureja_fin_os() then raise exception 'Zaslone poveže samo Administracija (Super Admin).'; end if;
  if p_id = p_z then raise exception 'Zaslona ni mogoče povezati s samim seboj.'; end if;
  select id_seznama into cilj from fos_tv_zasloni where id = p_z and visible;
  if cilj is null then raise exception 'Zaslona za povezavo ni.'; end if;
  select id_seznama into star from fos_tv_zasloni where id = p_id;
  update fos_tv_zasloni set id_seznama = cilj where id_seznama = star;
end;
$$;

-- Odveži: zaslon dobi svoj seznam s kopijo vseh oken (datoteke ostanejo iste - samo poti).
create or replace function fos_tv_odvezi(p_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  star bigint;
  nov bigint;
begin
  if not fos_ureja_fin_os() then raise exception 'Zaslon odveže samo Administracija (Super Admin).'; end if;
  select id_seznama into star from fos_tv_zasloni where id = p_id;
  if star is null then raise exception 'Zaslona ni.'; end if;
  if (select count(*) from fos_tv_zasloni where id_seznama = star and visible) < 2 then return; end if;
  insert into fos_tv_seznami (ime) select ime from fos_tv_zasloni where id = p_id returning id into nov;
  insert into fos_tv_okna (id_seznama, vrsta, naslov, vrstni_red, trajanje_s, prehod, velja_od, velja_do, aktivno, datoteka, strani, vsebina)
    select nov, vrsta, naslov, vrstni_red, trajanje_s, prehod, velja_od, velja_do, aktivno, datoteka, strani, vsebina
    from fos_tv_okna where id_seznama = star and visible order by vrstni_red;
  update fos_tv_zasloni set id_seznama = nov where id = p_id;
end;
$$;

-- Ukaz zaslonu: osvezi (ponovno naloži stran) / ime (10 s pokaže ime zaslona).
create or replace function fos_tv_ukaz(p_id bigint, p_ukaz text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not fos_ureja_fin_os() then raise exception 'Ukaz pošlje samo Administracija (Super Admin).'; end if;
  update fos_tv_zasloni set ukaz = p_ukaz, ukaz_st = ukaz_st + 1 where id = p_id;
end;
$$;

revoke all on function fos_tv_nov_zaslon(text, text) from public, anon;
revoke all on function fos_tv_nov_kljuc(bigint) from public, anon;
revoke all on function fos_tv_povezi(bigint, bigint) from public, anon;
revoke all on function fos_tv_odvezi(bigint) from public, anon;
revoke all on function fos_tv_ukaz(bigint, text) from public, anon;
grant execute on function fos_tv_nov_zaslon(text, text) to authenticated;
grant execute on function fos_tv_nov_kljuc(bigint) to authenticated;
grant execute on function fos_tv_povezi(bigint, bigint) to authenticated;
grant execute on function fos_tv_odvezi(bigint) to authenticated;
grant execute on function fos_tv_ukaz(bigint, text) to authenticated;

-- ---------------------------------------------------------------------
-- Datoteke: košara fos-tv (zasebna; TV dobi podpisane povezave prek /api/tv)
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit)
values ('fos-tv', 'fos-tv', false, 524288000)   -- 500 MB na datoteko (video); omejitev projekta Supabase velja posebej
on conflict (id) do nothing;

drop policy if exists fos_tv_datoteke_select on storage.objects;
create policy fos_tv_datoteke_select on storage.objects for select to authenticated using (bucket_id = 'fos-tv');
drop policy if exists fos_tv_datoteke_insert on storage.objects;
create policy fos_tv_datoteke_insert on storage.objects for insert to authenticated with check (bucket_id = 'fos-tv');

-- aplikacija FIN:TV (stikalo v Dostopih; omejevalna politika fos_dostop na storage.objects jo preveri po košari)
insert into fos_aplikacije (koda, ime, opis, predpone, kosare, vrstni_red)
values ('tv', 'FIN:TV', 'Televizorji v proizvodnji: vsebina in zasloni', '{}', '{fos-tv}', 10)
on conflict (koda) do nothing;

-- Preverjanje
select 'fos_tv_zasloni' as tabela, count(*) from fos_tv_zasloni where visible
union all select 'fos_tv_okna', count(*) from fos_tv_okna where visible;
