-- =====================================================================
-- FIN:OS | 033: dnevnik krmilnikov (debug - vse, kar se je zgodilo na krmilniku)
--
-- fos_krmilnik_dnevnik  en dogodek na krmilniku: prebrana kartica, odgovor FIN:OS na žig, Info / Prekliči, izpad in
--                       vrnitev povezave, nastavitve, zagon programa, napake. Zapiše ga krmilnik (program 1.2.0+) v
--                       lokalno SQLite in ga pošlje prek /api/krmilnik ({ dnevnik: [...] }); isti lokalni_id se zapiše
--                       samo enkrat. Pregled: Nastavitve registracije -> Dnevnik krmilnikov.
--   vrsta        zagon | kartica | odgovor | info | preklic | povezava | nastavitve | ura | napaka
--   cas          čas na krmilniku; prejeto = ko ga je dobil FIN:OS (zaostanek = koliko je čakal v vrsti)
--   id_ziga      lokalni_id žiga (fos_dogodki.lokalni_id) - poveže "kartica" in "odgovor" istega žiga
--   uspeh        true / false / null (čaka - npr. kartica, preden pride odgovor)
--   podatki      vse ostalo (odgovor FIN:OS, časi čitalca / SD / strežnika, napaka ...)
--
-- Piše SAMO strežnik (service_role); aplikacija bere (Super Admin - politika fos_dostop za fos_ tabele).
-- Zaženi PO 021. Idempotentno.
-- =====================================================================

create table if not exists fos_krmilnik_dnevnik (
  id            bigint generated always as identity primary key,
  id_krmilnika  bigint not null references fos_krmilniki(id),
  lokalni_id    text not null,
  cas           timestamptz not null,
  prejeto       timestamptz not null default now(),
  vrsta         text not null,
  st_kartice    text,
  tipka         integer,
  id_ziga       text,
  uspeh         boolean,
  sporocilo     text,
  trajanje_ms   integer,
  podatki       jsonb not null default '{}'::jsonb,
  verzija       text,
  visible       boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create unique index if not exists fos_krmilnik_dnevnik_uq on fos_krmilnik_dnevnik (id_krmilnika, lokalni_id);
create index if not exists fos_krmilnik_dnevnik_cas on fos_krmilnik_dnevnik (cas desc);
create index if not exists fos_krmilnik_dnevnik_kartica on fos_krmilnik_dnevnik (st_kartice) where st_kartice is not null;
create index if not exists fos_krmilnik_dnevnik_zig on fos_krmilnik_dnevnik (id_ziga) where id_ziga is not null;

drop trigger if exists fos_krmilnik_dnevnik_updated_at on fos_krmilnik_dnevnik;
create trigger fos_krmilnik_dnevnik_updated_at before update on fos_krmilnik_dnevnik for each row execute function fos_set_updated_at();
alter table fos_krmilnik_dnevnik enable row level security;
drop policy if exists fos_krmilnik_dnevnik_select on fos_krmilnik_dnevnik;
create policy fos_krmilnik_dnevnik_select on fos_krmilnik_dnevnik for select to authenticated using (true);
-- dnevnik je zapis naprave - aplikacija ga samo bere
revoke all on fos_krmilnik_dnevnik from anon, authenticated;
grant select on fos_krmilnik_dnevnik to authenticated;
select fos_zasciti_tabelo('fos_krmilnik_dnevnik'::regclass);
