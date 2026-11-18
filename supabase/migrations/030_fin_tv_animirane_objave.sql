-- =====================================================================
-- FIN:OS | 030: FIN:TV - animirane objave (podatki namesto slik strani)
-- Zaženi v Supabase -> SQL Editor (po 025). Idempotentno.
--
-- Komponenta lahko namesto slik strani (PDF -> WebP) objavi PODATKE: `podatki` = jsonb seznam, en element = ena "stran"
-- (npr. en oddelek za en dan) z veljavnostjo po istem indeksu (velja_od / velja_do). FIN:TV iz podatkov naredi scene in
-- jih animirano izriše (src/lib/tvScene.ts, src/components/tv/scene/) - za delavce: naslov, en podatek, glava Fineseka.
-- Objava ima ALI strani ALI podatke. Izvozi PDF v projektih ostanejo (samo na TV ne gredo več kot slike).
-- Projekt objavi z `fos_tv_objavi_podatke(koda, podatki, izvor, velja_od, velja_do)`.
-- =====================================================================

alter table fos_tv_objave add column if not exists podatki jsonb;
-- objava s podatki nima strani
alter table fos_tv_objave alter column strani set default '{}';

-- zadnja objava vsake komponente (stolpec dodan na konec)
create or replace view fos_tv_zadnje_objave with (security_invoker = true) as
  select distinct on (id_vira) id, id_vira, kosara, strani, razmerja, izvor, id_objavil, created_at, velja_od, velja_do, podatki
  from fos_tv_objave where visible
  order by id_vira, id desc;
grant select on fos_tv_zadnje_objave to authenticated;

create or replace function fos_tv_objavi_podatke(
  p_koda text,
  p_podatki jsonb,
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
  n integer;
  nov bigint;
begin
  select * into v from fos_tv_viri where koda = p_koda and visible;
  if not found then raise exception 'Komponente % ni (fos_tv_viri).', p_koda; end if;
  if not fos_tv_sme_objaviti(v.aplikacija) then raise exception 'Za objavo na TV nimaš dostopa do aplikacije %.', v.aplikacija; end if;
  if not v.vklopljen then return null; end if;
  if p_podatki is null or jsonb_typeof(p_podatki) <> 'array' then raise exception 'Podatki objave morajo biti seznam (jsonb array).'; end if;
  n := jsonb_array_length(p_podatki);
  if n = 0 then raise exception 'Objava nima podatkov.'; end if;
  if pg_column_size(p_podatki) > 2000000 then raise exception 'Podatki objave so preveliki (največ 2 MB).'; end if;
  if coalesce(array_length(p_velja_od, 1), 0) not in (0, n) or coalesce(array_length(p_velja_do, 1), 0) not in (0, n) then
    raise exception 'Veljavnost mora imeti en datum za vsak element podatkov (% elementov).', n;
  end if;
  insert into fos_tv_objave (id_vira, strani, razmerja, podatki, izvor, velja_od, velja_do)
  values (v.id, '{}', '{}', p_podatki, coalesce(p_izvor, ''), coalesce(p_velja_od, '{}'), coalesce(p_velja_do, '{}'))
  returning id into nov;
  -- TV-ji zaznajo spremembo po updated_at oken s to komponento (verzija v /api/tv)
  update fos_tv_okna set updated_at = now() where id_vira = v.id and visible;
  return nov;
end;
$$;
revoke all on function fos_tv_objavi_podatke(text, jsonb, text, date[], date[]) from public, anon;
grant execute on function fos_tv_objavi_podatke(text, jsonb, text, date[], date[]) to authenticated;

select column_name, data_type from information_schema.columns where table_name = 'fos_tv_objave' order by ordinal_position;
