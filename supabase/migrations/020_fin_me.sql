-- =====================================================================
-- FIN:OS | 020: FIN:ME - zahtevki, dopust, nastavitve FIN:ME, žig iz Mojega Finesa, dostopi po hierarhiji
--
-- Kdo kaj sme (hierarhija iz FIN:OS: ln_fos_zaposleni_vodja -> fos_vodje):
--   * zaposleni       vidi SAMO sebe: svoj čas (dogodki, saldo, dopust, urnik), svoje zahtevke; ne ureja ničesar,
--                     odda zahtevek zase (odsotnost, dovolilnica, popravek) in ga lahko umakne, dokler ni potrjen
--   * vodja           vidi sebe + VSE svoje (posredne) podrejene; ureja dogodke podrejenih (ročni dogodek, spregled),
--                     potrdi / zavrne zahtevke podrejenih; SEBE ne ureja in svojih zahtevkov ne potrjuje
--   * Super Admin     (FIN:OS Administracija) in računi brez zaposlenega (npr. fines@fines.si) - vse kot doslej
--
-- Kako: fos_ima_dostop (006/008) za tabele s seznama FIN_ME vrne true tudi zaposlenim BREZ Super Admina; vrstice in
-- pisanje omejijo nove omejevalne (restrictive) politike na teh tabelah:
--   * skupne tabele   (statistike, urniki, intervali, prazniki, tipke, oddelki, vodje): branje vsem zaposlenim,
--                     pisanje samo fos_ureja_fin_os()
--   * osebne tabele   (stolpec id_zaposlenega): branje samo vrstic iz fos_moji_vidni() (jaz + ekipa),
--                     pisanje: dogodki = Admin ali vodja za ekipo; saldo, dopust, urnik zaposlenega = samo Admin;
--                     zahtevki = samo prek funkcij (security definer) spodaj
--   * fos_zaposleni   vidim sebe, ekipo in svojega vodjo (ime ob zahtevku)
--   Ostale fos_ tabele (kadrovsko, zaposlitev, funkcije, aplikacije ...) ostanejo samo za Super Admina.
--
-- Nove tabele:
--   fos_dopust_leta          dopust zaposlenega po letih (dni letnega in lanskega dopusta; en viden zapis na leto)
--   fos_zahtevki             zahtevki FIN:ME: vrsta odsotnost / dovolilnica / popravek, status oddano / potrjeno /
--                            zavrnjeno / preklicano, kdo je oddal, kdo in kdaj odločil, razlog zavrnitve
--   fos_zahtevki_postavke    postavke popravka dneva: dodaj žig, spreglej žig, cel dan v statistiki
--                            Akcija zahtevka: nov / sprememba (nadomesti id_prejsnji) / izbris (prošnja za izbris
--                            potrjenega id_prejsnji) - obe gresta v potrditev; po potrditvi je star "spremenjeno" / "izbrisano".
--   fos_zaposleni_finme      nastavitve FIN:ME po zaposlenem: virtualno_belezenje (štempljanje v Mojem Finesu)
--   Žig iz Mojega Finesa: fos_zig_online (čas = strežnik, vir online, samo z virtualnim beleženjem),
--   fos_preklici_zadnji_zig (spregleda zadnji online žig v 30 min).
-- Nove lastnosti statistik (kvadratki): celodnevna_odsotnost (razlog v Odsotnostih), dovolilnica (razlog izhoda),
-- letni_dopust (šteje v Dopust); novi statistiki OCE (očetovski dopust) in KUR (koriščenje ur).
--
-- Zaženi PO 019 (potrebuje 006, 008, 013-015). Idempotentno - lahko se zažene večkrat.
-- PO ZAGONU: račun zaposlenega brez Super Admina v FIN:ME vidi sebe (in ekipo, če je vodja); Administracija enako kot prej.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Lastnosti in statistike za FIN:ME
-- ---------------------------------------------------------------------
insert into fos_lastnosti (koda, ime, opis, vrstni_red)
select v.koda, v.ime, v.opis, v.vrstni_red
from (values
  ('celodnevna_odsotnost', 'Celodnevna odsotnost', 'Razlog se ponudi v FIN:ME -> Odsotnosti (cel dan ali več dni).', 5),
  ('dovolilnica',          'Razlog dovolilnice',   'Razlog se ponudi v FIN:ME -> Dovolilnice (izhod med delom).', 6),
  ('letni_dopust',         'Štej letni dopust',    'Dan se odšteje od letnega dopusta (okno Dopust v registraciji časa).', 7)
) as v (koda, ime, opis, vrstni_red)
where not exists (select 1 from fos_lastnosti l where l.koda = v.koda and l.visible);

