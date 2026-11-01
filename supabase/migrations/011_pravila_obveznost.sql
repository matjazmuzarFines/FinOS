-- =====================================================================
-- FIN:OS | 011: pravila knjiženja intervalov in delovna obveznost urnikov (Registracija časa -> Urniki, Delovna obveznost)
--
-- 1) Pravila knjiženja intervala (stolpci v fos_intervali, en zapis na interval).
--    Krmilnik VEDNO zapiše dejanski čas žiga; pravila določajo samo KNJIŽEN čas (izračun, nič se ne prepiše).
--    Smer žiga je samodejna: odsoten -> prihod, prisoten -> izhod. Žig s tipko odpre odsek intervala tipke
--    (malica, odmor, poslovni, privatni ...), naslednji žig ga zaključi in nadaljuje delo izmene.
--    Pravila veljajo glede na vrsto intervala (014):
--    - prihod: okno prihoda = cas_od-cas_do; izven okna: dejanski čas + NAPAKA (izmena ostane v najbližjem intervalu).
--              Začetek: dejanski ali "ne prej kot" (zacetek_ne_prej), nato zaokroževanje.
--    - izhod:  okno izhoda = cas_od-cas_do; izven okna: dejanski čas + NAPAKA.
--              Konec: dejanski ali "ne pozneje kot" (konec_ne_pozneje), nato zaokroževanje.
--              Presežek nad dnevno obveznostjo (gre v saldo): šteje ves / zaokroži navzdol na presezek_korak / ne šteje.
--    - tipka:  OBA žiga (s tipko in vrnitev) v oknu cas_od-cas_do, sicer NAPAKA.
--              Seštej trajanje: trajanje_max (minute na dan, vsi odseki tipke skupaj; null = brez omejitve);
--              čas nad tem gre v id_statistike_prekoracitve (npr. Zamuda - ne šteje v obveznost = minus ure).
--    Primer režija: prihod in izhod 00:00-23:59, presežek zaokroži 15. Proizvodnja 1 izmena: prihod 00:00-06:30, izhod
--    14:30-23:59 ne pozneje kot 14:30, odmor 09:55-10:35 seštej 00:30 -> prekoračitev v Zamudo.
--    Zaokroževanje: null = brez, 'gor', 'dol', 'najblizje'; korak v minutah. Kasneje: Dovolilnice izničijo napake in
--    pravila (velja dejanski čas). Dan se vedno izračuna po TRENUTNIH pravilih.
--
-- 2) Delovna obveznost urnika po dnevih (ln_fos_urniki_dnevi): minute na dan (Pon ... Ned, Praz).
--    Dnevni saldo = knjiženo delo - obveznost (presežek > 0, manjko < 0). Piše se samo prek fos_nastavi_obveznost.
--    Začetna obveznost: 8 h pon-pet, 0 ob vikendih in praznikih (urnikom, ki je še nimajo) - popravi v Delovni obveznosti.
--
-- Zaženi PO 014_vrsta_intervala.sql. Idempotentno.
-- =====================================================================

alter table fos_intervali add column if not exists zacetek_ne_prej    time;
alter table fos_intervali add column if not exists zacetek_zaokrozi   text;
alter table fos_intervali add column if not exists zacetek_korak      integer not null default 15;
alter table fos_intervali add column if not exists konec_ne_pozneje   time;
alter table fos_intervali add column if not exists konec_zaokrozi     text;
alter table fos_intervali add column if not exists konec_korak        integer not null default 15;
alter table fos_intervali add column if not exists presezek           text not null default 'steje';
alter table fos_intervali add column if not exists presezek_korak     integer not null default 15;
alter table fos_intervali add column if not exists trajanje_max       integer;
alter table fos_intervali add column if not exists id_statistike_prekoracitve bigint references fos_statistike(id);

