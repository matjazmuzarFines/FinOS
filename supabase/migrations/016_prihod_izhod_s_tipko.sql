-- =====================================================================
-- FIN:OS | 016: prihod in izhod s tipko (Registracija časa -> Urniki)
--
-- Interval vrste Prihod ali Izhod ima lahko tipko = DRUG prihod / izhod, ki ga zaposleni izbere s tipko (npr. 3 Izredno:
-- nadure brez napake - dejanski čas, presežek zaokrožen na 15 min). Brez tipke = samodejni prihod / izhod ob prislonu.
-- Vrsta Tipka (odsotnost z vrnitvijo: odmor, poslovni, privatni) ima tipko še vedno obvezno.
-- (Do Dovolilnic se nadure štempljajo s tipko Izredno; ko bodo Dovolilnice, jih izničijo napako brez tipke.)
-- Zaženi PO 014. Idempotentno.
-- =====================================================================

alter table fos_intervali drop constraint if exists fos_intervali_vrsta;
alter table fos_intervali add constraint fos_intervali_vrsta check (
  vrsta in ('prihod', 'izhod', 'tipka') and (vrsta <> 'tipka' or id_tipke is not null)
);

-- Preverjanje: intervali s tipko po vrsti
select vrsta, count(*) filter (where id_tipke is not null) as s_tipko, count(*) as vseh from fos_intervali where visible group by vrsta;