with v (koda, ime, barva, ikona, opis, vrstni_red) as (values
  ('OCE', 'Očetovski dopust', '#6366f1', 'baby',      'Očetovski dopust (nadomestilo plače).', 13),
  ('KUR', 'Koriščenje ur',    '#64748b', 'hourglass', 'Prost dan iz salda ur - ne šteje v delovno obveznost (saldo se zmanjša).', 14)
)
insert into fos_statistike (koda, ime, barva, ikona, opis, vrstni_red)
select v.koda, v.ime, v.barva, v.ikona, v.opis, v.vrstni_red from v
where not exists (select 1 from fos_statistike s where s.koda = v.koda and s.visible);

-- kvadratki: katera statistika je razlog odsotnosti / dovolilnice / letni dopust (Admin jih kasneje ureja v Statistikah)
insert into ln_fos_statistike_lastnosti (id_statistike, id_lastnosti)
select s.id, l.id
from (values
  ('DOP', 'celodnevna_odsotnost'), ('LDOP', 'celodnevna_odsotnost'), ('BOL', 'celodnevna_odsotnost'), ('IZD', 'celodnevna_odsotnost'),
  ('POR', 'celodnevna_odsotnost'), ('IZS', 'celodnevna_odsotnost'), ('SLP', 'celodnevna_odsotnost'), ('OCE', 'celodnevna_odsotnost'),
  ('KUR', 'celodnevna_odsotnost'),
  ('SLO', 'dovolilnica'), ('ZAS', 'dovolilnica'),
  ('DOP', 'letni_dopust')
) as v (koda, lastnost)
join fos_statistike s on s.koda = v.koda and s.visible
join fos_lastnosti l on l.koda = v.lastnost and l.visible
where not exists (select 1 from ln_fos_statistike_lastnosti x where x.id_statistike = s.id and x.id_lastnosti = l.id and x.visible);

-- ---------------------------------------------------------------------
-- Kdo sem in koga vidim
-- ---------------------------------------------------------------------
-- zaposleni prijavljenega računa (null = račun brez zaposlenega)
create or replace function fos_moj_zaposleni()
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select id from fos_zaposleni where id_uporabnika = auth.uid() and visible order by id limit 1;
$$;

-- Administracija: Super Admin ali račun brez zaposlenega (kot v fos_ima_dostop)
create or replace function fos_ureja_fin_os()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select fos_je_super_admin() or not exists (select 1 from fos_zaposleni where id_uporabnika = auth.uid());
$$;

-- vsi (posredni) podrejeni prijavljenega zaposlenega (brez njega samega)
create or replace function fos_moja_ekipa()
returns bigint[]
language sql
stable
security definer
set search_path = public
as $$
  with recursive drevo (id) as (
    select l.id_zaposlenega
    from ln_fos_zaposleni_vodja l
    join fos_vodje v on v.id = l.id_vodja and v.visible
    where l.visible and v.id_zaposlenega = fos_moj_zaposleni()
    union
    select l.id_zaposlenega
    from ln_fos_zaposleni_vodja l
    join fos_vodje v on v.id = l.id_vodja and v.visible
    join drevo d on d.id = v.id_zaposlenega
    where l.visible
  )
  select coalesce(array_agg(id), '{}') from drevo;
$$;

-- jaz + ekipa (branje osebnih podatkov)
create or replace function fos_moji_vidni()
returns bigint[]
language sql
stable
security definer
set search_path = public
as $$
  select case when fos_moj_zaposleni() is null then '{}'::bigint[] else array_append(fos_moja_ekipa(), fos_moj_zaposleni()) end;
$$;

-- moj vodja (zaposleni) - FIN:ME pokaže ime vodje
create or replace function fos_moj_vodja()
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select v.id_zaposlenega
  from ln_fos_zaposleni_vodja l join fos_vodje v on v.id = l.id_vodja and v.visible
  where l.visible and l.id_zaposlenega = fos_moj_zaposleni()
  limit 1;
