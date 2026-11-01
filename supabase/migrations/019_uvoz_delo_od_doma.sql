-- =====================================================================
-- FIN:OS | 019: popravek uvoza 018 - konec dela od doma s tipko 101
--
-- V starem sistemu je bilo delo od doma svoj par žigov s tipko "Delo od doma" (začetek IN konec). Uvoz 018 je konec
-- zapisal brez tipke, zato se je knjižil kot navaden izhod (presežek zaokrožen na 15 min). Delo od doma je zdaj
-- Prihod + Izhod s tipko 101 (kot Izredno): izhod dela od doma ima svoje pravilo presežka (šteje ves).
-- Popravi samo uvožene dogodke (vir uvoz), ki so bili v poročilu konec "Delo od doma". Zaženi PO 018. Idempotentno.
-- =====================================================================

update fos_dogodki d
set id_tipke = t.id
from (values
  ('3207116', '2026-10-04 22:13'),  -- Kunstelj Denis 2026-10-04
  ('3207116', '2026-10-08 00:30'),  -- Kunstelj Denis 2026-10-07
  ('3207116', '2026-10-09 00:17'),  -- Kunstelj Denis 2026-10-08
  ('3207116', '2026-10-12 23:38'),  -- Kunstelj Denis 2026-10-12
  ('3207116', '2026-10-14 23:23'),  -- Kunstelj Denis 2026-10-14
  ('3207116', '2026-10-18 22:51'),  -- Kunstelj Denis 2026-10-18
  ('3207116', '2026-10-19 23:42'),  -- Kunstelj Denis 2026-10-19
  ('3207116', '2026-10-22 01:47'),  -- Kunstelj Denis 2026-10-21
  ('3207116', '2026-10-29 00:25'),  -- Kunstelj Denis 2026-10-28
  ('12419885', '2026-10-21 14:32')  -- Živanić Ljubiša 2026-10-21
) as v (kartica, cas)
join fos_zaposleni z on z.visible and z.st_kartice = v.kartica
join fos_tipke t on t.visible and t.tipka = 101
where d.id_zaposlenega = z.id and d.vir = 'uvoz' and d.visible and d.id_tipke is null
  and d.cas = (v.cas || ' Europe/Ljubljana')::timestamptz;

-- Preverjanje
select count(*) as dogodkov_dela_od_doma from fos_dogodki d join fos_tipke t on t.id = d.id_tipke where t.tipka = 101 and d.vir = 'uvoz' and d.visible;
