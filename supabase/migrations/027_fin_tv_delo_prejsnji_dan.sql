-- =====================================================================
-- FIN:OS | 027: FIN:TV - "Delovni plan" (preimenovan workflow) in nova komponenta "Delo - prejšnji dan"
-- Zaženi v Supabase -> SQL Editor (po 026). Idempotentno.
--
-- 1) Komponente workflowa plana se imenujejo samo "Delovni plan · <oddelek>" (koda ostane fp_plan_workflow_*).
-- 2) "Delo - prejšnji dan" (fp_delo_vceraj_p / _m / _e / _t, za vsak oddelek svoja): štempljane ure prejšnjega
--    delovnega dne proti planu po celicah (krog za vsako celico, ure po krovnih nalogih, poraba %). Production jo objavi
--    ob vsakem uvozu Poročanega dela (Sync zjutraj / popoldan); stran velja samo na dan objave - do prvega uvoza
--    naslednji dan je komponenta prazna (TV jo preskoči).
-- =====================================================================

update fos_tv_viri set ime = 'Delovni plan · Proizvodnja' where koda = 'fp_plan_workflow_p';
update fos_tv_viri set ime = 'Delovni plan · Montaža' where koda = 'fp_plan_workflow_m';
update fos_tv_viri set ime = 'Delovni plan · Elektro' where koda = 'fp_plan_workflow_e';
update fos_tv_viri set ime = 'Delovni plan · Testiranje' where koda = 'fp_plan_workflow_t';

insert into fos_tv_viri (koda, ime, opis, aplikacija, ikona, vrstni_red) values
  ('fp_delo_vceraj_p', 'Delo - prejšnji dan · Proizvodnja', 'Štempljane ure prejšnjega delovnega dne proti planu po celicah (krog, ure po krovnih nalogih, %). Objavi se ob uvozu poročanega dela.', 'fp', 'Gauge', 9),
  ('fp_delo_vceraj_m', 'Delo - prejšnji dan · Montaža', 'Štempljane ure prejšnjega delovnega dne proti planu po celicah (krog, ure po krovnih nalogih, %). Objavi se ob uvozu poročanega dela.', 'fp', 'Gauge', 10),
  ('fp_delo_vceraj_e', 'Delo - prejšnji dan · Elektro', 'Štempljane ure prejšnjega delovnega dne proti planu po celicah (krog, ure po krovnih nalogih, %). Objavi se ob uvozu poročanega dela.', 'fp', 'Gauge', 11),
  ('fp_delo_vceraj_t', 'Delo - prejšnji dan · Testiranje', 'Štempljane ure prejšnjega delovnega dne proti planu po celicah (krog, ure po krovnih nalogih, %). Objavi se ob uvozu poročanega dela.', 'fp', 'Gauge', 12)
on conflict (koda) do nothing;

select koda, ime, vklopljen, visible, vrstni_red from fos_tv_viri where visible order by vrstni_red;
