-- =====================================================================
-- FIN:OS | 010: urniki, intervali, prazniki, urnik zaposlenega (Registracija časa -> Nastavitve -> Urniki)
--
-- fos_dnevi                 pon-ned (iso_dan 1-7) in prazniki (iso_dan null) - na katere dni velja interval
-- fos_intervali             časovno okno OD-DO (npr. prihod 06:00-09:00) z OBVEZNO eno statistiko: kdor štempla
--                           prihod v oknu, dobi čas od prihoda do izhoda v to statistiko. Poračuna se, ko je
--                           interval končan (prihod + izhod). Brez toleranc. cas_do < cas_od = okno čez polnoč;
--                           delo čez polnoč se VEDNO šteje v dan začetka (prihoda). vrstni_red = povleci in spusti.
--                           ime = glavno ime v seznamih (PRIHOD_PISARNA), prikazno_ime = na krmilniku (Prihod).
-- ln_fos_intervali_dnevi    dnevi intervala
-- fos_urniki                urnik (brez dodatnih skupin - zaposleni se veže neposredno na urnik); vrstni_red = povleci in spusti
-- ln_fos_urniki_intervali   interval je lahko v več urnikih
-- ln_fos_zaposleni_urniki   urnik zaposlenega: EN viden zapis na zaposlenega; ob menjavi se star skrije (zgodovina,
--                           velja_od = od kdaj). Piše se prek fos_nastavi_urnik(id_zaposlenega, id_urnika).
-- fos_prazniki              POSEBNI dela prosti dnevi (npr. dan solidarnosti). Standardne po zakonu (tudi velika
--                           noč, binkošti) izračuna aplikacija (src/lib/prazniki.ts).
--
-- Štempljanja pridejo kasneje (svoja baza): dogodek nima tipa ne statistike, samo vir (Krmilnik, Ročni popravek,
-- Online aplikacija). Zaženi PO 009_statistike.sql. Idempotentno.
-- =====================================================================

create table if not exists fos_dnevi (
  id          bigint generated always as identity primary key,
  koda        text not null unique,
  ime         text not null,
  kratko      text not null,
  iso_dan     smallint unique check (iso_dan between 1 and 7),
  vrstni_red  integer not null default 0,
  visible     boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

insert into fos_dnevi (koda, ime, kratko, iso_dan, vrstni_red) values
  ('pon', 'Ponedeljek', 'Pon', 1, 1), ('tor', 'Torek', 'Tor', 2, 2), ('sre', 'Sreda', 'Sre', 3, 3),
  ('cet', 'Četrtek', 'Čet', 4, 4), ('pet', 'Petek', 'Pet', 5, 5), ('sob', 'Sobota', 'Sob', 6, 6),
  ('ned', 'Nedelja', 'Ned', 7, 7), ('praznik', 'Prazniki', 'Praz', null, 8)
on conflict (koda) do nothing;

create table if not exists fos_intervali (
  id             bigint generated always as identity primary key,
  ime            text not null,
  prikazno_ime   text not null default '',
  opis           text not null default '',
  cas_od         time not null,
  cas_do         time not null,
  velja_od       date,                                -- null = od vedno
  velja_do       date,                                -- null = brez konca
  id_statistike  bigint not null references fos_statistike(id),
  vrstni_red     integer not null default 0,
  visible        boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint fos_intervali_cas check (cas_do <> cas_od),
  constraint fos_intervali_veljavnost check (velja_do is null or velja_od is null or velja_do >= velja_od)
);
create unique index if not exists fos_intervali_ime_uq on fos_intervali (lower(ime)) where visible;

create table if not exists ln_fos_intervali_dnevi (
  id            bigint generated always as identity primary key,
  id_intervala  bigint not null references fos_intervali(id),
  id_dneva      bigint not null references fos_dnevi(id),
  visible       boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create unique index if not exists ln_fos_intervali_dnevi_uq on ln_fos_intervali_dnevi (id_intervala, id_dneva) where visible;

create table if not exists fos_urniki (
  id          bigint generated always as identity primary key,
  ime         text not null,
  opis        text not null default '',
  visible     boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create unique index if not exists fos_urniki_ime_uq on fos_urniki (lower(ime)) where visible;
-- vrstni red v seznamu urnikov (povleci in spusti); dodano naknadno - deluje tudi na že zagnani 010
alter table fos_urniki add column if not exists vrstni_red integer not null default 0;

create table if not exists ln_fos_urniki_intervali (
  id            bigint generated always as identity primary key,
  id_urnika     bigint not null references fos_urniki(id),
  id_intervala  bigint not null references fos_intervali(id),
  visible       boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create unique index if not exists ln_fos_urniki_intervali_uq on ln_fos_urniki_intervali (id_urnika, id_intervala) where visible;

create table if not exists ln_fos_zaposleni_urniki (
  id              bigint generated always as identity primary key,
  id_zaposlenega  bigint not null references fos_zaposleni(id),
  id_urnika       bigint not null references fos_urniki(id),
  velja_od        date not null default current_date,
  visible         boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
-- en viden (trenuten) urnik na zaposlenega
create unique index if not exists ln_fos_zaposleni_urniki_uq on ln_fos_zaposleni_urniki (id_zaposlenega) where visible;

create table if not exists fos_prazniki (
  id          bigint generated always as identity primary key,
  datum       date not null,
  ime         text not null,
  opis        text not null default '',
  visible     boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create unique index if not exists fos_prazniki_datum_uq on fos_prazniki (datum) where visible;

insert into fos_prazniki (datum, ime, opis)
select '2023-08-14', 'Dan solidarnosti', 'Enkraten dela prost dan po poplavah.'
where not exists (select 1 from fos_prazniki where datum = '2023-08-14' and visible);

-- updated_at in RLS: select / insert / update za prijavljene, brez delete
do $$
declare
  t text;
begin
  foreach t in array array[
    'fos_dnevi', 'fos_intervali', 'ln_fos_intervali_dnevi', 'fos_urniki',
    'ln_fos_urniki_intervali', 'ln_fos_zaposleni_urniki', 'fos_prazniki'
  ] loop
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
  end loop;
end;
$$;

-- Urnik zaposlenega: star zapis se skrije (zgodovina), nov velja od danes. p_id_urnika null = brez urnika.
create or replace function fos_nastavi_urnik(p_id_zaposlenega bigint, p_id_urnika bigint)
returns void
language plpgsql
security invoker
as $$
begin
  if p_id_urnika is not null and not exists (select 1 from fos_urniki where id = p_id_urnika and visible) then
    raise exception 'Izbran urnik ne obstaja.';
  end if;
  if exists (select 1 from ln_fos_zaposleni_urniki where id_zaposlenega = p_id_zaposlenega and visible and id_urnika is not distinct from p_id_urnika) then
    return; -- brez spremembe
  end if;
  update ln_fos_zaposleni_urniki set visible = false where id_zaposlenega = p_id_zaposlenega and visible;
  if p_id_urnika is not null then
    insert into ln_fos_zaposleni_urniki (id_zaposlenega, id_urnika) values (p_id_zaposlenega, p_id_urnika);
  end if;
end;
$$;

grant execute on function fos_nastavi_urnik(bigint, bigint) to authenticated;

-- Preverjanje
select 'fos_dnevi' as tabela, count(*) from fos_dnevi where visible
union all select 'fos_prazniki', count(*) from fos_prazniki where visible
union all select 'fos_urniki', count(*) from fos_urniki where visible
union all select 'fos_intervali', count(*) from fos_intervali where visible;
