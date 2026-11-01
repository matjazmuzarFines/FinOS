-- =====================================================================
-- FIN:OS | 014: vrsta intervala, prikaz in funkcija tipke (Registracija časa -> Urniki, Krmilnik)
--
-- fos_intervali.vrsta       'prihod' = okno prihoda (brez tipke, samodejno ob prislonu kartice, začne izmeno)
--                           'izhod'  = okno izhoda (brez tipke, samodejno, konča izmeno)
--                           'tipka'  = izhod / odsotnost s tipko (malica, odmor, poslovni, privatni ...): OBA žiga
--                                      (s tipko in vrnitev) morata biti v oknu cas_od-cas_do, sicer napaka.
--                           Tipka je obvezna natanko pri vrsti 'tipka'.
-- fos_tipke.prikaz          kje se tipka pokaže: 'krmilnik', 'fin_me' (oba, eno ali nobeno = nikjer).
-- fos_tipke.funkcija        sistemska funkcija krmilnika namesto intervala: 'info' (stanje, saldo), 'preklici'
--                           (prekliči zadnji pritisk); null = navadna tipka za interval.
--
-- Obstoječi podatki: vrsta = 'tipka', če ima interval tipko; 'izhod', če se ime ali prikazno ime začne z "Izhod";
-- sicer 'prihod'. Tipka "Info" -> funkcija info, "Prekliči" -> preklici, "Delo od doma" -> samo FIN:ME.
-- Zaženi PO 013_krmilnik.sql. Idempotentno.
-- =====================================================================

alter table fos_intervali add column if not exists vrsta text not null default 'prihod';

update fos_intervali set vrsta = case
  when id_tipke is not null then 'tipka'
  when ime ilike 'izhod%' or prikazno_ime ilike 'izhod%' then 'izhod'
  else 'prihod'
end
where vrsta = 'prihod' and (id_tipke is not null or ime ilike 'izhod%' or prikazno_ime ilike 'izhod%');

alter table fos_intervali drop constraint if exists fos_intervali_vrsta;
alter table fos_intervali add constraint fos_intervali_vrsta check (
  vrsta in ('prihod', 'izhod', 'tipka') and (vrsta = 'tipka') = (id_tipke is not null)
);

alter table fos_tipke add column if not exists prikaz text[] not null default array['krmilnik'];
alter table fos_tipke add column if not exists funkcija text;

alter table fos_tipke drop constraint if exists fos_tipke_prikaz;
alter table fos_tipke add constraint fos_tipke_prikaz check (prikaz <@ array['krmilnik', 'fin_me']);
alter table fos_tipke drop constraint if exists fos_tipke_funkcija;
alter table fos_tipke add constraint fos_tipke_funkcija check (funkcija is null or funkcija in ('info', 'preklici'));

update fos_tipke set funkcija = 'info' where visible and funkcija is null and btrim(besedilo) ilike 'info';
update fos_tipke set funkcija = 'preklici' where visible and funkcija is null and btrim(besedilo) ilike 'prekli_i';
update fos_tipke set prikaz = array['fin_me'] where visible and btrim(besedilo) ilike 'delo od doma' and prikaz = array['krmilnik'];

-- Preverjanje
select vrsta, count(*) from fos_intervali where visible group by vrsta
union all select coalesce('tipka: ' || funkcija, 'tipka: interval'), count(*) from fos_tipke where visible group by funkcija;
