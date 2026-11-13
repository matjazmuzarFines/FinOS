-- =====================================================================
-- FIN:OS | 028: FIN:TV - nova komponenta "Zaključeni krovni" (po oddelkih) + opis "Delo - prejšnji dan" brez %
-- Zaženi v Supabase -> SQL Editor (po 027). Idempotentno.
--
-- 1) "Zaključeni krovni" (fp_zakljuceni_krovni_p / _m / _e / _t, za vsak oddelek svoja): produktivnost krovnih
--    nalogov iz delovnega plana, zaključenih v zadnjih 30 dneh (normativne / štempljane ure). Stran 16:9 na celico,
--    en krovni = en stolpec. Production jo objavi ob vsakem uvozu Poročanega dela in ob gumbu "Na TV";
--    strani veljajo 7 dni (nova objava zamenja prejšnjo).
-- 2) "Delo - prejšnji dan": številke so zdaj v URAH (razlika do plana), % je rezerviran za produktivnost.
-- =====================================================================

insert into fos_tv_viri (koda, ime, opis, aplikacija, ikona, vrstni_red) values
  ('fp_zakljuceni_krovni_p', 'Zaključeni krovni · Proizvodnja', 'Produktivnost krovnih nalogov, zaključenih v zadnjih 30 dneh (normativne / štempljane ure), po celicah - en krovni en stolpec. Objavi se ob uvozu poročanega dela.', 'fp', 'Trophy', 13),
  ('fp_zakljuceni_krovni_m', 'Zaključeni krovni · Montaža', 'Produktivnost krovnih nalogov, zaključenih v zadnjih 30 dneh (normativne / štempljane ure), po celicah - en krovni en stolpec. Objavi se ob uvozu poročanega dela.', 'fp', 'Trophy', 14),
  ('fp_zakljuceni_krovni_e', 'Zaključeni krovni · Elektro', 'Produktivnost krovnih nalogov, zaključenih v zadnjih 30 dneh (normativne / štempljane ure), po celicah - en krovni en stolpec. Objavi se ob uvozu poročanega dela.', 'fp', 'Trophy', 15),
  ('fp_zakljuceni_krovni_t', 'Zaključeni krovni · Testiranje', 'Produktivnost krovnih nalogov, zaključenih v zadnjih 30 dneh (normativne / štempljane ure), po celicah - en krovni en stolpec. Objavi se ob uvozu poročanega dela.', 'fp', 'Trophy', 16)
on conflict (koda) do nothing;

update fos_tv_viri
   set opis = 'Štempljane ure prejšnjega delovnega dne proti planu po celicah (krog, ure po krovnih nalogih, razlika do plana v urah). Objavi se ob uvozu poročanega dela.'
 where koda in ('fp_delo_vceraj_p', 'fp_delo_vceraj_m', 'fp_delo_vceraj_e', 'fp_delo_vceraj_t');

select koda, ime, vklopljen, visible, vrstni_red from fos_tv_viri where visible order by vrstni_red;
