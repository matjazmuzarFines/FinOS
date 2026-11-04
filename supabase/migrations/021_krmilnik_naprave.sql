-- =====================================================================
-- FIN:OS | 021: krmilniki (naprave Raspberry Pi) in žigi s krmilnika
--
-- fos_krmilniki         naprave: ime, lokacija, zgoščen ključ (sha256 - pravega ključa baza ne hrani), zadnji stik,
--                       verzija programa. Ključ ustvari fos_nova_naprava / fos_nov_kljuc_naprave in se pokaže SAMO enkrat
--                       (Nastavitve -> Krmilnik -> Naprave), vpiše se v config.json na krmilniku.
-- fos_dogodki           + id_krmilnika, lokalni_id (id žiga na napravi): isti žig, poslan večkrat (ponovni poskus po
--                       izpadu wifija), se zapiše samo enkrat.
--
-- Krmilnik NE dostopa do baze neposredno: kliče FIN:OS /api/krmilnik s svojim ključem, strežnik (service_role) kliče
-- fos_krmilnik_zig / fos_krmilnik_info. Ukraden ključ zna samo štempljati - ne bere in ne spreminja ničesar drugega;
-- ključ se v Nastavitvah zamenja ali naprava onemogoči.
--
-- Kartica: primerja se brez vodilnih ničel (čitalec pošlje 0003207141, v bazi je 3207141). Neznana kartica se vseeno
-- zapiše (samo st_kartice) - Administracija jo kasneje dodeli zaposlenemu.
-- Dan žiga = dan prihoda: odhod po polnoči ostane v dnevu prihoda (včeraj liho število žigov, zadnji v zadnjih 16 h).
--
-- Zaženi PO 020. Idempotentno.
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

