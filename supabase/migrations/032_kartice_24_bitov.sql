-- 032 - Kartice: ujemanje kratke (24-bitne) in dolge (32-bitne) številke
-- ---------------------------------------------------------------------
-- Stari sistem je hranil samo spodnjih 24 bitov kartice (Wiegand 26, npr. 12446662),
-- čitalec na krmilniku pa pošlje cel UID (32 bitov, npr. 0247327686 = 0x0EBDEBC6).
-- Velja: 247327686 % 16777216 = 12446662.
--
-- fos_kartica najprej išče natančno ujemanje (brez vodilnih ničel). Če ga ni in sta obe
-- številki samo števke, se kartica ujema, ko je ENA od njiju kratka (< 16777216) in je enaka
-- spodnjim 24 bitom druge. Dve dolgi številki z različnim zgornjim bajtom sta različni kartici.
-- Na koncu se že zapisanim žigom neznanih kartic (id_zaposlenega null) dodeli zaposleni.
-- Idempotentno - lahko se zažene večkrat.

create or replace function fos_kartica(p_st_kartice text)
returns bigint
language sql
stable
set search_path = public
as $$
  with vhod as (
    select nullif(ltrim(btrim(p_st_kartice), '0'), '') as k
  ),
  kandidati as (
    select z.id,
           case when ltrim(btrim(z.st_kartice), '0') = v.k then 0 else 1 end as prednost
    from fos_zaposleni z, vhod v
    where z.visible and z.st_kartice is not null and v.k is not null
      and (
        ltrim(btrim(z.st_kartice), '0') = v.k
        or (
          btrim(z.st_kartice) ~ '^[0-9]{1,18}$' and v.k ~ '^[0-9]{1,18}$'
          and (
            (btrim(z.st_kartice)::bigint < 16777216 and btrim(z.st_kartice)::bigint = v.k::bigint % 16777216)
            or (v.k::bigint < 16777216 and v.k::bigint = btrim(z.st_kartice)::bigint % 16777216)
          )
        )
      )
  )
  select id from kandidati order by prednost, id limit 1;
$$;
revoke all on function fos_kartica(text) from public, anon, authenticated;

-- Že zapisani žigi neznanih kartic -> zaposleni (dan ostane, kot je bil zapisan).
update fos_dogodki d
set id_zaposlenega = fos_kartica(d.st_kartice)
where d.id_zaposlenega is null
  and d.st_kartice is not null
  and d.vir = 'krmilnik'
  and fos_kartica(d.st_kartice) is not null;
