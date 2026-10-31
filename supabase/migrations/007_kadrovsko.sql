-- =====================================================================
-- FIN:OS | 007: kadrovski podatki zaposlenega (list zaposlenega -> Podatki, Zaposlitev)
--
-- fos_zaposleni_kadrovsko  en viden zapis na zaposlenega: osebni podatki (EMŠO, davčna, ZZZS),
--                          stalno in začasno prebivališče (vsako s km do dela), izplačilo (TRR),
--                          kontakt v sili. (Zaposlitev - pogodba, ure, dopust - je v fos_zaposleni_zaposlitev, 008.)
--                          Brez funkcije Kadrovanje (008) baza teh podatkov ne vrne.
--
-- Ločeno od fos_zaposleni: občutljivi podatki se ne berejo za seznam zaposlenih, FIN:ME bo dobil
-- politiko samo za lastni zapis. Zaščita fos_dostop (006) se doda sama (samo Super Admin).
-- Aplikacija preveri kontrolne števke (EMŠO, davčna, IBAN), baza samo obliko.
--
-- Zaženi PO 006_dostopi_aplikacije.sql. Idempotentno.
-- =====================================================================

create table if not exists fos_zaposleni_kadrovsko (
  id                  bigint generated always as identity primary key,
  id_zaposlenega      bigint not null references fos_zaposleni(id),

  -- osebni podatki
  datum_rojstva       date,
  kraj_rojstva        text,
  spol                text check (spol in ('M', 'Ž')),
  drzavljanstvo       text,
  emso                text check (emso ~ '^[0-9]{13}$'),
  davcna_stevilka     text check (davcna_stevilka ~ '^[0-9]{8}$'),
  st_zzzs             text check (st_zzzs ~ '^[0-9]{9}$'),        -- številka zavarovane osebe (kartica zdravstvenega zavarovanja)
  telefon             text,
  osebni_email        text,

  -- stalno prebivališče
  stalno_ulica        text,
  stalno_hisna_st     text,
  stalno_postna_st    text,
  stalno_posta        text,
  stalno_drzava       text,
  stalno_km_do_dela   numeric(6, 1) check (stalno_km_do_dela >= 0),

  -- začasno prebivališče (prazno = ga ni)
  zacasno_ulica       text,
  zacasno_hisna_st    text,
  zacasno_postna_st   text,
  zacasno_posta       text,
  zacasno_drzava      text,
  zacasno_km_do_dela  numeric(6, 1) check (zacasno_km_do_dela >= 0),

  -- prevoz na delo: iz katerega prebivališča (prazno = stalno)
  prevoz_iz           text check (prevoz_iz in ('stalno', 'zacasno')),

  -- izplačilo
  trr                 text,                                         -- IBAN brez presledkov
  banka               text,

  -- kontakt v sili
  kontakt_ime         text,
  kontakt_odnos       text,
  kontakt_telefon     text,

  visible             boolean not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- prva različica 007 je imela en stolpec km_do_dela -> km za vsako prebivališče
alter table fos_zaposleni_kadrovsko add column if not exists stalno_km_do_dela numeric(6, 1) check (stalno_km_do_dela >= 0);
alter table fos_zaposleni_kadrovsko add column if not exists zacasno_km_do_dela numeric(6, 1) check (zacasno_km_do_dela >= 0);
do $$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'fos_zaposleni_kadrovsko' and column_name = 'km_do_dela') then
    update fos_zaposleni_kadrovsko set zacasno_km_do_dela = km_do_dela where km_do_dela is not null and prevoz_iz = 'zacasno' and zacasno_km_do_dela is null;
    update fos_zaposleni_kadrovsko set stalno_km_do_dela = km_do_dela where km_do_dela is not null and coalesce(prevoz_iz, 'stalno') = 'stalno' and stalno_km_do_dela is null;
    alter table fos_zaposleni_kadrovsko drop column km_do_dela;
  end if;
end;
$$;

create unique index if not exists fos_zaposleni_kadrovsko_zaposleni_uq
  on fos_zaposleni_kadrovsko (id_zaposlenega) where visible;
create unique index if not exists fos_zaposleni_kadrovsko_emso_uq
  on fos_zaposleni_kadrovsko (emso) where visible and emso is not null;
create unique index if not exists fos_zaposleni_kadrovsko_davcna_uq
  on fos_zaposleni_kadrovsko (davcna_stevilka) where visible and davcna_stevilka is not null;

drop trigger if exists fos_zaposleni_kadrovsko_updated_at on fos_zaposleni_kadrovsko;
create trigger fos_zaposleni_kadrovsko_updated_at
  before update on fos_zaposleni_kadrovsko for each row execute function fos_set_updated_at();

alter table fos_zaposleni_kadrovsko enable row level security;
drop policy if exists fos_zaposleni_kadrovsko_select on fos_zaposleni_kadrovsko;
drop policy if exists fos_zaposleni_kadrovsko_insert on fos_zaposleni_kadrovsko;
drop policy if exists fos_zaposleni_kadrovsko_update on fos_zaposleni_kadrovsko;
create policy fos_zaposleni_kadrovsko_select on fos_zaposleni_kadrovsko for select to authenticated using (true);
create policy fos_zaposleni_kadrovsko_insert on fos_zaposleni_kadrovsko for insert to authenticated with check (true);
create policy fos_zaposleni_kadrovsko_update on fos_zaposleni_kadrovsko for update to authenticated using (true) with check (true);

-- zaščita FIN:OS (samo Super Admin) - dogodek fos_nova_tabela jo doda ob CREATE TABLE, tu še za ponovni zagon
select fos_zasciti_tabelo('fos_zaposleni_kadrovsko'::regclass);
