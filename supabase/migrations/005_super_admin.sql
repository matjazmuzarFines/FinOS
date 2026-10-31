-- =====================================================================
-- FIN:OS | 005: Super Admin
--
-- fos_zaposleni.super_admin   true = zaposleni s svojim računom (e-mail / uporabniško ime + geslo) ima dostop
--                             do FIN:OS Administracije. Nastavi ga samo strežnik (/api/zaposleni/racun) -
--                             aplikacija tega stolpca ne more pisati (pravice po stolpcih iz 003 ga ne vključujejo).
-- fos_je_super_admin()        ali je prijavljen uporabnik (auth.uid()) Super Admin; kliče ga zaklep Administracije.
--
-- OD 008 (funkcije) je Super Admin funkcija v ln_fos_zaposleni_funkcije, stolpca ni več.
-- Ponovni zagon te datoteke po 008 ne naredi ničesar.
--
-- Zaženi PO 004_hierarhija.sql. Idempotentno.
-- =====================================================================

do $$
begin
  if to_regclass('public.ln_fos_zaposleni_funkcije') is not null then
    raise notice '005: funkcije (008) že obstajajo - Super Admin je funkcija, preskočeno.';
    return;
  end if;
  alter table fos_zaposleni add column if not exists super_admin boolean not null default false;
  execute $f$
    create or replace function fos_je_super_admin()
    returns boolean
    language sql
    stable
    security definer
    set search_path = public
    as $b$
      select exists (
        select 1 from fos_zaposleni
        where id_uporabnika = auth.uid() and visible and super_admin
      );
    $b$
  $f$;
end;
$$;

revoke all on function fos_je_super_admin() from public, anon;
grant execute on function fos_je_super_admin() to authenticated;
