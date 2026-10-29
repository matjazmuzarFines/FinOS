-- =====================================================================
-- FIN:OS | 002: vodje in povezava zaposleni -> vodja
--
-- fos_vodje               zaposleni, ki so vodje (id_zaposlenega; skrit vodja = visible false)
-- ln_fos_zaposleni_vodja  kdo je vodja posameznemu zaposlenemu
--                         en VIDEN zapis na zaposlenega = trenutni vodja; ob menjavi se star zapis
--                         skrije (visible = false) in doda nov -> zgodovina vodij ostane
--
-- Funkcije (kliče jih aplikacija):
--   fos_nastavi_vodjo(id_zaposlenega, id_vodja)     id_vodja = fos_vodje.id ali null (brez vodje)
--   fos_nastavi_je_vodja(id_zaposlenega, je_vodja)  doda / skrije zaposlenega med vodjami
--
-- Če je bila 001 zagnana s stolpcem fos_zaposleni.id_vodja, se vodje prenesejo sem in stolpec odstrani
-- (en vir podatka o vodji). Zaženi PO 001_zaposleni.sql. Idempotentno. Dostop samo za prijavljene.
-- =====================================================================

create table if not exists fos_vodje (
  id              bigint generated always as identity primary key,
  id_zaposlenega  bigint not null unique references fos_zaposleni(id),
  visible         boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

drop trigger if exists fos_vodje_updated_at on fos_vodje;
create trigger fos_vodje_updated_at
  before update on fos_vodje for each row execute function fos_set_updated_at();

create table if not exists ln_fos_zaposleni_vodja (
  id              bigint generated always as identity primary key,
  id_zaposlenega  bigint not null references fos_zaposleni(id),
  id_vodja        bigint not null references fos_vodje(id),
  visible         boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- en trenuten vodja na zaposlenega
create unique index if not exists ln_fos_zaposleni_vodja_aktiven_uq
  on ln_fos_zaposleni_vodja (id_zaposlenega) where visible;
create index if not exists ln_fos_zaposleni_vodja_vodja_idx on ln_fos_zaposleni_vodja (id_vodja);

drop trigger if exists ln_fos_zaposleni_vodja_updated_at on ln_fos_zaposleni_vodja;
create trigger ln_fos_zaposleni_vodja_updated_at
  before update on ln_fos_zaposleni_vodja for each row execute function fos_set_updated_at();

-- ---------------------------------------------------------------------
-- Prenos iz starega stolpca fos_zaposleni.id_vodja (samo, če obstaja)
-- ---------------------------------------------------------------------
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'fos_zaposleni' and column_name = 'id_vodja'
  ) then
    execute $q$
      insert into fos_vodje (id_zaposlenega)
      select distinct id_vodja from fos_zaposleni where id_vodja is not null
      on conflict (id_zaposlenega) do nothing
    $q$;
    execute $q$
      insert into ln_fos_zaposleni_vodja (id_zaposlenega, id_vodja)
      select z.id, v.id
      from fos_zaposleni z
      join fos_vodje v on v.id_zaposlenega = z.id_vodja
      where not exists (select 1 from ln_fos_zaposleni_vodja l where l.id_zaposlenega = z.id and l.visible)
    $q$;
    alter table fos_zaposleni drop column id_vodja;
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- Funkcije
-- ---------------------------------------------------------------------

-- Določi vodjo zaposlenemu (null = brez vodje). Star zapis se skrije, nov doda.
create or replace function fos_nastavi_vodjo(p_id_zaposlenega bigint, p_id_vodja bigint)
returns void
language plpgsql
security invoker
as $$
begin
  if p_id_vodja is not null and exists (
    select 1 from fos_vodje where id = p_id_vodja and id_zaposlenega = p_id_zaposlenega
  ) then
    raise exception 'Zaposleni ne more biti sam sebi vodja.';
  end if;
  if p_id_vodja is not null and not exists (select 1 from fos_vodje where id = p_id_vodja and visible) then
    raise exception 'Izbran vodja ne obstaja.';
  end if;
  -- brez spremembe
  if exists (
    select 1 from ln_fos_zaposleni_vodja
    where id_zaposlenega = p_id_zaposlenega and visible and id_vodja = p_id_vodja
  ) or (p_id_vodja is null and not exists (
    select 1 from ln_fos_zaposleni_vodja where id_zaposlenega = p_id_zaposlenega and visible
  )) then
    return;
  end if;

  update ln_fos_zaposleni_vodja set visible = false where id_zaposlenega = p_id_zaposlenega and visible;
  if p_id_vodja is not null then
    insert into ln_fos_zaposleni_vodja (id_zaposlenega, id_vodja) values (p_id_zaposlenega, p_id_vodja);
  end if;
end;
$$;

-- Zaposleni je / ni vodja. Vodje s podrejenimi ni mogoče odstraniti. Vrne fos_vodje.id.
create or replace function fos_nastavi_je_vodja(p_id_zaposlenega bigint, p_je_vodja boolean)
returns bigint
language plpgsql
security invoker
as $$
declare
  v_id bigint;
begin
  if not p_je_vodja and exists (
    select 1 from ln_fos_zaposleni_vodja l
    join fos_vodje v on v.id = l.id_vodja
    where v.id_zaposlenega = p_id_zaposlenega and l.visible
  ) then
    raise exception 'Vodja ima še podrejene - najprej jim določi drugega vodjo.';
  end if;
  insert into fos_vodje (id_zaposlenega, visible) values (p_id_zaposlenega, p_je_vodja)
  on conflict (id_zaposlenega) do update set visible = excluded.visible
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function fos_nastavi_vodjo(bigint, bigint) from public, anon;
revoke all on function fos_nastavi_je_vodja(bigint, boolean) from public, anon;
grant execute on function fos_nastavi_vodjo(bigint, bigint) to authenticated;
grant execute on function fos_nastavi_je_vodja(bigint, boolean) to authenticated;

-- ---------------------------------------------------------------------
-- Dostop: samo prijavljeni (brez delete - podatkov ne brišemo)
-- ---------------------------------------------------------------------
alter table fos_vodje enable row level security;
drop policy if exists fos_vodje_select on fos_vodje;
drop policy if exists fos_vodje_insert on fos_vodje;
drop policy if exists fos_vodje_update on fos_vodje;
create policy fos_vodje_select on fos_vodje for select to authenticated using (true);
create policy fos_vodje_insert on fos_vodje for insert to authenticated with check (true);
create policy fos_vodje_update on fos_vodje for update to authenticated using (true) with check (true);

alter table ln_fos_zaposleni_vodja enable row level security;
drop policy if exists ln_fos_zaposleni_vodja_select on ln_fos_zaposleni_vodja;
drop policy if exists ln_fos_zaposleni_vodja_insert on ln_fos_zaposleni_vodja;
drop policy if exists ln_fos_zaposleni_vodja_update on ln_fos_zaposleni_vodja;
create policy ln_fos_zaposleni_vodja_select on ln_fos_zaposleni_vodja for select to authenticated using (true);
create policy ln_fos_zaposleni_vodja_insert on ln_fos_zaposleni_vodja for insert to authenticated with check (true);
create policy ln_fos_zaposleni_vodja_update on ln_fos_zaposleni_vodja for update to authenticated using (true) with check (true);
