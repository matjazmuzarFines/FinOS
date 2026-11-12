-- =====================================================================
-- FIN:OS | 023: FIN:TV - predefinirane komponente (viri iz drugih projektov) in njihove objave
-- POTRJENO 2026-11-12 - zaženi v Supabase -> SQL Editor (po 022).
--
-- fos_tv_viri     katalog komponent, ki jih PROGRAMIRAMO v projektih (npr. Production: "Delovni plan - workflow",
--                 "Delovni plan - pregled"). Vrstico doda migracija projekta skupaj s kodo izvoza - v FIN:TV se ne
--                 ustvarja ročno. Komponenta = dokument (PDF), ki ga projekt ustvari ob gumbu (npr. Shrani plan).
--                 `aplikacija` = koda v fos_aplikacije: objaviti sme, kdor ima dostop do te aplikacije.
--                 `vklopljen` = stikalo "na TV" (izklopljena komponenta se na TV-jih preskoči, objava se ne vpraša).
-- fos_tv_objave   vsaka objava: strani kot slike (WebP 3840 px, kot PDF v FIN:TV), razmerja strani (višina / širina -
--                 pokončne strani se na TV-ju razrežejo), kdo, iz katerega gumba. Zadnja objava = kar kažejo TV-ji;
--                 starejše ostanejo (zgodovina, "prejšnje stanje" v TV statusu projekta).
-- fos_tv_okna     + id_vira, vrsta 'vir': okno v seznamu predvajanja, ki kaže zadnjo objavo komponente.
--
-- Datoteke objav: košara fos-tv-viri (dostop prek aplikacije projekta - npr. Production; FIN:TV jo samo bere).
-- Objava SAMO prek fos_tv_objavi (security definer): preveri dostop do aplikacije komponente.
--
-- Zaženi PO 022. Idempotentno.
-- =====================================================================

