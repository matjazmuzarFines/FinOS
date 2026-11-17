-- =====================================================================
-- FIN:OS | 029: FIN:TV - nova komponenta "Pripravljenost materiala" (po oddelkih)
-- Zaženi v Supabase -> SQL Editor (po 028). Idempotentno.
--
-- fp_pripravljenost_mat_p / _m / _e / _t (za vsak oddelek svoja): za vsak krovni nalog iz delovnega plana oddelka
-- stran 16:9 z materialom, ki ni na zalogi (šifra, material, količina, naročilo, prihod, stanje); krovni z vsem
-- materialom v hiši so na zbirni strani. Production jo objavi po uvozu izdaj, materiala, naročil dobavitelju ali
-- delovnih nalogov (Sync), po Shrani plan in z gumbom Sync v TV; strani veljajo 3 dni (nova objava zamenja prejšnjo).
-- =====================================================================

insert into fos_tv_viri (koda, ime, opis, aplikacija, ikona, vrstni_red) values
  ('fp_pripravljenost_mat_p', 'Pripravljenost materiala · Proizvodnja', 'Za vsak krovni nalog iz delovnega plana material, ki ni na zalogi, in kdaj pride (naročila dobaviteljem). Objavi se ob syncu izdaj, materiala in naročil.', 'fp', 'PackageCheck', 17),
  ('fp_pripravljenost_mat_m', 'Pripravljenost materiala · Montaža', 'Za vsak krovni nalog iz delovnega plana material, ki ni na zalogi, in kdaj pride (naročila dobaviteljem). Objavi se ob syncu izdaj, materiala in naročil.', 'fp', 'PackageCheck', 18),
  ('fp_pripravljenost_mat_e', 'Pripravljenost materiala · Elektro', 'Za vsak krovni nalog iz delovnega plana material, ki ni na zalogi, in kdaj pride (naročila dobaviteljem). Objavi se ob syncu izdaj, materiala in naročil.', 'fp', 'PackageCheck', 19),
  ('fp_pripravljenost_mat_t', 'Pripravljenost materiala · Testiranje', 'Za vsak krovni nalog iz delovnega plana material, ki ni na zalogi, in kdaj pride (naročila dobaviteljem). Objavi se ob syncu izdaj, materiala in naročil.', 'fp', 'PackageCheck', 20)
on conflict (koda) do nothing;

select koda, ime, vklopljen, visible, vrstni_red from fos_tv_viri where visible order by vrstni_red;
