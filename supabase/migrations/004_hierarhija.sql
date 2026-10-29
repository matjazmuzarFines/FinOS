-- =====================================================================
-- FIN:OS | 004: hierarhija - brez krogov
--
-- fos_nastavi_vodjo zdaj zavrne vodjo, ki je (posredno) podrejen zaposlenemu
-- (npr. A -> vodja B, B -> vodja A). Potrebno za premikanje v "Prikaz hierarhije" (povleci in spusti).
-- Zaženi PO 003_zaposleni_prijava.sql. Idempotentno.
-- =====================================================================

create or replace function fos_nastavi_vodjo(p_id_zaposlenega bigint, p_id_vodja bigint)
returns void
language plpgsql
security invoker
as $$
begin
  if p_id_vodja is not null and not exists (select 1 from fos_vodje where id = p_id_vodja and visible) then
    raise exception 'Izbran vodja ne obstaja.';
  end if;

  -- pot navzgor od izbranega vodje: če pride do zaposlenega, bi nastal krog (tudi "sam sebi vodja")
  if p_id_vodja is not null and exists (
    with recursive gor (id_zaposlenega) as (
      select v.id_zaposlenega from fos_vodje v where v.id = p_id_vodja
      union
      select v2.id_zaposlenega
      from gor
      join ln_fos_zaposleni_vodja l on l.id_zaposlenega = gor.id_zaposlenega and l.visible
      join fos_vodje v2 on v2.id = l.id_vodja
    )
    select 1 from gor where id_zaposlenega = p_id_zaposlenega
  ) then
    raise exception 'Vodja ne more biti podrejen svojemu zaposlenemu (krog v hierarhiji).';
  end if;

  -- brez spremembe
  if exists (
    select 1 from ln_fos_zaposleni_vodja
    where id_zaposlenega = p_id_zaposlenega and visible and id_vodja = p_id_vodja
  ) or (p_id_vodja is null and not exists (
    select 1 from ln_fos_zaposleni_vodja where id_zaposlenega = p_id_zaposlenega and visible
  )) then
    return;
  end if;

  update ln_fos_zaposleni_vodja set visible = false where id_zaposlenega = p_id_zaposlenega and visible;
  if p_id_vodja is not null then
    insert into ln_fos_zaposleni_vodja (id_zaposlenega, id_vodja) values (p_id_zaposlenega, p_id_vodja);
  end if;
end;
$$;

revoke all on function fos_nastavi_vodjo(bigint, bigint) from public, anon;
grant execute on function fos_nastavi_vodjo(bigint, bigint) to authenticated;