create table if not exists fos_tv_viri (
  id          bigint generated always as identity primary key,
  koda        text not null unique check (koda ~ '^[a-z0-9_]+$'),   -- npr. fp_plan_pregled
  ime         text not null,
  opis        text not null default '',
  aplikacija  text not null references fos_aplikacije(koda),      -- npr. 'fp' (Production)
  ikona       text not null default 'FileText',                   -- ikona lucide v FIN:TV
  vklopljen   boolean not null default true,
  vrstni_red  integer not null default 0,
  visible     boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists fos_tv_objave (
  id          bigint generated always as identity primary key,
  id_vira     bigint not null references fos_tv_viri(id),
  kosara      text not null default 'fos-tv-viri',
  strani      text[] not null,
  razmerja    numeric[] not null default '{}',   -- višina / širina vsake strani (A4 pokončno 1.414, ležeče 0.707)
  izvor       text not null default '',          -- npr. "Production: Shrani plan · Montaža"
  id_objavil  uuid default auth.uid(),
  visible     boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists fos_tv_objave_vir_ix on fos_tv_objave (id_vira, id desc);

do $$
declare t text;
begin
  foreach t in array array['fos_tv_viri', 'fos_tv_objave'] loop
    execute format('drop trigger if exists %1$s_updated_at on %1$s', t);
    execute format('create trigger %1$s_updated_at before update on %1$s for each row execute function fos_set_updated_at()', t);
    execute format('alter table %s enable row level security', t);
    execute format('drop policy if exists %1$s_select on %1$s', t);
    execute format('create policy %1$s_select on %1$s for select to authenticated using (true)', t);
    perform fos_zasciti_tabelo(t::regclass);
  end loop;
end;
$$;
-- viri: Administracija sme samo vklop / izklop in vrstni red; objave piše samo fos_tv_objavi
revoke all on fos_tv_viri, fos_tv_objave from anon, authenticated;
grant select on fos_tv_viri, fos_tv_objave to authenticated;
grant update (vklopljen, vrstni_red) on fos_tv_viri to authenticated;
drop policy if exists fos_tv_viri_update on fos_tv_viri;
create policy fos_tv_viri_update on fos_tv_viri for update to authenticated using (true) with check (true);

-- zadnja objava vsake komponente
create or replace view fos_tv_zadnje_objave with (security_invoker = true) as
  select distinct on (id_vira) id, id_vira, kosara, strani, razmerja, izvor, id_objavil, created_at
  from fos_tv_objave where visible
  order by id_vira, id desc;
grant select on fos_tv_zadnje_objave to authenticated;

-- okno z rezultatom komponente
alter table fos_tv_okna add column if not exists id_vira bigint references fos_tv_viri(id);
alter table fos_tv_okna drop constraint if exists fos_tv_okna_vrsta_check;
alter table fos_tv_okna add constraint fos_tv_okna_vrsta_check check (vrsta in ('slika', 'video', 'pdf', 'obvestilo', 'vir'));

-- ---------------------------------------------------------------------
-- Objava (kliče projekt ob gumbu, npr. Production -> Shrani plan)
-- ---------------------------------------------------------------------
-- Dostop do aplikacije komponente: račun brez zaposlenega, Super Admin ali vklopljena aplikacija (kot fos_ima_dostop).
create or replace function fos_tv_sme_objaviti(p_aplikacija text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select fos_ureja_fin_os() or exists (
    select 1 from ln_fos_zaposleni_aplikacije l
    join fos_aplikacije a on a.id = l.id_aplikacije and a.visible
    where l.visible and a.koda = p_aplikacija and l.id_zaposlenega = fos_moj_zaposleni()
  );
$$;

-- Vrne id objave; izklopljena komponenta = null (nič se ne objavi).
create or replace function fos_tv_objavi(p_koda text, p_strani text[], p_razmerja numeric[], p_izvor text)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v fos_tv_viri;
  nov bigint;
begin
  select * into v from fos_tv_viri where koda = p_koda and visible;
  if not found then raise exception 'Komponente % ni (fos_tv_viri).', p_koda; end if;
  if not fos_tv_sme_objaviti(v.aplikacija) then raise exception 'Za objavo na TV nimaš dostopa do aplikacije %.', v.aplikacija; end if;
  if not v.vklopljen then return null; end if;
  if coalesce(array_length(p_strani, 1), 0) = 0 then raise exception 'Objava nima strani.'; end if;
  insert into fos_tv_objave (id_vira, strani, razmerja, izvor) values (v.id, p_strani, coalesce(p_razmerja, '{}'), coalesce(p_izvor, ''))
  returning id into nov;
  -- TV-ji zaznajo spremembo po updated_at oken s to komponento (verzija v /api/tv)
  update fos_tv_okna set updated_at = now() where id_vira = v.id and visible;
  return nov;
end;
$$;

-- Vklop / izklop komponente iz projekta (stikalo v TV statusu).
create or replace function fos_tv_vklop_vira(p_koda text, p_vklop boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v fos_tv_viri;
begin
  select * into v from fos_tv_viri where koda = p_koda and visible;
  if not found then raise exception 'Komponente % ni.', p_koda; end if;
  if not fos_tv_sme_objaviti(v.aplikacija) then raise exception 'Nimaš dostopa do aplikacije %.', v.aplikacija; end if;
  update fos_tv_viri set vklopljen = p_vklop where id = v.id;
  update fos_tv_okna set updated_at = now() where id_vira = v.id and visible;
end;
$$;

revoke all on function fos_tv_sme_objaviti(text) from public, anon;
revoke all on function fos_tv_objavi(text, text[], numeric[], text) from public, anon;
revoke all on function fos_tv_vklop_vira(text, boolean) from public, anon;
grant execute on function fos_tv_sme_objaviti(text) to authenticated;
grant execute on function fos_tv_objavi(text, text[], numeric[], text) to authenticated;
grant execute on function fos_tv_vklop_vira(text, boolean) to authenticated;

-- ---------------------------------------------------------------------
-- Datoteke objav: košara fos-tv-viri; dostop ima aplikacija Production (fos_dostop na storage.objects)
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit) values ('fos-tv-viri', 'fos-tv-viri', false, 52428800)
on conflict (id) do nothing;
drop policy if exists fos_tv_viri_datoteke_select on storage.objects;
create policy fos_tv_viri_datoteke_select on storage.objects for select to authenticated using (bucket_id = 'fos-tv-viri');
drop policy if exists fos_tv_viri_datoteke_insert on storage.objects;
create policy fos_tv_viri_datoteke_insert on storage.objects for insert to authenticated with check (bucket_id = 'fos-tv-viri');
update fos_aplikacije set kosare = array_append(kosare, 'fos-tv-viri') where koda = 'fp' and not ('fos-tv-viri' = any (kosare));
update fos_aplikacije set kosare = array_append(kosare, 'fos-tv-viri') where koda = 'tv' and not ('fos-tv-viri' = any (kosare));

-- ---------------------------------------------------------------------
-- Prve komponente (Production, delovni plan) - kodo objave doda Production
-- ---------------------------------------------------------------------
insert into fos_tv_viri (koda, ime, opis, aplikacija, ikona, vrstni_red) values
  ('fp_plan_workflow', 'Delovni plan - workflow', 'Kaj je treba narediti: koraki (krovni nalogi) po celicah. Objavi se ob Shrani plan.', 'fp', 'Workflow', 1),
  ('fp_plan_pregled', 'Delovni plan - pregled', 'Do kdaj: časovnica po celicah, krovni nalogi od začetka do roka. Objavi se ob Shrani plan.', 'fp', 'CalendarRange', 2)
on conflict (koda) do nothing;

select koda, ime, vklopljen from fos_tv_viri order by vrstni_red;
