-- =====================================================================
-- FIN:OS | 026: FIN:TV - workflow plana po oddelkih in po tednih (kot pregled v 025)
-- Zaženi v Supabase -> SQL Editor (po 025). Idempotentno.
--
-- Workflow plana (kaj je treba narediti) je enako kot pregled (do kdaj) za vsak oddelek svoja komponenta
-- (fp_plan_workflow_p / _m / _e / _t). Production ob "Shrani plan" za vsak teden od tekočega do konca plana ustvari
-- oba PDF-ja; strani tedna veljajo pon - ned (velja_od / velja_do iz 025), TV kaže tekoči teden.
-- Splošna fp_plan_workflow (brez oken) se skrije.
-- =====================================================================

insert into fos_tv_viri (koda, ime, opis, aplikacija, ikona, vrstni_red) values
  ('fp_plan_workflow_p', 'Delovni plan - workflow · Proizvodnja', 'Kaj je treba narediti: koraki (krovni nalogi) po celicah. Ob Shrani plan se objavi workflow za vsak teden plana - TV kaže tekoči teden.', 'fp', 'Workflow', 1),
  ('fp_plan_workflow_m', 'Delovni plan - workflow · Montaža', 'Kaj je treba narediti: koraki (krovni nalogi) po celicah. Ob Shrani plan se objavi workflow za vsak teden plana - TV kaže tekoči teden.', 'fp', 'Workflow', 3),
  ('fp_plan_workflow_e', 'Delovni plan - workflow · Elektro', 'Kaj je treba narediti: koraki (krovni nalogi) po celicah. Ob Shrani plan se objavi workflow za vsak teden plana - TV kaže tekoči teden.', 'fp', 'Workflow', 5),
  ('fp_plan_workflow_t', 'Delovni plan - workflow · Testiranje', 'Kaj je treba narediti: koraki (krovni nalogi) po celicah. Ob Shrani plan se objavi workflow za vsak teden plana - TV kaže tekoči teden.', 'fp', 'Workflow', 7)
on conflict (koda) do nothing;

-- vrstni red v panelu Komponente: po oddelkih, workflow pred pregledom
update fos_tv_viri set vrstni_red = 2 where koda = 'fp_plan_pregled_p';
update fos_tv_viri set vrstni_red = 4 where koda = 'fp_plan_pregled_m';
update fos_tv_viri set vrstni_red = 6 where koda = 'fp_plan_pregled_e';
update fos_tv_viri set vrstni_red = 8 where koda = 'fp_plan_pregled_t';

update fos_tv_viri set visible = false
where koda = 'fp_plan_workflow' and visible
  and not exists (select 1 from fos_tv_okna o where o.id_vira = fos_tv_viri.id and o.visible);

select koda, ime, vklopljen, visible, vrstni_red from fos_tv_viri order by vrstni_red;
