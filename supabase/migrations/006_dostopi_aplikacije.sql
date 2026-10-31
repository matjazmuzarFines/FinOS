-- =====================================================================
-- FIN:OS | 006: dostop zaposlenih do aplikacij (zaposleni -> Dostopi)
--
-- Vse Fines aplikacije so v istem Supabase projektu in njihove politike dovolijo vse vlogi "authenticated".
-- Zato: račun, ki je povezan z zaposlenim (fos_zaposleni.id_uporabnika), vidi samo aplikacije,
-- ki so mu v FIN:OS (zaposleni -> Dostopi) vklopljene. FIN:OS sam (fos_ tabele) = samo Super Admin.
-- Računi, ki niso povezani z zaposlenim (npr. fines@fines.si), delajo kot prej.
--
-- fos_aplikacije               aplikacije: ime, predpone tabel (npr. {fp_, spl_}), košare za datoteke
-- ln_fos_zaposleni_aplikacije  kateri zaposleni sme v katero aplikacijo (skrit zapis = brez dostopa)
-- fos_ima_dostop(ime)          ali sme prijavljen uporabnik do tabele / košare s tem imenom
-- fos_zasciti_tabelo(tabela)   doda omejevalno (restrictive) politiko fos_dostop - obstoječih politik ne spreminja
-- dogodek fos_nova_tabela      VSAKA NOVA tabela v public dobi politiko sama - migracije ni treba ponavljati
--
-- Nova aplikacija = nova vrstica v fos_aplikacije (predpone, košare). Tabela, ki ne spada v nobeno
-- aplikacijo, je za račune zaposlenih zaprta (varna privzeta izbira).
-- Zaženi PO 005_super_admin.sql. Idempotentno (pobriše tudi prejšnjo različico 006: fos_finme_omejitev).
-- =====================================================================

