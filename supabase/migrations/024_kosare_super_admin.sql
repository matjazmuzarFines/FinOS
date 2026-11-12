-- 024: Super Admin sme v košare FIN:OS (fos-...), tudi brez vklopljene aplikacije.
--
-- Napaka: nalaganje v FIN:TV -> "new row violates row-level security policy".
-- Vzrok: omejevalna politika fos_dostop na storage.objects kliče fos_ima_dostop(bucket_id). Tabele fos_tv_* so
-- prepuščene Super Adminu (predpona fos_), košara 'fos-tv' (z vezajem) pa je šla samo prek vklopljene aplikacije
-- FIN:TV v Dostopih - Super Admin brez tega stikala ni mogel naložiti datoteke.
-- Popravek: košara s predpono 'fos-' = Super Admin ALI vklopljena aplikacija s to košaro (npr. fos-tv-viri za
-- Production ostane dostopna prek aplikacije fp). Ostalo je enako kot prej. Idempotentno.

create or replace function public.fos_ima_dostop(p_ime text)
returns boolean
language plpgsql
stable security definer
set search_path to 'public'
as $function$
declare
  z record;
begin
  select id, visible into z
  from fos_zaposleni where id_uporabnika = auth.uid()
  order by visible desc limit 1;

  if not found then
    return true;
  end if;
  if not z.visible then
    return false;
  end if;
  if starts_with(p_ime, 'fos_') or starts_with(p_ime, 'ln_fos_') then
    -- FIN:ME: vsak zaposleni do svojih podatkov (vrstice in pisanje omejijo politike fos_finme_*)
    return fos_je_super_admin() or p_ime = any (fos_finme_tabele());
  end if;
  if starts_with(p_ime, 'fos-') and fos_je_super_admin() then
    -- košare FIN:OS (fos-tv ...) so za Administracijo kot tabele fos_
    return true;
  end if;

  return exists (
    select 1
    from ln_fos_zaposleni_aplikacije l
    join fos_aplikacije a on a.id = l.id_aplikacije and a.visible
    where l.id_zaposlenega = z.id and l.visible
      and (
        p_ime = any (a.kosare)
        or exists (select 1 from unnest(a.predpone) p where starts_with(p_ime, p) or starts_with(p_ime, 'ln_' || p))
      )
  );
end;
$function$;
