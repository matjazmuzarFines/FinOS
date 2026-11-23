-- =====================================================================
-- FIN:OS | 031: FIN:TV - nova komponenta "Prioritete krovnih" (po oddelkih)
-- Zaženi v Supabase -> SQL Editor (po 030). Idempotentno.
--
-- fp_prioritete_krovnih_p / _m / _e / _t (za vsak oddelek svoja): za VSAK krovni nalog iz delovnega plana oddelka (z
-- odprtimi kosi) vse odpreme, ki čakajo nanj - datum odpreme, kosi, družina, kupec, stanje (zamuja / danes / čez N dni).
-- Enaka razdelitev naročil kot na strani Prioritete v Production (potrjena naročila, FIFO po datumu odpreme).
-- Animirana objava (030, podatki): ena scena na krovni, daljši seznam odprem gre čez več utripov (nič se ne odreže).
-- Production objavi po uvozu naročil (VD200), odprem (VD300), nalogov ali materiala, po Shrani plan in z gumbom Sync v TV;
-- velja 3 dni (nova objava zamenja prejšnjo).
-- =====================================================================

insert into fos_tv_viri (koda, ime, opis, aplikacija, ikona, vrstni_red) values
  ('fp_prioritete_krovnih_p', 'Prioritete krovnih · Proizvodnja', 'Za vsak krovni nalog iz delovnega plana vse odpreme, ki čakajo nanj: kdaj gre katero naročilo ven, koliko kosov, stanje. Objavi se ob syncu naročil, odprem, nalogov in materiala.', 'fp', 'Truck', 21),
  ('fp_prioritete_krovnih_m', 'Prioritete krovnih · Montaža', 'Za vsak krovni nalog iz delovnega plana vse odpreme, ki čakajo nanj: kdaj gre katero naročilo ven, koliko kosov, stanje. Objavi se ob syncu naročil, odprem, nalogov in materiala.', 'fp', 'Truck', 22),
  ('fp_prioritete_krovnih_e', 'Prioritete krovnih · Elektro', 'Za vsak krovni nalog iz delovnega plana vse odpreme, ki čakajo nanj: kdaj gre katero naročilo ven, koliko kosov, stanje. Objavi se ob syncu naročil, odprem, nalogov in materiala.', 'fp', 'Truck', 23),
  ('fp_prioritete_krovnih_t', 'Prioritete krovnih · Testiranje', 'Za vsak krovni nalog iz delovnega plana vse odpreme, ki čakajo nanj: kdaj gre katero naročilo ven, koliko kosov, stanje. Objavi se ob syncu naročil, odprem, nalogov in materiala.', 'fp', 'Truck', 24)
on conflict (koda) do nothing;

select koda, ime, vklopljen, visible, vrstni_red from fos_tv_viri where visible order by vrstni_red;
