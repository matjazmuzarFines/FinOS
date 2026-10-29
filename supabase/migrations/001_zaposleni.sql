-- =====================================================================
-- FIN:OS | 001: zaposleni in oddelki
-- Predpona tabel: fos_  (povezovalne tabele: ln_fos_...)
-- Pravilo: podatkov ne brišemo -> visible = true/false
--
-- fos_oddelek    šifrant oddelkov (napolnjen spodaj)
-- fos_zaposleni  zaposleni: ime, priimek, številka kartice, oddelek
--                (vodja zaposlenega: 002_vodje.sql)
--
-- Zaženi v Supabase -> SQL Editor. Idempotentno (lahko se zažene večkrat).
-- Dostop samo za prijavljene (RLS: authenticated).
-- =====================================================================

-- Skupna funkcija: posodobi updated_at
create or replace function fos_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- Oddelki
-- ---------------------------------------------------------------------
create table if not exists fos_oddelek (
  id           bigint generated always as identity primary key,
  ime_oddelka  text not null unique,
  visible      boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

drop trigger if exists fos_oddelek_updated_at on fos_oddelek;
create trigger fos_oddelek_updated_at
  before update on fos_oddelek for each row execute function fos_set_updated_at();

insert into fos_oddelek (ime_oddelka) values
  ('Uprava'),
  ('Proizvodnja'),
  ('Montaža'),
  ('Razvoj'),
  ('Servis'),
  ('Skladišče'),
  ('Tehnična pomoč')
on conflict (ime_oddelka) do nothing;

-- ---------------------------------------------------------------------
-- Zaposleni
-- ---------------------------------------------------------------------
create table if not exists fos_zaposleni (
  id          bigint generated always as identity primary key,
  ime         text not null,
  priimek     text not null,
  st_kartice  text,                                    -- besedilo: kartica ima lahko vodilne ničle
  id_oddelek  bigint references fos_oddelek(id),
  visible     boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Ena kartica = en aktiven zaposleni (skrit zaposleni kartico sprosti)
create unique index if not exists fos_zaposleni_kartica_uq
  on fos_zaposleni (st_kartice) where visible and st_kartice is not null;
create index if not exists fos_zaposleni_oddelek_idx on fos_zaposleni (id_oddelek);

drop trigger if exists fos_zaposleni_updated_at on fos_zaposleni;
create trigger fos_zaposleni_updated_at
  before update on fos_zaposleni for each row execute function fos_set_updated_at();

-- ---------------------------------------------------------------------
-- Dostop: samo prijavljeni (brez delete - podatkov ne brišemo)
-- ---------------------------------------------------------------------
alter table fos_oddelek enable row level security;
drop policy if exists fos_oddelek_select on fos_oddelek;
drop policy if exists fos_oddelek_insert on fos_oddelek;
drop policy if exists fos_oddelek_update on fos_oddelek;
create policy fos_oddelek_select on fos_oddelek for select to authenticated using (true);
create policy fos_oddelek_insert on fos_oddelek for insert to authenticated with check (true);
create policy fos_oddelek_update on fos_oddelek for update to authenticated using (true) with check (true);

alter table fos_zaposleni enable row level security;
drop policy if exists fos_zaposleni_select on fos_zaposleni;
drop policy if exists fos_zaposleni_insert on fos_zaposleni;
drop policy if exists fos_zaposleni_update on fos_zaposleni;
create policy fos_zaposleni_select on fos_zaposleni for select to authenticated using (true);
create policy fos_zaposleni_insert on fos_zaposleni for insert to authenticated with check (true);
create policy fos_zaposleni_update on fos_zaposleni for update to authenticated using (true) with check (true);
