-- =====================================================================
-- FIN:OS | 012: saldo ur zaposlenega (Registracija časa -> okno Saldo, Povzetek)
--
-- Saldo ur zaposlenega (Registracija časa, desno):
--   stanje na koncu obdobja = prenos iz prejšnjega obdobja + saldo obdobja - prenos v izplačilo (mesec)
--   prenos iz prejšnjega obdobja = začetno stanje + dnevni saldi od datuma začetnega stanja - izplačila preteklih mesecev
--
-- fos_saldo_zacetno  = saldo, ki ga je imel zaposleni pred začetkom FIN:OS (EN viden zapis na zaposlenega; ob spremembi
--                      se star skrije -> zgodovina). datum = od tega dne naprej se štejejo dnevni saldi.
-- fos_saldo_meseci   = na zaposlenega in mesec: koliko ur gre v izplačilo in mesečni zaznamki (en viden zapis na mesec).
-- Piše se samo prek fos_nastavi_zacetni_saldo in fos_nastavi_mesec_salda.
--
-- Zaženi PO 001_zaposleni.sql. Idempotentno.
-- =====================================================================

create table if not exists fos_saldo_zacetno (
  id              bigint generated always as identity primary key,
  id_zaposlenega  bigint not null references fos_zaposleni(id),
  saldo_min       integer not null default 0,              -- lahko negativen (manjko)
  datum           date not null,                           -- stanje na začetku tega dne
  visible         boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create unique index if not exists fos_saldo_zacetno_uq on fos_saldo_zacetno (id_zaposlenega) where visible;

create table if not exists fos_saldo_meseci (
  id              bigint generated always as identity primary key,
  id_zaposlenega  bigint not null references fos_zaposleni(id),
  mesec           date not null check (extract(day from mesec) = 1),   -- prvi dan meseca
  izplacilo_min   integer not null default 0 check (izplacilo_min >= 0),
  zaznamki        text not null default '',
  visible         boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create unique index if not exists fos_saldo_meseci_uq on fos_saldo_meseci (id_zaposlenega, mesec) where visible;

do $$
declare
  t text;
begin
  foreach t in array array['fos_saldo_zacetno', 'fos_saldo_meseci'] loop
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

-- Začetno stanje: star zapis se skrije, nov se doda. p_datum null = brez začetnega stanja.
create or replace function fos_nastavi_zacetni_saldo(p_id_zaposlenega bigint, p_saldo_min integer, p_datum date)
returns void
language plpgsql
security invoker
as $$
begin
  if exists (select 1 from fos_saldo_zacetno where id_zaposlenega = p_id_zaposlenega and visible and saldo_min = p_saldo_min and datum = p_datum) then
    return;
  end if;
  update fos_saldo_zacetno set visible = false where id_zaposlenega = p_id_zaposlenega and visible;
  if p_datum is not null then
    insert into fos_saldo_zacetno (id_zaposlenega, saldo_min, datum) values (p_id_zaposlenega, p_saldo_min, p_datum);
  end if;
end;
$$;

-- Mesec salda: izplačilo in zaznamki; star zapis se skrije (zgodovina sprememb).
create or replace function fos_nastavi_mesec_salda(p_id_zaposlenega bigint, p_mesec date, p_izplacilo_min integer, p_zaznamki text)
returns void
language plpgsql
security invoker
as $$
begin
  if exists (select 1 from fos_saldo_meseci where id_zaposlenega = p_id_zaposlenega and mesec = p_mesec and visible
             and izplacilo_min = p_izplacilo_min and zaznamki = coalesce(p_zaznamki, '')) then
    return;
  end if;
  update fos_saldo_meseci set visible = false where id_zaposlenega = p_id_zaposlenega and mesec = p_mesec and visible;
  insert into fos_saldo_meseci (id_zaposlenega, mesec, izplacilo_min, zaznamki) values (p_id_zaposlenega, p_mesec, p_izplacilo_min, coalesce(p_zaznamki, ''));
end;
$$;

grant execute on function fos_nastavi_zacetni_saldo(bigint, integer, date) to authenticated;
grant execute on function fos_nastavi_mesec_salda(bigint, date, integer, text) to authenticated;

-- Preverjanje
select 'fos_saldo_zacetno' as tabela, count(*) from fos_saldo_zacetno where visible
union all select 'fos_saldo_meseci', count(*) from fos_saldo_meseci where visible;
