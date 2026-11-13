-- =====================================================================
-- FIN:OS | 025: FIN:TV - strani objave po tednih (veljavnost strani) + pregled plana po oddelkih
-- Zaženi v Supabase -> SQL Editor (po 023). Idempotentno.
--
-- Objava komponente ima lahko strani za več tednov naprej (npr. Production -> Shrani plan: pregled za vsak teden, za
-- katerega je plan narejen). Vsaka stran ima svojo veljavnost `velja_od` / `velja_do` (datum, oba vključno; null ali
-- prazen seznam = velja vedno). TV kaže samo strani, ki veljajo DANES - v ponedeljek sam preklopi na nov teden, brez
-- ponovnega shranjevanja. Nova objava (Shrani plan) zamenja vse tedne naenkrat.
--
-- Pregled plana je za vsak oddelek svoja komponenta (fp_plan_pregled_p / _m / _e / _t), da Shrani plan enega oddelka
-- ne prepiše TV-ja drugega. Splošna fp_plan_pregled (brez oken in objav) se skrije.
-- =====================================================================

alter table fos_tv_objave add column if not exists velja_od date[] not null default '{}';
alter table fos_tv_objave add column if not exists velja_do date[] not null default '{}';

-- zadnja objava vsake komponente (stolpca dodana na konec)
create or replace view fos_tv_zadnje_objave with (security_invoker = true) as
  select distinct on (id_vira) id, id_vira, kosara, strani, razmerja, izvor, id_objavil, created_at, velja_od, velja_do
  from fos_tv_objave where visible
  order by id_vira, id desc;
grant select on fos_tv_zadnje_objave to authenticated;

-- objava z veljavnostjo strani (stara oblika s 4 argumenti deluje naprej - strani veljajo vedno)
drop function if exists fos_tv_objavi(text, text[], numeric[], text);
create or replace function fos_tv_objavi(
  p_koda text,
  p_strani text[],
  p_razmerja numeric[],
  p_izvor text,
  p_velja_od date[] default null,
  p_velja_do date[] default null
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v fos_tv_viri;
  n integer := coalesce(array_length(p_strani, 1), 0);
  nov bigint;
begin
  select * into v from fos_tv_viri where koda = p_koda and visible;
  if not found then raise exception 'Komponente % ni (fos_tv_viri).', p_koda; end if;
  if not fos_tv_sme_objaviti(v.aplikacija) then raise exception 'Za objavo na TV nimaš dostopa do aplikacije %.', v.aplikacija; end if;
  if not v.vklopljen then return null; end if;
  if n = 0 then raise exception 'Objava nima strani.'; end if;
  if coalesce(array_length(p_velja_od, 1), 0) not in (0, n) or coalesce(array_length(p_velja_do, 1), 0) not in (0, n) then
    raise exception 'Veljavnost mora imeti en datum za vsako stran (% strani).', n;
  end if;
  insert into fos_tv_objave (id_vira, strani, razmerja, izvor, velja_od, velja_do)
  values (v.id, p_strani, coalesce(p_razmerja, '{}'), coalesce(p_izvor, ''), coalesce(p_velja_od, '{}'), coalesce(p_velja_do, '{}'))
  returning id into nov;
  -- TV-ji zaznajo spremembo po updated_at oken s to komponento (verzija v /api/tv)
  update fos_tv_okna set updated_at = now() where id_vira = v.id and visible;
  return nov;
end;
$$;
revoke all on function fos_tv_objavi(text, text[], numeric[], text, date[], date[]) from public, anon;
grant execute on function fos_tv_objavi(text, text[], numeric[], text, date[], date[]) to authenticated;

-- pregled plana po oddelkih (Production: ODDELKI_NORMATIVA)
insert into fos_tv_viri (koda, ime, opis, aplikacija, ikona, vrstni_red) values
  ('fp_plan_pregled_p', 'Delovni plan - pregled · Proizvodnja', 'Do kdaj: roki krovnih nalogov po celicah. Ob Shrani plan se objavi pregled za vsak teden plana - TV kaže tekoči teden.', 'fp', 'CalendarRange', 2),
  ('fp_plan_pregled_m', 'Delovni plan - pregled · Montaža', 'Do kdaj: roki krovnih nalogov po celicah. Ob Shrani plan se objavi pregled za vsak teden plana - TV kaže tekoči teden.', 'fp', 'CalendarRange', 3),
  ('fp_plan_pregled_e', 'Delovni plan - pregled · Elektro', 'Do kdaj: roki krovnih nalogov po celicah. Ob Shrani plan se objavi pregled za vsak teden plana - TV kaže tekoči teden.', 'fp', 'CalendarRange', 4),
  ('fp_plan_pregled_t', 'Delovni plan - pregled · Testiranje', 'Do kdaj: roki krovnih nalogov po celicah. Ob Shrani plan se objavi pregled za vsak teden plana - TV kaže tekoči teden.', 'fp', 'CalendarRange', 5)
on conflict (koda) do nothing;

update fos_tv_viri set visible = false
where koda = 'fp_plan_pregled' and visible
  and not exists (select 1 from fos_tv_okna o where o.id_vira = fos_tv_viri.id and o.visible);

select koda, ime, vklopljen, visible from fos_tv_viri order by vrstni_red;
