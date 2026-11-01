-- =====================================================================
-- FIN:OS | 013: tipke krmilnika (Registracija časa -> Nastavitve -> Krmilnik)
--
-- fos_tipke                 tipke na krmilniku: številka tipke (1, 2, 3 ... brez zgornje meje, enolična med vidnimi)
--                           in besedilo, ki se izpiše na krmilniku (npr. "Malica", "Zasebni izhod").
-- fos_intervali.id_tipke    tipka intervala. null = brez tipke: prihod in izhod - samodejno ob prislonu kartice
--                           (odsoten -> prihod, prisoten -> izhod). Vsi ostali intervali imajo tipko.
--                           Ista tipka je lahko v več intervalih (npr. Malica v različnih urnikih).
--
-- Zaženi PO 010_urniki.sql. Idempotentno. Politiko fos_dostop dobi nova tabela sama (006, dogodek fos_nova_tabela).
-- =====================================================================

create table if not exists fos_tipke (
  id          bigint generated always as identity primary key,
  tipka       integer not null check (tipka >= 1),
  besedilo    text not null check (btrim(besedilo) <> ''),
  visible     boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create unique index if not exists fos_tipke_tipka_uq on fos_tipke (tipka) where visible;

alter table fos_intervali add column if not exists id_tipke bigint references fos_tipke(id);

-- updated_at in RLS: select / insert / update za prijavljene, brez delete
do $$
begin
  execute 'drop trigger if exists fos_tipke_updated_at on fos_tipke';
  execute 'create trigger fos_tipke_updated_at before update on fos_tipke for each row execute function fos_set_updated_at()';
  execute 'alter table fos_tipke enable row level security';
  execute 'drop policy if exists fos_tipke_select on fos_tipke';
  execute 'create policy fos_tipke_select on fos_tipke for select to authenticated using (true)';
  execute 'drop policy if exists fos_tipke_insert on fos_tipke';
  execute 'create policy fos_tipke_insert on fos_tipke for insert to authenticated with check (true)';
  execute 'drop policy if exists fos_tipke_update on fos_tipke';
  execute 'create policy fos_tipke_update on fos_tipke for update to authenticated using (true) with check (true)';
  execute 'revoke delete on fos_tipke from anon, authenticated';
end;
$$;

-- Preverjanje
select 'fos_tipke' as tabela, count(*) from fos_tipke where visible
union all select 'fos_intervali s tipko', count(*) from fos_intervali where visible and id_tipke is not null;