create table if not exists fos_krmilniki (
  id            bigint generated always as identity primary key,
  ime           text not null check (btrim(ime) <> ''),
  lokacija      text not null default '',
  kljuc_hash    text not null,
  zadnji_stik   timestamptz,
  verzija       text,
  visible       boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create unique index if not exists fos_krmilniki_kljuc_uq on fos_krmilniki (kljuc_hash);

drop trigger if exists fos_krmilniki_updated_at on fos_krmilniki;
create trigger fos_krmilniki_updated_at before update on fos_krmilniki for each row execute function fos_set_updated_at();
alter table fos_krmilniki enable row level security;
drop policy if exists fos_krmilniki_select on fos_krmilniki;
create policy fos_krmilniki_select on fos_krmilniki for select to authenticated using (true);
drop policy if exists fos_krmilniki_update on fos_krmilniki;
create policy fos_krmilniki_update on fos_krmilniki for update to authenticated using (true) with check (true);
-- novo napravo in ključ ustvari samo funkcija (ključ se ne sme dati izbrati); ključa (hash) aplikacija ne bere
revoke all on fos_krmilniki from anon, authenticated;
grant select (id, ime, lokacija, zadnji_stik, verzija, visible, created_at, updated_at) on fos_krmilniki to authenticated;
grant update (ime, lokacija, visible) on fos_krmilniki to authenticated;
select fos_zasciti_tabelo('fos_krmilniki'::regclass);

alter table fos_dogodki add column if not exists id_krmilnika bigint references fos_krmilniki(id);
alter table fos_dogodki add column if not exists lokalni_id text;
create unique index if not exists fos_dogodki_krmilnik_uq on fos_dogodki (id_krmilnika, lokalni_id) where lokalni_id is not null;

-- ---------------------------------------------------------------------
-- Naprava in ključ (Administracija)
-- ---------------------------------------------------------------------
create or replace function fos_nov_kljuc()
returns text
language sql
volatile
set search_path = public, extensions
as $$
  select 'fk_' || encode(gen_random_bytes(24), 'hex');
$$;
revoke all on function fos_nov_kljuc() from public, anon, authenticated;

create or replace function fos_hash_kljuca(p_kljuc text)
returns text
language sql
immutable
set search_path = public, extensions
as $$
  select encode(digest(p_kljuc, 'sha256'), 'hex');
$$;
revoke all on function fos_hash_kljuca(text) from public, anon, authenticated;

-- Nova naprava: vrne ključ (pokaže se samo enkrat).
create or replace function fos_nova_naprava(p_ime text, p_lokacija text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  k text := fos_nov_kljuc();
begin
  if not fos_ureja_fin_os() then raise exception 'Napravo doda samo Administracija (Super Admin).'; end if;
  insert into fos_krmilniki (ime, lokacija, kljuc_hash) values (btrim(p_ime), coalesce(btrim(p_lokacija), ''), fos_hash_kljuca(k));
  return k;
end;
$$;

-- Nov ključ obstoječe naprave (star preneha delovati takoj).
create or replace function fos_nov_kljuc_naprave(p_id bigint)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  k text := fos_nov_kljuc();
begin
  if not fos_ureja_fin_os() then raise exception 'Ključ zamenja samo Administracija (Super Admin).'; end if;
  update fos_krmilniki set kljuc_hash = fos_hash_kljuca(k) where id = p_id;
  if not found then raise exception 'Naprave ni.'; end if;
  return k;
end;
$$;

revoke all on function fos_nova_naprava(text, text) from public, anon;
revoke all on function fos_nov_kljuc_naprave(bigint) from public, anon;
grant execute on function fos_nova_naprava(text, text) to authenticated;
grant execute on function fos_nov_kljuc_naprave(bigint) to authenticated;

-- ---------------------------------------------------------------------
-- Žig s krmilnika (kliče samo strežnik - service_role)
-- ---------------------------------------------------------------------
create or replace function fos_kartica(p_st_kartice text)
returns bigint
language sql
stable
set search_path = public
as $$
  select id from fos_zaposleni
  where visible and st_kartice is not null and ltrim(btrim(st_kartice), '0') = ltrim(btrim(p_st_kartice), '0')
  order by id limit 1;
$$;
revoke all on function fos_kartica(text) from public, anon, authenticated;

-- Vrne: ok, ime, priimek (če je kartica znana), smer (prihod / odhod - samo za pozdrav na zaslonu), akcija.
-- Tipka s funkcijo "preklici" spregleda zadnji žig te kartice na tem krmilniku v zadnjih 5 min.
create or replace function fos_krmilnik_zig(p_id_krmilnika bigint, p_lokalni_id text, p_st_kartice text, p_cas timestamptz, p_tipka integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  zap bigint := fos_kartica(p_st_kartice);
  t fos_tipke;
  dan date := (p_cas at time zone 'Europe/Ljubljana')::date;
  obstojec bigint;
  preklican bigint;
  stevilo integer;
  oseba record;
begin
  update fos_krmilniki set zadnji_stik = now() where id = p_id_krmilnika;
  select ime, priimek into oseba from fos_zaposleni where id = zap;

  if p_tipka is not null then
    select * into t from fos_tipke where visible and tipka = p_tipka limit 1;
    if not found then return jsonb_build_object('ok', false, 'napaka', 'Neznana tipka ' || p_tipka); end if;
  end if;

  if t.funkcija = 'preklici' then
    select id into preklican from fos_dogodki
    where id_krmilnika = p_id_krmilnika and visible and not spregledan and ltrim(st_kartice, '0') = ltrim(btrim(p_st_kartice), '0')
      and cas > p_cas - interval '5 minutes' and cas <= p_cas + interval '1 minute'
    order by cas desc limit 1;
    if preklican is null then return jsonb_build_object('ok', false, 'napaka', 'Ni žiga za preklic', 'ime', oseba.ime); end if;
    update fos_dogodki set spregledan = true, spregledano_ob = now(), komentar = 'Preklic na krmilniku' where id = preklican;
    return jsonb_build_object('ok', true, 'akcija', 'preklic', 'ime', oseba.ime, 'priimek', oseba.priimek);
  end if;
  if t.funkcija = 'info' then
    return fos_krmilnik_info(p_st_kartice, p_cas);
  end if;

  -- isti žig že zapisan (ponovno poslan)
  select id into obstojec from fos_dogodki where id_krmilnika = p_id_krmilnika and lokalni_id = p_lokalni_id;
  if obstojec is null then
    if zap is not null and (select count(*) % 2 = 1 and max(cas) > p_cas - interval '16 hours'
        from fos_dogodki where id_zaposlenega = zap and visible and not spregledan and datum = dan - 1) then
      dan := dan - 1;
    end if;
    insert into fos_dogodki (id_zaposlenega, st_kartice, cas, datum, id_tipke, vir, id_krmilnika, lokalni_id, vnesel)
    values (zap, btrim(p_st_kartice), p_cas, dan, t.id, 'krmilnik', p_id_krmilnika, p_lokalni_id, null)
    on conflict do nothing;
  else
    select datum into dan from fos_dogodki where id = obstojec;
  end if;

  if zap is null then
    return jsonb_build_object('ok', true, 'akcija', 'zig', 'znana', false);
  end if;
  select count(*) into stevilo from fos_dogodki where id_zaposlenega = zap and datum = dan and visible and not spregledan and cas <= p_cas;
  return jsonb_build_object('ok', true, 'akcija', 'zig', 'znana', true, 'ime', oseba.ime, 'priimek', oseba.priimek,
                            'smer', case when stevilo % 2 = 1 then 'prihod' else 'odhod' end, 'tipka', t.besedilo);
end;
$$;

-- Info (tipka Info): današnji žigi kartice. Saldo bo dodan kasneje (izračun je v aplikaciji).
create or replace function fos_krmilnik_info(p_st_kartice text, p_cas timestamptz)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  zap bigint := fos_kartica(p_st_kartice);
  oseba record;
  dan date := (p_cas at time zone 'Europe/Ljubljana')::date;
begin
  if zap is null then return jsonb_build_object('ok', false, 'napaka', 'Neznana kartica'); end if;
  select ime, priimek into oseba from fos_zaposleni where id = zap;
  return jsonb_build_object(
    'ok', true, 'akcija', 'info', 'znana', true, 'ime', oseba.ime, 'priimek', oseba.priimek,
    'zigi', coalesce((
      select jsonb_agg(jsonb_build_object('cas', to_char(d.cas at time zone 'Europe/Ljubljana', 'HH24:MI'), 'tipka', tk.besedilo) order by d.cas)
      from fos_dogodki d left join fos_tipke tk on tk.id = d.id_tipke
      where d.id_zaposlenega = zap and d.visible and not d.spregledan and d.datum in (dan, dan - 1)
        and d.cas > (p_cas - interval '20 hours')
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function fos_krmilnik_zig(bigint, text, text, timestamptz, integer) from public, anon, authenticated;
revoke all on function fos_krmilnik_info(text, timestamptz) from public, anon, authenticated;
grant execute on function fos_krmilnik_zig(bigint, text, text, timestamptz, integer) to service_role;
grant execute on function fos_krmilnik_info(text, timestamptz) to service_role;

-- Preverjanje
select 'fos_krmilniki' as tabela, count(*) from fos_krmilniki where visible;
