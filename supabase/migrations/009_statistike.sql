-- =====================================================================
-- FIN:OS | 009: statistike registracije časa (Registracija časa -> Nastavitve -> Statistike)
--
-- fos_lastnosti                kvadratki pri statistiki ("Štej v delovno obveznost" ...). Šifrant: nov kvadratek =
--                              nova vrstica. Izračuni se sklicujejo na koda (npr. 'malice').
-- fos_statistike               v katero statistiko gre čas (DELO, DOM, BOL ...): koda, ime, opis, barva, ikona.
--                              Statistika se poračuna, ko je interval končan (prihod + izhod).
-- ln_fos_statistike_lastnosti  kateri kvadratki so vklopljeni pri statistiki (skrit zapis = izklopljen).
--
-- Potrjeno 31. 10. 2026 (imena tabel, začetne statistike). Zaženi PO 008_funkcije.sql. Idempotentno.
-- =====================================================================

create table if not exists fos_lastnosti (
  id          bigint generated always as identity primary key,
  koda        text not null unique check (koda ~ '^[a-z0-9_]+$'),
  ime         text not null,
  opis        text not null default '',
  vrstni_red  integer not null default 0,
  visible     boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

insert into fos_lastnosti (koda, ime, opis, vrstni_red) values
  ('delovna_obveznost', 'Štej v delovno obveznost', 'Čas v tej statistiki se šteje kot opravljen delovni čas (kot da si na delu).', 1),
  ('prevozi',           'Štej prevoze',             'Dan s to statistiko prinese povračilo za prevoz na delo (1 na delovni dan v podjetju).', 2),
  ('malice',            'Štej malice',              'Čas v tej statistiki se šteje v ure za malico (nad 4 h 1 malica, nad 12 h 2).', 3),
  ('lanski_dopust',     'Štej lanski dopust',       'Odsotnost se najprej odšteje od lanskega (prenesenega) dopusta.', 4)
on conflict (koda) do nothing;

create table if not exists fos_statistike (
  id          bigint generated always as identity primary key,
  koda        text not null check (koda ~ '^[A-Z0-9_]{1,12}$'),
  ime         text not null,
  opis        text not null default '',
  barva       text not null default '#22c55e' check (barva ~ '^#[0-9a-fA-F]{6}$'),
  ikona       text not null default 'briefcase',          -- ime ikone (IKONE_STATISTIK v src/lib/casNastavitve.ts)
  vrstni_red  integer not null default 0,
  visible     boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
-- koda je enolična med prikazanimi (skrite se ne brišejo, koda se lahko ponovno uporabi)
create unique index if not exists fos_statistike_koda_uq on fos_statistike (koda) where visible;

create table if not exists ln_fos_statistike_lastnosti (
  id             bigint generated always as identity primary key,
  id_statistike  bigint not null references fos_statistike(id),
  id_lastnosti   bigint not null references fos_lastnosti(id),
  visible        boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create unique index if not exists ln_fos_statistike_lastnosti_uq on ln_fos_statistike_lastnosti (id_statistike, id_lastnosti) where visible;

-- začetne statistike (koda, ime, barva, ikona, opis, kvadratki)
with v (koda, ime, barva, ikona, opis, lastnosti, vrstni_red) as (values
  ('DELO', 'Delo po urniku',     '#22c55e', 'briefcase',      'Standardni prihod in odhod na delo v podjetju.',                      '{delovna_obveznost,prevozi,malice}'::text[], 1),
  ('DOM',  'Delo od doma',       '#14b8a6', 'house',          'Delo od doma - štempljanje prek online aplikacije, brez prevoza.',    '{delovna_obveznost,malice}'::text[], 2),
  ('SLP',  'Službena pot',       '#3b82f6', 'plane',          'Službena pot po potnem nalogu.',                                      '{delovna_obveznost,malice}'::text[], 3),
  ('SLO',  'Službena odsotnost', '#8b5cf6', 'building',       'Službeni izhod med delovnim časom (stranka, banka, pošta ...).',      '{delovna_obveznost,prevozi,malice}'::text[], 4),
  ('ZAS',  'Zasebna odsotnost',  '#ef4444', 'door-open',      'Zasebni izhod med delovnim časom - ne šteje v delovni čas.',          '{}'::text[], 5),
  ('MAL',  'Malica',             '#eab308', 'utensils',       'Odmor za malico (plačan, šteje v delovni čas).',                      '{delovna_obveznost,malice}'::text[], 6),
  ('BOL',  'Bolniška',           '#b91c1c', 'thermometer',    'Bolniška odsotnost (nadomestilo plače).',                             '{delovna_obveznost}'::text[], 7),
  ('DOP',  'Redni dopust',       '#0ea5e9', 'tree-palm',      'Letni dopust tekočega leta.',                                         '{delovna_obveznost}'::text[], 8),
  ('LDOP', 'Lanski dopust',      '#38bdf8', 'sun',            'Preneseni dopust iz prejšnjega leta.',                                '{delovna_obveznost,lanski_dopust}'::text[], 9),
  ('IZD',  'Izredni dopust',     '#f59e0b', 'calendar-heart', 'Izredni plačani dopust (poroka, selitev, smrt v družini ...).',       '{delovna_obveznost}'::text[], 10),
  ('POR',  'Porodniški dopust',  '#ec4899', 'baby',           'Porodniški in starševski dopust.',                                    '{}'::text[], 11),
  ('IZS',  'Izredno stanje',     '#f97316', 'siren',          'Izredne razmere (naravna nesreča, višja sila).',                      '{delovna_obveznost}'::text[], 12)
),
nove as (
  insert into fos_statistike (koda, ime, barva, ikona, opis, vrstni_red)
  select v.koda, v.ime, v.barva, v.ikona, v.opis, v.vrstni_red from v
  where not exists (select 1 from fos_statistike s where s.koda = v.koda and s.visible)
  returning id, koda
)
insert into ln_fos_statistike_lastnosti (id_statistike, id_lastnosti)
select nove.id, l.id
from nove
join v on v.koda = nove.koda
join fos_lastnosti l on l.koda = any (v.lastnosti);

-- updated_at in RLS: select / insert / update za prijavljene, brez delete
do $$
declare
  t text;
begin
  foreach t in array array['fos_lastnosti', 'fos_statistike', 'ln_fos_statistike_lastnosti'] loop
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

-- Preverjanje
select s.koda, s.ime, array_agg(l.koda order by l.vrstni_red) filter (where l.id is not null) as kvadratki
from fos_statistike s
left join ln_fos_statistike_lastnosti sl on sl.id_statistike = s.id and sl.visible
left join fos_lastnosti l on l.id = sl.id_lastnosti
where s.visible
group by s.id, s.koda, s.ime, s.vrstni_red
order by s.vrstni_red;
