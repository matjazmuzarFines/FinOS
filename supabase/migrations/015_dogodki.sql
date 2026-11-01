-- =====================================================================
-- FIN:OS | 015: dogodki (štempljanja) - Registracija časa
--
-- fos_dogodki   en zapis = en žig (krmilnik, FIN:ME, ročni popravek, uvoz iz starega sistema).
--               Dogodek nima smeri ne statistike: smer določi zaporedje (odsoten -> prihod, prisoten -> izhod),
--               statistiko interval urnika (po tipki in oknu) - izračun v aplikaciji (knjizenje.ts) po TRENUTNIH
--               nastavitvah. Krmilnik vedno zapiše DEJANSKI čas.
--   cas           dejanski trenutek žiga (timestamptz).
--   datum         dan, kateremu dogodek pripada (delo čez polnoč = dan prihoda; npr. odhod 2.10. ob 01:00 -> 1.10.).
--                 Določi se ob vpisu (krmilnik / aplikacija); ročni popravek ga izbere sam.
--   id_tipke      tipka (fos_tipke) ali null (prihod / izhod brez tipke).
--   vir           'krmilnik' | 'online' (FIN:ME) | 'rocno' (ročni popravek) | 'uvoz' (stari sistem).
--   st_kartice    kartica, kot jo je prebral krmilnik (tudi neznana kartica - id_zaposlenega je takrat null).
--   spregledan    dogodkov se NE briše in NE ureja: spregledan = izračun ga ne upošteva (prikaz prečrtan).
--                 Piše se samo prek fos_spreglej_dogodek (kdo in kdaj ostane zapisano).
--   komentar      pri ročnem popravku (npr. "pozabil štempljati").
--
-- Pravice: vstavljanje vsem prijavljenim (ročni popravki so v aplikaciji samo v Administraciji), posodabljanje SAMO
-- stolpcev spregleda prek funkcije (ostali stolpci se ne dajo spreminjati). Brez delete.
-- Zaženi PO 001, 013. Idempotentno.
-- =====================================================================

create table if not exists fos_dogodki (
  id               bigint generated always as identity primary key,
  id_zaposlenega   bigint references fos_zaposleni(id),
  st_kartice       text,
  cas              timestamptz not null,
  datum            date not null,
  id_tipke         bigint references fos_tipke(id),
  vir              text not null default 'krmilnik' check (vir in ('krmilnik', 'online', 'rocno', 'uvoz')),
  komentar         text not null default '',
  spregledan       boolean not null default false,
  spregledal       uuid references auth.users(id),
  spregledano_ob   timestamptz,
  vnesel           uuid default auth.uid() references auth.users(id),
  visible          boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint fos_dogodki_oseba check (id_zaposlenega is not null or st_kartice is not null)
);
create index if not exists fos_dogodki_zaposleni_datum on fos_dogodki (id_zaposlenega, datum) where visible;
create index if not exists fos_dogodki_cas on fos_dogodki (cas);
-- uvoz se lahko ponovi brez podvajanja
create unique index if not exists fos_dogodki_uvoz_uq on fos_dogodki (id_zaposlenega, cas, coalesce(id_tipke, 0)) where vir = 'uvoz' and visible;

do $$
begin
  execute 'drop trigger if exists fos_dogodki_updated_at on fos_dogodki';
  execute 'create trigger fos_dogodki_updated_at before update on fos_dogodki for each row execute function fos_set_updated_at()';
  execute 'alter table fos_dogodki enable row level security';
  execute 'drop policy if exists fos_dogodki_select on fos_dogodki';
  execute 'create policy fos_dogodki_select on fos_dogodki for select to authenticated using (true)';
  execute 'drop policy if exists fos_dogodki_insert on fos_dogodki';
  execute 'create policy fos_dogodki_insert on fos_dogodki for insert to authenticated with check (true)';
  execute 'drop policy if exists fos_dogodki_update on fos_dogodki';
  execute 'create policy fos_dogodki_update on fos_dogodki for update to authenticated using (true) with check (true)';
  -- dogodka se ne ureja: posodobiti se da samo spregled (prek funkcije)
  execute 'revoke update, delete on fos_dogodki from anon, authenticated';
  execute 'grant update (spregledan, spregledal, spregledano_ob) on fos_dogodki to authenticated';
end;
$$;

-- Spregled dogodka (ali preklic): zapiše kdo in kdaj.
create or replace function fos_spreglej_dogodek(p_id bigint, p_spregledan boolean)
returns void
language plpgsql
security invoker
as $$
begin
  update fos_dogodki
  set spregledan = p_spregledan,
      spregledal = case when p_spregledan then auth.uid() end,
      spregledano_ob = case when p_spregledan then now() end
  where id = p_id and spregledan is distinct from p_spregledan;
end;
$$;

grant execute on function fos_spreglej_dogodek(bigint, boolean) to authenticated;

-- Preverjanje
select vir, count(*) from fos_dogodki where visible group by vir;