alter table fos_intervali drop constraint if exists fos_intervali_pravila;
alter table fos_intervali add constraint fos_intervali_pravila check (
  (zacetek_zaokrozi is null or zacetek_zaokrozi in ('gor', 'dol', 'najblizje'))
  and (konec_zaokrozi is null or konec_zaokrozi in ('gor', 'dol', 'najblizje'))
  and presezek in ('steje', 'zaokrozi', 'ne_steje')
  and (trajanje_max is null or (trajanje_max between 1 and 1440 and id_statistike_prekoracitve is not null))
  and zacetek_korak between 1 and 240 and konec_korak between 1 and 240 and presezek_korak between 1 and 240
);

create table if not exists ln_fos_urniki_dnevi (
  id             bigint generated always as identity primary key,
  id_urnika      bigint not null references fos_urniki(id),
  id_dneva       bigint not null references fos_dnevi(id),
  obveznost_min  integer not null default 0 check (obveznost_min between 0 and 1440),
  visible        boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create unique index if not exists ln_fos_urniki_dnevi_uq on ln_fos_urniki_dnevi (id_urnika, id_dneva) where visible;

do $$
begin
  execute 'drop trigger if exists ln_fos_urniki_dnevi_updated_at on ln_fos_urniki_dnevi';
  execute 'create trigger ln_fos_urniki_dnevi_updated_at before update on ln_fos_urniki_dnevi for each row execute function fos_set_updated_at()';
  execute 'alter table ln_fos_urniki_dnevi enable row level security';
  execute 'drop policy if exists ln_fos_urniki_dnevi_select on ln_fos_urniki_dnevi';
  execute 'create policy ln_fos_urniki_dnevi_select on ln_fos_urniki_dnevi for select to authenticated using (true)';
  execute 'drop policy if exists ln_fos_urniki_dnevi_insert on ln_fos_urniki_dnevi';
  execute 'create policy ln_fos_urniki_dnevi_insert on ln_fos_urniki_dnevi for insert to authenticated with check (true)';
  execute 'drop policy if exists ln_fos_urniki_dnevi_update on ln_fos_urniki_dnevi';
  execute 'create policy ln_fos_urniki_dnevi_update on ln_fos_urniki_dnevi for update to authenticated using (true) with check (true)';
  execute 'revoke delete on ln_fos_urniki_dnevi from anon, authenticated';
end;
$$;

-- Obveznost urnika na dan: star zapis se skrije (zgodovina), nov se doda. Brez spremembe = nič.
create or replace function fos_nastavi_obveznost(p_id_urnika bigint, p_id_dneva bigint, p_minute integer)
returns void
language plpgsql
security invoker
as $$
begin
  if exists (select 1 from ln_fos_urniki_dnevi where id_urnika = p_id_urnika and id_dneva = p_id_dneva and visible and obveznost_min = p_minute) then
    return;
  end if;
  update ln_fos_urniki_dnevi set visible = false where id_urnika = p_id_urnika and id_dneva = p_id_dneva and visible;
  insert into ln_fos_urniki_dnevi (id_urnika, id_dneva, obveznost_min) values (p_id_urnika, p_id_dneva, p_minute);
end;
$$;

grant execute on function fos_nastavi_obveznost(bigint, bigint, integer) to authenticated;

-- Začetna obveznost: 8 h od ponedeljka do petka za urnike, ki je še nimajo.
insert into ln_fos_urniki_dnevi (id_urnika, id_dneva, obveznost_min)
select u.id, d.id, case when d.iso_dan between 1 and 5 then 480 else 0 end
from fos_urniki u cross join fos_dnevi d
where u.visible and d.visible
  and not exists (select 1 from ln_fos_urniki_dnevi x where x.id_urnika = u.id and x.id_dneva = d.id and x.visible);

-- Preverjanje
select u.ime, sum(x.obveznost_min) / 60.0 as ur_na_teden
from fos_urniki u join ln_fos_urniki_dnevi x on x.id_urnika = u.id and x.visible
where u.visible group by u.ime order by u.ime;