$$;

revoke all on function fos_moj_zaposleni() from public, anon;
revoke all on function fos_ureja_fin_os() from public, anon;
revoke all on function fos_moja_ekipa() from public, anon;
revoke all on function fos_moji_vidni() from public, anon;
revoke all on function fos_moj_vodja() from public, anon;
grant execute on function fos_moj_zaposleni() to authenticated;
grant execute on function fos_ureja_fin_os() to authenticated;
grant execute on function fos_moja_ekipa() to authenticated;
grant execute on function fos_moji_vidni() to authenticated;
grant execute on function fos_moj_vodja() to authenticated;

-- ---------------------------------------------------------------------
-- Dopust po letih
-- ---------------------------------------------------------------------
create table if not exists fos_dopust_leta (
  id              bigint generated always as identity primary key,
  id_zaposlenega  bigint not null references fos_zaposleni(id),
  leto            integer not null check (leto between 2000 and 2100),
  dopust_dni      numeric(4, 1) not null default 0 check (dopust_dni >= 0),
  lanski_dni      numeric(4, 1) not null default 0 check (lanski_dni >= 0),
  visible         boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create unique index if not exists fos_dopust_leta_uq on fos_dopust_leta (id_zaposlenega, leto) where visible;

create or replace function fos_nastavi_dopust_leta(p_id_zaposlenega bigint, p_leto integer, p_dopust_dni numeric, p_lanski_dni numeric)
returns void
language plpgsql
security invoker
as $$
begin
  if exists (select 1 from fos_dopust_leta where id_zaposlenega = p_id_zaposlenega and leto = p_leto and visible
             and dopust_dni = p_dopust_dni and lanski_dni = p_lanski_dni) then
    return;
  end if;
  update fos_dopust_leta set visible = false where id_zaposlenega = p_id_zaposlenega and leto = p_leto and visible;
  insert into fos_dopust_leta (id_zaposlenega, leto, dopust_dni, lanski_dni) values (p_id_zaposlenega, p_leto, p_dopust_dni, p_lanski_dni);
end;
$$;
grant execute on function fos_nastavi_dopust_leta(bigint, integer, numeric, numeric) to authenticated;

-- ---------------------------------------------------------------------
-- Zahtevki
-- ---------------------------------------------------------------------
create table if not exists fos_zahtevki (
  id                  bigint generated always as identity primary key,
  vrsta               text not null check (vrsta in ('odsotnost', 'dovolilnica', 'popravek')),
  id_zaposlenega      bigint not null references fos_zaposleni(id),
  datum_od            date not null,
  datum_do            date not null,
  cas_od_min          integer check (cas_od_min between 0 and 2880),      -- dovolilnica: minute od polnoči
  cas_do_min          integer check (cas_do_min between 0 and 2880),
  id_statistike       bigint references fos_statistike(id),               -- razlog (odsotnost, izhod)
  tip_dovolilnice     text check (tip_dovolilnice in ('izhod', 'delo')),
  opis                text not null default '',
  status              text not null default 'oddano' check (status in ('oddano', 'potrjeno', 'zavrnjeno', 'preklicano', 'spremenjeno', 'izbrisano')),
  akcija              text not null default 'nov' check (akcija in ('nov', 'sprememba', 'izbris')),
  id_prejsnji         bigint references fos_zahtevki(id),                 -- sprememba / izbris: kateri zahtevek
  id_oddal            bigint references fos_zaposleni(id),                -- kdo je oddal (vodja za podrejenega)
  oddano_ob           timestamptz not null default now(),
  id_odlocil          bigint references fos_zaposleni(id),
  odlocil_uporabnik   uuid default null references auth.users(id),
  odloceno_ob         timestamptz,
  komentar_odlocitve  text not null default '',
  visible             boolean not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint fos_zahtevki_obdobje check (datum_do >= datum_od),
  constraint fos_zahtevki_odsotnost check (vrsta <> 'odsotnost' or id_statistike is not null),
  constraint fos_zahtevki_dovolilnica check (vrsta <> 'dovolilnica' or (tip_dovolilnice is not null and cas_od_min is not null and cas_do_min > cas_od_min and datum_do = datum_od))
);
create index if not exists fos_zahtevki_zaposleni on fos_zahtevki (id_zaposlenega, datum_od) where visible;
create index if not exists fos_zahtevki_status on fos_zahtevki (status) where visible;
create index if not exists fos_zahtevki_prejsnji on fos_zahtevki (id_prejsnji) where visible;

-- FIN:ME nastavitve po zaposlenem (list zaposlenega -> zavihek FIN:ME)
create table if not exists fos_zaposleni_finme (
  id                    bigint generated always as identity primary key,
  id_zaposlenega        bigint not null references fos_zaposleni(id),
  virtualno_belezenje   boolean not null default false,
  visible               boolean not null default true,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create unique index if not exists fos_zaposleni_finme_uq on fos_zaposleni_finme (id_zaposlenega) where visible;

create table if not exists fos_zahtevki_postavke (
  id              bigint generated always as identity primary key,
  id_zahtevka     bigint not null references fos_zahtevki(id),
  akcija          text not null check (akcija in ('dodaj', 'spreglej', 'odsotnost')),
  datum           date not null,
  cas_min         integer,                                       -- dodaj / spreglej (prikaz)
  id_tipke        bigint references fos_tipke(id),               -- dodaj
  id_dogodka      bigint references fos_dogodki(id),             -- spreglej
  id_statistike   bigint references fos_statistike(id),          -- odsotnost (cel dan)
  komentar        text not null default '',
  visible         boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists fos_zahtevki_postavke_zahtevek on fos_zahtevki_postavke (id_zahtevka) where visible;

do $$
declare
  t text;
begin
  foreach t in array array['fos_dopust_leta', 'fos_zahtevki', 'fos_zahtevki_postavke', 'fos_zaposleni_finme'] loop
    execute format('drop trigger if exists %I on %I', t || '_updated_at', t);
    execute format('create trigger %I before update on %I for each row execute function fos_set_updated_at()', t || '_updated_at', t);
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists %I on %I', t || '_select', t);
    execute format('create policy %I on %I for select to authenticated using (true)', t || '_select', t);
    execute format('drop policy if exists %I on %I', t || '_insert', t);
    execute format('create policy %I on %I for insert to authenticated with check (true)', t || '_insert', t);
    execute format('drop policy if exists %I on %I', t || '_update', t);
    execute format('create policy %I on %I for update to authenticated using (true) with check (true)', t || '_update', t);
    execute format('revoke delete on %I from anon, authenticated', t);
    perform fos_zasciti_tabelo(t::regclass);
  end loop;
end;
$$;

-- zahtevke piše samo strežnik prek funkcij spodaj (status, kdo je odločil ... se ne da ponarediti)
revoke insert, update on fos_zahtevki, fos_zahtevki_postavke from anon, authenticated;

-- Potrjen popravek: doda ročne dogodke in spregleda žige (kdo = prijavljen vodja / admin)
create or replace function fos_izvedi_popravek(p_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  z fos_zahtevki;
  p record;
begin
  select * into z from fos_zahtevki where id = p_id;
  for p in select * from fos_zahtevki_postavke where id_zahtevka = p_id and visible order by id loop
    if p.akcija = 'dodaj' then
      insert into fos_dogodki (id_zaposlenega, cas, datum, id_tipke, vir, komentar, vnesel)
      values (z.id_zaposlenega, (p.datum::timestamp + make_interval(mins => p.cas_min)) at time zone 'Europe/Ljubljana', p.datum, p.id_tipke, 'rocno',
              coalesce(nullif(p.komentar, ''), 'Popravek #' || p_id), auth.uid());
    elsif p.akcija = 'spreglej' then
      update fos_dogodki set spregledan = true, spregledal = auth.uid(), spregledano_ob = now()
      where id = p.id_dogodka and id_zaposlenega = z.id_zaposlenega and not spregledan;
    end if;
    -- 'odsotnost' (cel dan v statistiki) ostane v zahtevku - koledar jo prebere iz potrjenih zahtevkov
  end loop;
end;
$$;
revoke all on function fos_izvedi_popravek(bigint) from public, anon, authenticated;

-- Po potrditvi spremembe / izbrisa: star zahtevek dobi status spremenjeno / izbrisano
create or replace function fos_zakljuci_prejsnjega(p_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  z fos_zahtevki;
begin
  select * into z from fos_zahtevki where id = p_id;
  if z.akcija = 'nov' or z.id_prejsnji is null then return; end if;
  update fos_zahtevki set status = case when z.akcija = 'izbris' then 'izbrisano' else 'spremenjeno' end
  where id = z.id_prejsnji and status = 'potrjeno';
end;
$$;
revoke all on function fos_zakljuci_prejsnjega(bigint) from public, anon, authenticated;

-- Oddaj zahtevek: zase = oddano; vodja za podrejenega (ali Admin) = takoj potrjeno. Vrne id.
-- Sprememba / izbris (p_id_prejsnji): istega zaposlenega in vrste, oddan ali potrjen, brez druge čakajoče spremembe;
-- sprememba še oddanega zahtevka ga takoj umakne.
drop function if exists fos_oddaj_zahtevek(text, bigint, date, date, integer, integer, bigint, text, text, jsonb);
create or replace function fos_oddaj_zahtevek(
  p_vrsta text, p_akcija text, p_id_prejsnji bigint, p_id_zaposlenega bigint, p_datum_od date, p_datum_do date, p_cas_od_min integer, p_cas_do_min integer,
  p_id_statistike bigint, p_tip_dovolilnice text, p_opis text, p_postavke jsonb default '[]'::jsonb)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  jaz bigint := fos_moj_zaposleni();
  potrjeno boolean;
  nov bigint;
  prej fos_zahtevki;
begin
  if p_id_zaposlenega = jaz then
    potrjeno := false;
  elsif p_id_zaposlenega = any (fos_moja_ekipa()) or fos_ureja_fin_os() then
    potrjeno := true;
  else
    raise exception 'Zahtevek lahko oddaš samo zase ali za svojo ekipo.';
  end if;
  if coalesce(trim(p_opis), '') = '' then
    raise exception 'Napiši, zakaj (komentar je obvezen).';
  end if;
  if coalesce(p_akcija, 'nov') <> 'nov' then
    select * into prej from fos_zahtevki where id = p_id_prejsnji and visible for update;
    if not found or prej.id_zaposlenega <> p_id_zaposlenega or prej.vrsta <> p_vrsta or p_vrsta = 'popravek' or prej.akcija = 'izbris' then
      raise exception 'Zahtevka ni mogoče spremeniti ali izbrisati.';
    end if;
    if prej.status not in ('oddano', 'potrjeno') then raise exception 'Zahtevek ni več veljaven (%).', prej.status; end if;
    if exists (select 1 from fos_zahtevki where id_prejsnji = prej.id and visible and status = 'oddano') then
      raise exception 'Za ta zahtevek že čaka sprememba ali izbris.';
    end if;
    if prej.status = 'oddano' then
      update fos_zahtevki set status = 'preklicano' where id = prej.id;
      if p_akcija = 'izbris' then return prej.id; end if;   -- izbris nepotrjenega = umik
    end if;
  end if;
  if p_vrsta = 'popravek' and jsonb_array_length(coalesce(p_postavke, '[]'::jsonb)) = 0 then
    raise exception 'Popravek nima nobene spremembe.';
  end if;
  if exists (
    select 1 from fos_zahtevki z
    where z.visible and z.vrsta = p_vrsta and p_vrsta <> 'popravek' and coalesce(p_akcija, 'nov') <> 'izbris' and z.akcija <> 'izbris'
      and z.id is distinct from p_id_prejsnji and z.id_zaposlenega = p_id_zaposlenega
      and z.status in ('oddano', 'potrjeno') and z.datum_od <= p_datum_do and z.datum_do >= p_datum_od
      and (p_vrsta = 'odsotnost' or (z.cas_od_min < p_cas_do_min and z.cas_do_min > p_cas_od_min))
  ) then
    raise exception 'Za ta čas že obstaja zahtevek.';
  end if;

  insert into fos_zahtevki (vrsta, akcija, id_prejsnji, id_zaposlenega, datum_od, datum_do, cas_od_min, cas_do_min, id_statistike, tip_dovolilnice, opis,
                            status, id_oddal, id_odlocil, odlocil_uporabnik, odloceno_ob)
  values (p_vrsta, coalesce(p_akcija, 'nov'), p_id_prejsnji, p_id_zaposlenega, p_datum_od, p_datum_do, p_cas_od_min, p_cas_do_min, p_id_statistike, p_tip_dovolilnice, coalesce(p_opis, ''),
          case when potrjeno then 'potrjeno' else 'oddano' end, jaz,
          case when potrjeno then jaz end, case when potrjeno then auth.uid() end, case when potrjeno then now() end)
  returning id into nov;

  insert into fos_zahtevki_postavke (id_zahtevka, akcija, datum, cas_min, id_tipke, id_dogodka, id_statistike, komentar)
  select nov, e->>'akcija', (e->>'datum')::date, (e->>'cas_min')::integer, (e->>'id_tipke')::bigint, (e->>'id_dogodka')::bigint,
         (e->>'id_statistike')::bigint, coalesce(e->>'komentar', '')
  from jsonb_array_elements(coalesce(p_postavke, '[]'::jsonb)) e;

  -- spregled samo žigov tega zaposlenega
  if exists (select 1 from fos_zahtevki_postavke p join fos_dogodki d on d.id = p.id_dogodka
             where p.id_zahtevka = nov and p.akcija = 'spreglej' and d.id_zaposlenega is distinct from p_id_zaposlenega) then
    raise exception 'Popravek vsebuje žig drugega zaposlenega.';
  end if;

  if potrjeno and p_vrsta = 'popravek' then
    perform fos_izvedi_popravek(nov);
  end if;
  if potrjeno then
    perform fos_zakljuci_prejsnjega(nov);
  end if;
  return nov;
end;
$$;

-- Vodja potrdi / zavrne zahtevek podrejenega (svojega ne more); zavrnitev z razlogom.
create or replace function fos_odloci_zahtevek(p_id bigint, p_status text, p_komentar text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  z fos_zahtevki;
  jaz bigint := fos_moj_zaposleni();
begin
  select * into z from fos_zahtevki where id = p_id and visible for update;
  if not found then raise exception 'Zahtevka ni.'; end if;
  if z.status <> 'oddano' then raise exception 'O zahtevku je že odločeno (%).', z.status; end if;
  if p_status not in ('potrjeno', 'zavrnjeno') then raise exception 'Napačen status.'; end if;
  if z.id_zaposlenega = jaz then raise exception 'Svojega zahtevka ne moreš potrditi.'; end if;
  if not (z.id_zaposlenega = any (fos_moja_ekipa()) or fos_ureja_fin_os()) then
    raise exception 'O zahtevku odloča vodja zaposlenega.';
  end if;
  if p_status = 'zavrnjeno' and coalesce(trim(p_komentar), '') = '' then raise exception 'Napiši razlog zavrnitve.'; end if;

  update fos_zahtevki
  set status = p_status, id_odlocil = jaz, odlocil_uporabnik = auth.uid(), odloceno_ob = now(), komentar_odlocitve = coalesce(trim(p_komentar), '')
  where id = p_id;
  if p_status = 'potrjeno' and z.vrsta = 'popravek' then
    perform fos_izvedi_popravek(p_id);
  end if;
  if p_status = 'potrjeno' then
    perform fos_zakljuci_prejsnjega(p_id);
  end if;
end;
$$;

-- Zaposleni umakne svoj še ne potrjen zahtevek.
create or replace function fos_preklici_zahtevek(p_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update fos_zahtevki set status = 'preklicano'
  where id = p_id and visible and status = 'oddano' and id_zaposlenega = fos_moj_zaposleni();
  if not found then raise exception 'Umakneš lahko samo svoj zahtevek, ki še čaka.'; end if;
end;
$$;

revoke all on function fos_oddaj_zahtevek(text, text, bigint, bigint, date, date, integer, integer, bigint, text, text, jsonb) from public, anon;
revoke all on function fos_odloci_zahtevek(bigint, text, text) from public, anon;
revoke all on function fos_preklici_zahtevek(bigint) from public, anon;
grant execute on function fos_oddaj_zahtevek(text, text, bigint, bigint, date, date, integer, integer, bigint, text, text, jsonb) to authenticated;
grant execute on function fos_odloci_zahtevek(bigint, text, text) to authenticated;
grant execute on function fos_preklici_zahtevek(bigint) to authenticated;

-- ---------------------------------------------------------------------
-- FIN:ME nastavitve in žig iz Mojega Finesa (Delovna ura)
-- ---------------------------------------------------------------------
create or replace function fos_nastavi_finme(p_id_zaposlenega bigint, p_virtualno_belezenje boolean)
returns void
language plpgsql
security invoker
as $$
begin
  if exists (select 1 from fos_zaposleni_finme where id_zaposlenega = p_id_zaposlenega and visible and virtualno_belezenje = p_virtualno_belezenje) then
    return;
  end if;
  update fos_zaposleni_finme set visible = false where id_zaposlenega = p_id_zaposlenega and visible;
  insert into fos_zaposleni_finme (id_zaposlenega, virtualno_belezenje) values (p_id_zaposlenega, p_virtualno_belezenje);
end;
$$;
grant execute on function fos_nastavi_finme(bigint, boolean) to authenticated;

-- Žig zdaj (čas strežnika). Datum = dan prihoda: odhod po polnoči ostane v dnevu prihoda (včeraj liho število žigov, zadnji v zadnjih 16 h).
create or replace function fos_zig_online(p_id_tipke bigint)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  jaz bigint := fos_moj_zaposleni();
  danes date := (now() at time zone 'Europe/Ljubljana')::date;
  dan date := danes;
  nov bigint;
begin
  if jaz is null then raise exception 'Račun ni povezan z zaposlenim.'; end if;
  if not exists (select 1 from fos_zaposleni_finme where id_zaposlenega = jaz and visible and virtualno_belezenje) then
    raise exception 'Virtualno beleženje delovnega časa ni vklopljeno.';
  end if;
  if p_id_tipke is not null and not exists (select 1 from fos_tipke where id = p_id_tipke and visible and 'fin_me' = any (prikaz) and funkcija is null) then
    raise exception 'Tipka ni na voljo v Mojem Finesu.';
  end if;
  if (select count(*) % 2 = 1 and max(cas) > now() - interval '16 hours'
      from fos_dogodki where id_zaposlenega = jaz and visible and not spregledan and datum = danes - 1) then
    dan := danes - 1;
  end if;
  insert into fos_dogodki (id_zaposlenega, cas, datum, id_tipke, vir, vnesel)
  values (jaz, now(), dan, p_id_tipke, 'online', auth.uid())
  returning id into nov;
  return nov;
end;
$$;

-- Prekliči zadnji pritisk: zadnji online žig prijavljenega v zadnjih 30 min se spregleda.
create or replace function fos_preklici_zadnji_zig()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  d bigint;
begin
  select id into d from fos_dogodki
  where id_zaposlenega = fos_moj_zaposleni() and vir = 'online' and visible and not spregledan and cas > now() - interval '30 minutes'
  order by cas desc limit 1;
  if d is null then raise exception 'Ni žiga za preklic (samo zadnjih 30 minut).'; end if;
  update fos_dogodki set spregledan = true, spregledal = auth.uid(), spregledano_ob = now() where id = d;
end;
$$;

revoke all on function fos_zig_online(bigint) from public, anon;
revoke all on function fos_preklici_zadnji_zig() from public, anon;
grant execute on function fos_zig_online(bigint) to authenticated;
grant execute on function fos_preklici_zadnji_zig() to authenticated;

-- ---------------------------------------------------------------------
-- Dostop: FIN:ME tabele odprte zaposlenim (vrstice omejijo politike spodaj)
-- ---------------------------------------------------------------------
create or replace function fos_finme_tabele()
returns text[]
language sql
immutable
as $$
  select array[
    -- skupne (branje vsem zaposlenim)
    'fos_lastnosti', 'fos_statistike', 'ln_fos_statistike_lastnosti', 'fos_dnevi', 'fos_intervali', 'ln_fos_intervali_dnevi',
    'fos_urniki', 'ln_fos_urniki_intervali', 'ln_fos_urniki_dnevi', 'fos_prazniki', 'fos_tipke', 'fos_oddelek', 'fos_vodje',
    'ln_fos_zaposleni_vodja',
    -- osebne (jaz + ekipa)
    'fos_zaposleni', 'fos_dogodki', 'fos_saldo_zacetno', 'fos_saldo_meseci', 'fos_dopust_leta', 'ln_fos_zaposleni_urniki',
    'fos_zahtevki', 'fos_zahtevki_postavke', 'fos_zaposleni_finme'
  ];
$$;

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
    -- FIN:ME: vsak zaposleni do svojih podatkov (vrstice in pisanje omejijo politike fos_finme_*)
    return fos_je_super_admin() or p_ime = any (fos_finme_tabele());
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

-- Politike FIN:ME (omejevalne - veljajo skupaj z obstoječimi). Admin = fos_ureja_fin_os() (Super Admin / brez zaposlenega).
do $$
declare
  t text;
  pogoj text;
begin
  -- skupne: pisanje samo Admin
  foreach t in array array['fos_lastnosti', 'fos_statistike', 'ln_fos_statistike_lastnosti', 'fos_dnevi', 'fos_intervali', 'ln_fos_intervali_dnevi',
                           'fos_urniki', 'ln_fos_urniki_intervali', 'ln_fos_urniki_dnevi', 'fos_prazniki', 'fos_tipke', 'fos_oddelek', 'fos_vodje',
                           'ln_fos_zaposleni_vodja'] loop
    continue when to_regclass(t) is null;
    execute format('drop policy if exists fos_finme_insert on %I', t);
    execute format('create policy fos_finme_insert on %I as restrictive for insert to authenticated with check ((select fos_ureja_fin_os()))', t);
    execute format('drop policy if exists fos_finme_update on %I', t);
    execute format('create policy fos_finme_update on %I as restrictive for update to authenticated using ((select fos_ureja_fin_os()))', t);
  end loop;

  -- osebne (id_zaposlenega): branje jaz + ekipa; pisanje Admin (dogodki še vodja za ekipo)
  foreach t in array array['fos_dogodki', 'fos_saldo_zacetno', 'fos_saldo_meseci', 'fos_dopust_leta', 'ln_fos_zaposleni_urniki', 'fos_zahtevki', 'fos_zaposleni_finme'] loop
    continue when to_regclass(t) is null;
    execute format('drop policy if exists fos_finme_select on %I', t);
    execute format('create policy fos_finme_select on %I as restrictive for select to authenticated using ((select fos_ureja_fin_os()) or id_zaposlenega = any ((select fos_moji_vidni())::bigint[]))', t);
    pogoj := case when t = 'fos_dogodki'
      then '(select fos_ureja_fin_os()) or id_zaposlenega = any ((select fos_moja_ekipa())::bigint[])'
      else '(select fos_ureja_fin_os())' end;
    execute format('drop policy if exists fos_finme_insert on %I', t);
    execute format('create policy fos_finme_insert on %I as restrictive for insert to authenticated with check (%s)', t, pogoj);
    execute format('drop policy if exists fos_finme_update on %I', t);
    execute format('create policy fos_finme_update on %I as restrictive for update to authenticated using (%s)', t, pogoj);
  end loop;
end;
$$;

-- postavke zahtevkov: vidne, če je viden zahtevek
drop policy if exists fos_finme_select on fos_zahtevki_postavke;
create policy fos_finme_select on fos_zahtevki_postavke as restrictive for select to authenticated
  using ((select fos_ureja_fin_os()) or exists (select 1 from fos_zahtevki z where z.id = id_zahtevka and z.id_zaposlenega = any ((select fos_moji_vidni())::bigint[])));

-- zaposleni: jaz, ekipa in moj vodja; pisanje samo Admin
drop policy if exists fos_finme_select on fos_zaposleni;
create policy fos_finme_select on fos_zaposleni as restrictive for select to authenticated
  using ((select fos_ureja_fin_os()) or id = any ((select fos_moji_vidni())::bigint[]) or id = (select fos_moj_vodja()) or id_uporabnika = auth.uid());
drop policy if exists fos_finme_insert on fos_zaposleni;
create policy fos_finme_insert on fos_zaposleni as restrictive for insert to authenticated with check ((select fos_ureja_fin_os()));
drop policy if exists fos_finme_update on fos_zaposleni;
create policy fos_finme_update on fos_zaposleni as restrictive for update to authenticated using ((select fos_ureja_fin_os()));

-- Preverjanje (kot prijavljen zaposleni v aplikaciji: vidi samo sebe in ekipo)
select 'fos_zahtevki' as tabela, count(*) from fos_zahtevki where visible
union all select 'fos_dopust_leta', count(*) from fos_dopust_leta where visible
union all select 'statistike z lastnostjo celodnevna_odsotnost', count(*)
  from ln_fos_statistike_lastnosti x join fos_lastnosti l on l.id = x.id_lastnosti and l.koda = 'celodnevna_odsotnost' where x.visible;