-- ---------------------------------------------------------------------
-- Aplikacije
-- ---------------------------------------------------------------------
create table if not exists fos_aplikacije (
  id          bigint generated always as identity primary key,
  koda        text not null unique,
  ime         text not null,
  opis        text,
  predpone    text[] not null default '{}',
  kosare      text[] not null default '{}',
  vrstni_red  integer not null default 0,
  visible     boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

drop trigger if exists fos_aplikacije_updated_at on fos_aplikacije;
create trigger fos_aplikacije_updated_at
  before update on fos_aplikacije for each row execute function fos_set_updated_at();

insert into fos_aplikacije (koda, ime, opis, predpone, kosare, vrstni_red) values
  ('fp', 'Fines - Production', 'Proizvodnja, skladišče, planiranje, rutine', '{fp_,spl_}', '{fp-rutina-slike}', 1),
  ('kp', 'Kontrolne točke', 'Kontrolni postopki in kontrolne točke', '{kp_}', '{}', 2),
  ('rbo', 'Rabljena oprema', 'Evidenca rabljene opreme', '{rbo_}', '{Slike_rabljena_oprema}', 3)
on conflict (koda) do nothing;

create table if not exists ln_fos_zaposleni_aplikacije (
  id              bigint generated always as identity primary key,
  id_zaposlenega  bigint not null references fos_zaposleni(id),
  id_aplikacije   bigint not null references fos_aplikacije(id),
  visible         boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create unique index if not exists ln_fos_zaposleni_aplikacije_uq
  on ln_fos_zaposleni_aplikacije (id_zaposlenega, id_aplikacije) where visible;

drop trigger if exists ln_fos_zaposleni_aplikacije_updated_at on ln_fos_zaposleni_aplikacije;
create trigger ln_fos_zaposleni_aplikacije_updated_at
  before update on ln_fos_zaposleni_aplikacije for each row execute function fos_set_updated_at();

alter table fos_aplikacije enable row level security;
drop policy if exists fos_aplikacije_select on fos_aplikacije;
drop policy if exists fos_aplikacije_insert on fos_aplikacije;
drop policy if exists fos_aplikacije_update on fos_aplikacije;
create policy fos_aplikacije_select on fos_aplikacije for select to authenticated using (true);
create policy fos_aplikacije_insert on fos_aplikacije for insert to authenticated with check (true);
create policy fos_aplikacije_update on fos_aplikacije for update to authenticated using (true) with check (true);

alter table ln_fos_zaposleni_aplikacije enable row level security;
drop policy if exists ln_fos_zaposleni_aplikacije_select on ln_fos_zaposleni_aplikacije;
drop policy if exists ln_fos_zaposleni_aplikacije_insert on ln_fos_zaposleni_aplikacije;
drop policy if exists ln_fos_zaposleni_aplikacije_update on ln_fos_zaposleni_aplikacije;
create policy ln_fos_zaposleni_aplikacije_select on ln_fos_zaposleni_aplikacije for select to authenticated using (true);
create policy ln_fos_zaposleni_aplikacije_insert on ln_fos_zaposleni_aplikacije for insert to authenticated with check (true);
create policy ln_fos_zaposleni_aplikacije_update on ln_fos_zaposleni_aplikacije for update to authenticated using (true) with check (true);

-- ---------------------------------------------------------------------
-- Preverjanje dostopa
-- ---------------------------------------------------------------------
-- p_ime = ime tabele (npr. fp_nalogi) ali košare (npr. fp-rutina-slike)
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
  -- zaposleni, povezan s prijavljenim računom (tudi skrit - skrit zaposleni nima dostopa)
  select id, visible into z
  from fos_zaposleni where id_uporabnika = auth.uid()
  order by visible desc limit 1;

  if not found then
    return true;  -- račun ni zaposleni (npr. fines@fines.si) - kot prej
  end if;
  if not z.visible then
    return false;
  end if;
  if starts_with(p_ime, 'fos_') or starts_with(p_ime, 'ln_fos_') then
    return fos_je_super_admin();  -- FIN:OS Administracija (005 / 008 funkcije; FIN:ME bo dobil pravice za lastne podatke)
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

revoke all on function fos_ima_dostop(text) from public, anon;
grant execute on function fos_ima_dostop(text) to authenticated;

-- Omejevalna politika na tabeli (velja skupaj z obstoječimi; brez RLS na tabeli ne učinkuje)
create or replace function fos_zasciti_tabelo(p_tabela regclass)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  ime text;
begin
  select relname into ime from pg_class where oid = p_tabela;
  execute format('drop policy if exists fos_finme_omejitev on %s', p_tabela);  -- prejšnja različica 006
  execute format('drop policy if exists fos_dostop on %s', p_tabela);
  execute format(
    'create policy fos_dostop on %s as restrictive for all to authenticated '
    'using ((select fos_ima_dostop(%L))) with check ((select fos_ima_dostop(%L)))',
    p_tabela, ime, ime);
end;
$$;

revoke all on function fos_zasciti_tabelo(regclass) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Vse obstoječe tabele v public
-- ---------------------------------------------------------------------
do $$
declare
  t record;
  brez_rls text := '';
begin
  for t in
    select c.oid, c.relname, c.relrowsecurity
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p')
  loop
    begin
      perform fos_zasciti_tabelo(t.oid::regclass);
    exception when others then
      raise notice 'Tabela % ni zaščitena: %', t.relname, sqlerrm;
    end;
    if not t.relrowsecurity then
      brez_rls := brez_rls || ' ' || t.relname;
    end if;
  end loop;
  if brez_rls <> '' then
    raise notice 'Tabele BREZ RLS (odprte vsem, tudi brez prijave - vklopi RLS):%', brez_rls;
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- Nove tabele: politiko dobijo same ob CREATE TABLE
-- ---------------------------------------------------------------------
create or replace function fos_ob_novi_tabeli()
returns event_trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  o record;
begin
  for o in
    select objid from pg_event_trigger_ddl_commands()
    where command_tag = 'CREATE TABLE' and schema_name = 'public' and object_type = 'table'
  loop
    begin
      perform fos_zasciti_tabelo(o.objid::regclass);
    exception when others then
      -- ustvarjanje tabele se nikoli ne ustavi zaradi zaščite
      raise notice 'FIN:OS: nova tabela ni zaščitena (%): zaženi 006 ali fos_zasciti_tabelo.', sqlerrm;
    end;
  end loop;
end;
$$;

do $$
begin
  drop event trigger if exists fos_nova_tabela;
  create event trigger fos_nova_tabela on ddl_command_end
    when tag in ('CREATE TABLE')
    execute function fos_ob_novi_tabeli();
exception when insufficient_privilege then
  raise notice 'Dogodka fos_nova_tabela ni bilo mogoče ustvariti (pravice) - nove tabele zaščiti z: select fos_zasciti_tabelo(''ime_tabele'');';
end;
$$;

-- ---------------------------------------------------------------------
-- Datoteke (storage): košare aplikacij iz fos_aplikacije.kosare
-- ---------------------------------------------------------------------
do $$
begin
  drop policy if exists fos_finme_omejitev on storage.objects;
  drop policy if exists fos_dostop on storage.objects;
  create policy fos_dostop on storage.objects as restrictive for all to authenticated
    using (public.fos_ima_dostop(bucket_id)) with check (public.fos_ima_dostop(bucket_id));
exception when insufficient_privilege then
  raise notice 'storage.objects: ni pravic za politiko - dodaj jo ročno (Storage -> Policies).';
end;
$$;

-- prejšnja različica 006 (če je bila zagnana)
do $$
begin
  drop function if exists fos_samo_finme();
exception when dependent_objects_still_exist then
  raise notice 'fos_samo_finme še uporablja kakšna politika fos_finme_omejitev - preveri pg_policies.';
end;
$$;
