import type { Segment, Zig } from "./cas";
import { cezPolnoc, PRAVILA_DEJANSKO, type CasNastavitve, type Interval, type PravilaIntervala, type Statistika, type Urnik, type VrstaIntervala, type Zaokrozevanje } from "./casNastavitve";

/**
 * Knjiženje delovnega časa po pravilih intervalov (011, vrsta intervala 014). Krmilnik VEDNO zapiše dejanski čas
 * žiga; tu se izračuna, kaj se knjiži. Čista funkcija nad TRENUTNIMI nastavitvami - koledar, FIN:ME in Preizkus pravil
 * računajo enako.
 *
 * - Smer žiga je samodejna: odsoten -> prihod, prisoten -> izhod (žigi se izmenjujejo).
 * - Izmena = prihod brez tipke do izhoda brez tipke. Interval prihoda = prvi interval vrste Prihod (vrstni red seznama),
 *   ki velja na dan in v okno katerega pade prihod; sicer najbližje okno + NAPAKA (izmena se šteje normalno, dejanski čas).
 *   Pravila začetka (ne prej kot, zaokroževanje) so na intervalu prihoda.
 * - Izhod brez tipke konča izmeno: interval izhoda = prvi interval vrste Izhod, v okno katerega pade izhod; pravila konca
 *   (ne pozneje kot, zaokroževanje) in presežka so na njem. Izhod izven vseh oken izhoda: dejanski čas + NAPAKA.
 * - Žig s tipko odpre odsek intervala te tipke (vrsta Tipka) do naslednjega žiga; čas gre v statistiko intervala. OBA
 *   žiga (s tipko in vrnitev) morata biti v oknu intervala, sicer NAPAKA. Tipka brez intervala v urniku = NAPAKA.
 *   Seštej trajanje: vsi odseki tipke v dnevu skupaj do trajanje_max, preostanek gre v statistiko prekoračitve.
 * - Dnevni saldo = knjiženo delo - obveznost dneva (urnik). Presežek nad obveznostjo se prizna po pravilu intervala
 *   izhoda zadnje izmene (šteje / zaokroži navzdol / ne šteje); nepriznan presežek skrajša knjižen konec.
 * Kasneje: Dovolilnice izničijo napake in pravila (velja dejanski čas).
 */

const minut = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
};

export function zaokrozi(v: number, smer: Zaokrozevanje | null, korak: number) {
  if (!smer || korak <= 0) return v;
  const f = smer === "gor" ? Math.ceil : smer === "dol" ? Math.floor : Math.round;
  return f(v / korak) * korak;
}

type Okno = Pick<Interval, "cas_od" | "cas_do">;

/** Knjižen prihod: "ne prej kot", nato zaokroževanje. */
export function knjiziZacetek(t: number, p: PravilaIntervala & Okno) {
  let v = t;
  if (p.zacetek_ne_prej) {
    let ref = minut(p.zacetek_ne_prej);
    // okno čez polnoč (22:00-02:00, ne prej kot 00:30): meja je naslednji dan
    if (cezPolnoc(p) && ref < minut(p.cas_od) && t >= minut(p.cas_od)) ref += 1440;
    v = Math.max(v, ref);
  }
  return zaokrozi(v, p.zacetek_zaokrozi, p.zacetek_korak);
}

/** Knjižen izhod: "ne pozneje kot", nato zaokroževanje; nikoli pred knjiženim prihodom izmene. */
export function knjiziKonec(t: number, prihod: number, p: PravilaIntervala) {
  let v = t;
  if (p.konec_ne_pozneje) {
    let ref = minut(p.konec_ne_pozneje);
    if (ref < prihod) ref += 1440;
    v = Math.min(v, ref);
  }
  return Math.max(prihod, zaokrozi(v, p.konec_zaokrozi, p.konec_korak));
}

/** Del presežka nad obveznostjo, ki se prizna (gre v saldo). */
export function priznanPresezek(presezek: number, p: PravilaIntervala) {
  if (presezek <= 0) return presezek;
  if (p.presezek === "ne_steje") return 0;
  if (p.presezek === "zaokrozi") return Math.floor(presezek / p.presezek_korak) * p.presezek_korak;
  return presezek;
}

/** Ali čas (minute od polnoči) pade v okno intervala (meji vključeni). */
export function vOknu(t: number, iv: Okno) {
  const m = ((t % 1440) + 1440) % 1440;
  const od = minut(iv.cas_od);
  const doo = minut(iv.cas_do);
  return cezPolnoc(iv) ? m >= od || m <= doo : m >= od && m <= doo;
}

export const imaLastnost = (s: Statistika | undefined, koda: string, n: Pick<CasNastavitve, "lastnosti">) => !!s && s.lastnosti.some((id) => n.lastnosti.find((l) => l.id === id)?.koda === koda);

/** Intervali urnika na dan (v vrstnem redu seznama vseh intervalov - prvi ima prednost). */
export function intervaliDne(urnik: Urnik | null, idDneva: number | null, n: CasNastavitve) {
  if (!urnik || idDneva == null) return [];
  return n.intervali.filter((x) => x.visible && urnik.intervali.includes(x.id) && x.dnevi.includes(idDneva));
}

/** Interval, katerega okno je najbližje času (žig izven vseh oken - zamuda ostane v svoji izmeni). */
function najblizji(intervali: Interval[], t: number) {
  const m = ((t % 1440) + 1440) % 1440;
  const krozno = (a: number, b: number) => Math.min(Math.abs(a - b), 1440 - Math.abs(a - b));
  const razdalja = (iv: Interval) => Math.min(krozno(m, minut(iv.cas_od)), krozno(m, minut(iv.cas_do)));
  return [...intervali].sort((a, b) => razdalja(a) - razdalja(b))[0] ?? null;
}

/**
 * Napaka knjiženja (Dovolilnice jih kasneje izničijo):
 * prihod / izhod izven okna, prihod na dan brez intervala prihoda, žig tipke izven okna, tipka brez intervala v urniku.
 */
export type NapakaKnjizenja = { tip: "prihod" | "izhod" | "brez_intervala" | "tipka_okno" | "tipka_brez_intervala"; cas: number; interval: Interval | null; tipka?: number };

export type ZigKnjizen = Zig & {
  smer: "prihod" | "odhod";
  /** Čas po pravilih (enak dejanskemu, če pravilo ne velja). */
  knjizen: number;
  /** Statistika intervala tipke (žig s tipko) ali null. */
  id_statistike: number | null;
  /** Vloga žiga: začetek izmene, konec izmene, žig s tipko ali povratek s tipke. */
  vloga: "prihod" | "izhod" | "tipka" | "povratek";
  /** Interval, po katerem se žig knjiži (prihod / izhod / tipka; pri povratku interval tipke) ali null. */
  interval: Interval | null;
  /** Statistika odseka, ki se začne s tem žigom (null = odsoten). */
  odsek: number | null;
};

export type Knjizenje = {
  zigi: ZigKnjizen[];
  segmenti: Segment[];
  /** Interval prihoda prve izmene. */
  interval: Interval | null;
  napake: NapakaKnjizenja[];
  /** Pretečen dan, ki se konča s prihodom (pozabljen izhod). */
  manjkaOdhod: boolean;
  /** Danes: oseba je na delu ali na izhodu s tipko - dan še ni zaključen. */
  odprt: boolean;
  /** Knjiženo delo (minute, statistike z lastnostjo "Štej v delovno obveznost"). */
  delo: number;
  /** Nepriznan presežek (minute), ki ga je odrezalo pravilo. */
  nepriznano: number;
  /** Čas tipk nad seštetim trajanjem (minute), ki je šel v statistiko prekoračitve. */
  prekoraceno: number;
};

type Vhod = {
  urnik: Urnik | null;
  idDneva: number | null;
  /** Obveznost dneva v minutah ali null (brez urnika - presežek se ne računa). */
  obveznost: number | null;
  odsotnost: { id_statistike: number; od: number; do: number } | null;
  /** Minute od polnoči, samo za danes (odprti odseki se rišejo do zdaj). */
  zdajMin: number | null;
  danes: boolean;
  n: CasNastavitve;
};

export function knjizi(vhod: Zig[], o: Vhod): Knjizenje {
  const { n } = o;
  const stat = (id: number) => n.statistike.find((s) => s.id === id);
  const steje = (id: number) => imaLastnost(stat(id), "delovna_obveznost", n);
  const dne = intervaliDne(o.urnik, o.idDneva, n);
  const vsiUrnika = o.urnik ? n.intervali.filter((x) => x.visible && o.urnik!.intervali.includes(x.id)) : [];
  const vrste = (seznam: Interval[], v: VrstaIntervala) => seznam.filter((x) => x.vrsta === v);
  // samodejni prihod / izhod (brez tipke); s tipko (npr. Izredno) se izbere samo s tipko
  const prihodiDne = vrste(dne, "prihod").filter((x) => x.id_tipke == null);
  const izhodiDne = vrste(dne, "izhod").filter((x) => x.id_tipke == null);
  const privzeta = n.statistike.find((s) => s.visible && imaLastnost(s, "delovna_obveznost", n))?.id ?? null;
  const stTipke = (id: number) => n.tipke.find((t) => t.id === id)?.tipka;
  // interval žiga s tipko: prihod / izhod s to tipko (po smeri, npr. Izredno), sicer odsotnost (vrsta Tipka);
  // najprej intervali dne (in v oknu), nato ostali iz urnika
  const sTipko = (seznam: Interval[], v: VrstaIntervala, idTipke: number) => seznam.filter((x) => x.vrsta === v && x.id_tipke === idTipke);
  const intervalTipke = (idTipke: number, smer: "prihod" | "odhod", t: number) => {
    for (const v of [smer === "prihod" ? "prihod" : "izhod", "tipka"] as const) {
      const kandidati = sTipko(dne, v, idTipke);
      const iv = kandidati.find((x) => vOknu(t, x)) ?? kandidati[0] ?? sTipko(vsiUrnika, v, idTipke)[0];
      if (iv) return iv;
    }
    return null;
  };

  // smer: žigi se izmenjujejo (odsoten -> prihod, prisoten -> izhod)
  const zigi: ZigKnjizen[] = [...vhod]
    .sort((a, b) => a.cas - b.cas)
    .map((z, i) => {
      const smer = i % 2 === 0 ? "prihod" : "odhod";
      const iv = z.id_tipke != null ? intervalTipke(z.id_tipke, smer, z.cas) : null;
      const vloga = iv?.vrsta === "prihod" ? "prihod" : iv?.vrsta === "izhod" ? "izhod" : z.id_tipke != null ? "tipka" : smer === "prihod" ? "prihod" : "izhod";
      return { ...z, smer, knjizen: z.cas, id_statistike: vloga === "tipka" ? (iv?.id_statistike ?? null) : null, vloga, interval: iv, odsek: null };
    });

  // izmene: interval prihoda in izhoda; začetek / konec po pravilih
  const napake: NapakaKnjizenja[] = [];
  const izmenaZiga: (Interval | null)[] = []; // interval prihoda izmene, v kateri je žig
  const stIzmeneZiga: number[] = []; // zaporedna številka izmene žiga (presežek po izmenah)
  const izhodIzmene = new Map<number, Interval>(); // interval izhoda po izmeni (pravilo presežka)
  let prvi: Interval | null = null;
  let izmena: Interval | null = null;
  let stIzmene = -1;
  let prihodIzmene = 0;
  for (let i = 0; i < zigi.length; i++) {
    const z = zigi[i];
    const prej = zigi[i - 1];
    // začetek izmene: prihod, pred katerim ni odsotnosti s tipko (sicer je to povratek)
    const zacetek = z.smer === "prihod" && (i === 0 || prej.vloga !== "tipka");
    if (zacetek) stIzmene++;
    if (zacetek && z.vloga === "prihod") {
      // prihod s tipko (npr. Izredno) = njegov interval, brez tipke = samodejni prihod
      const kandidati = z.id_tipke != null ? [z.interval!] : prihodiDne;
      const najden = kandidati.find((x) => vOknu(z.cas, x)) ?? null;
      izmena = najden ?? (z.id_tipke != null ? z.interval : najblizji(prihodiDne.length ? prihodiDne : vrste(vsiUrnika, "prihod").filter((x) => x.id_tipke == null), z.cas));
      prvi ??= izmena;
      z.interval = izmena;
      if (najden) z.knjizen = knjiziZacetek(z.cas, najden);
      else if (o.urnik) napake.push({ tip: kandidati.length ? "prihod" : "brez_intervala", cas: z.cas, interval: izmena });
      prihodIzmene = z.knjizen;
    } else if (zacetek) prihodIzmene = z.cas; // prihod s tipko odsotnosti (npr. delo od doma) začne izmeno v statistiki tipke
    else if (z.smer === "prihod") {
      z.vloga = "povratek";
      z.interval = prej.interval;
    } else if (z.vloga === "izhod") {
      // izhod s tipko (npr. Izredno) = njegov interval, brez tipke = samodejni izhod
      const kandidati = z.id_tipke != null ? [z.interval!] : izhodiDne;
      const najden = kandidati.find((x) => vOknu(z.cas, x)) ?? null;
      z.interval = najden ?? (z.id_tipke != null ? z.interval : izhodiDne.length ? najblizji(izhodiDne, z.cas) : null);
      if (najden) {
        z.knjizen = knjiziKonec(z.cas, prihodIzmene, najden);
        izhodIzmene.set(stIzmene, najden);
      } else if (kandidati.length) napake.push({ tip: "izhod", cas: z.cas, interval: z.interval });
    }
    // odsotnost s tipko: oba žiga odseka (tipka in vrnitev) v oknu intervala tipke
    if (z.vloga === "tipka" && z.id_tipke != null) {
      const iv = z.interval;
      const naslednji = zigi[i + 1];
      if (!iv) napake.push({ tip: "tipka_brez_intervala", cas: z.cas, interval: null, tipka: stTipke(z.id_tipke) });
      else if (!vOknu(z.cas, iv)) napake.push({ tip: "tipka_okno", cas: z.cas, interval: iv, tipka: stTipke(z.id_tipke) });
      else if (naslednji && !vOknu(naslednji.cas, iv)) napake.push({ tip: "tipka_okno", cas: naslednji.cas, interval: iv, tipka: stTipke(z.id_tipke) });
    }
    izmenaZiga.push(izmena);
    stIzmeneZiga.push(stIzmene);
  }

  // odseki: žig s tipko -> statistika tipke; prihod brez tipke -> delo izmene; izhod brez tipke -> odsoten
  const segmenti: Segment[] = [];
  const zapira: number[] = []; // indeks žiga, ki zaključi odsek (za skrajšanje konca)
  const odsekTipke: (Interval | null)[] = [];
  const odsekIzmene: number[] = []; // izmena odseka (-1 = celodnevna odsotnost)
  if (o.odsotnost) {
    // celodnevna odsotnost pokrije obveznost dneva
    const dolzina = o.obveznost || o.odsotnost.do - o.odsotnost.od;
    segmenti.push({ od: o.odsotnost.od, do: o.odsotnost.od + dolzina, id_statistike: o.odsotnost.id_statistike, celodnevno: true });
    zapira.push(-1);
    odsekTipke.push(null);
    odsekIzmene.push(-1);
  }
  for (let i = 0; i < zigi.length; i++) {
    const z = zigi[i];
    const naslednji = zigi[i + 1];
    const delo = z.smer === "prihod" ? (izmenaZiga[i]?.id_statistike ?? privzeta) : null;
    const id = z.vloga === "tipka" ? (z.id_statistike ?? delo) : delo;
    z.odsek = id;
    const konec = naslednji ? naslednji.knjizen : o.zdajMin;
    if (id == null || konec == null || konec <= z.knjizen) continue;
    segmenti.push({ od: z.knjizen, do: konec, id_statistike: id, odprt: !naslednji });
    zapira.push(naslednji ? i + 1 : -1);
    odsekTipke.push(z.vloga === "tipka" && z.id_statistike != null ? z.interval : null);
    odsekIzmene.push(stIzmeneZiga[i]);
  }

  // seštej trajanje tipke: vsi odseki intervala skupaj do trajanje_max, preostanek v statistiko prekoračitve
  let prekoraceno = 0;
  const porabljeno = new Map<number, number>();
  for (let k = 0; k < segmenti.length; k++) {
    const iv = odsekTipke[k];
    if (!iv || iv.trajanje_max == null || iv.id_statistike_prekoracitve == null) continue;
    const s = segmenti[k];
    const ostane = Math.max(0, iv.trajanje_max - (porabljeno.get(iv.id) ?? 0));
    porabljeno.set(iv.id, (porabljeno.get(iv.id) ?? 0) + Math.min(ostane, s.do - s.od));
    if (s.do - s.od <= ostane) continue;
    const meja = s.od + ostane;
    prekoraceno += s.do - meja;
    segmenti.splice(k + 1, 0, { od: meja, do: s.do, id_statistike: iv.id_statistike_prekoracitve, odprt: s.odprt });
    zapira.splice(k + 1, 0, zapira[k]);
    odsekTipke.splice(k + 1, 0, null);
    odsekIzmene.splice(k + 1, 0, odsekIzmene[k]);
    s.do = meja;
    s.odprt = false;
    zapira[k] = -1;
    k++;
  }

  const zadnji = zigi.at(-1);
  const odprt = o.danes && !!zadnji && (zadnji.smer === "prihod" || zadnji.vloga === "tipka");
  const manjkaOdhod = !o.danes && zadnji?.smer === "prihod";
  let delo = segmenti.reduce((v, s) => v + (steje(s.id_statistike) ? s.do - s.od : 0), 0);

  // presežek nad obveznostjo PO IZMENAH (kot stari sistem): izmene po vrsti seštevajo delo; presežek, ki ga ustvari izmena,
  // se prizna po pravilu NJENEGA izhoda (npr. delo od doma brez zaokroževanja); nepriznani del skrajša njene zadnje odseke
  let nepriznano = 0;
  if (o.obveznost != null && !odprt && delo > o.obveznost) {
    const dolzina = (k: number) => (steje(segmenti[k].id_statistike) ? segmenti[k].do - segmenti[k].od : 0);
    let skupaj = segmenti.reduce((v, _, k) => v + (odsekIzmene[k] < 0 ? dolzina(k) : 0), 0);
    for (const st of [...new Set(odsekIzmene.filter((x) => x >= 0))]) {
      const ks = segmenti.map((_, k) => k).filter((k) => odsekIzmene[k] === st);
      const d = ks.reduce((v, k) => v + dolzina(k), 0);
      const presezek = Math.max(0, skupaj + d - o.obveznost) - Math.max(0, skupaj - o.obveznost);
      skupaj += d;
      if (presezek <= 0) continue;
      let ostane = presezek - priznanPresezek(presezek, izhodIzmene.get(st) ?? PRAVILA_DEJANSKO);
      nepriznano += ostane;
      for (const k of ks.reverse()) {
        if (ostane <= 0) break;
        const s = segmenti[k];
        if (!steje(s.id_statistike)) continue;
        const vzemi = Math.min(ostane, s.do - s.od);
        s.do -= vzemi;
        ostane -= vzemi;
        if (zapira[k] >= 0) zigi[zapira[k]].knjizen = s.do;
      }
    }
    delo -= nepriznano;
  }

  return { zigi, segmenti: segmenti.filter((s) => s.do > s.od), interval: prvi, napake, manjkaOdhod, odprt, delo, nepriznano, prekoraceno };
}

/** Preizkus intervala prihoda: knjižen prihod po pravilih začetka (izven okna = dejanski čas + napaka). */
export function preizkusiPrihod(prihod: number, iv: PravilaIntervala & Okno) {
  const vOknuJe = vOknu(prihod, iv);
  return { vOknu: vOknuJe, knjizen: vOknuJe ? knjiziZacetek(prihod, iv) : prihod };
}

/** Preizkus intervala izhoda: knjižen odhod, delo in saldo za izmeno prihod-odhod (prihod se knjiži dejansko). */
export function preizkusiIzhod(prihod: number, odhod: number, iv: PravilaIntervala & Okno, obveznost: number) {
  const vOknuJe = vOknu(odhod, iv);
  let konec = vOknuJe ? knjiziKonec(odhod, prihod, iv) : Math.max(prihod, odhod);
  const presezek = konec - prihod - obveznost;
  const nepriznano = presezek > 0 ? presezek - priznanPresezek(presezek, iv) : 0;
  konec -= nepriznano;
  const delo = konec - prihod;
  return { vOknu: vOknuJe, konec, delo, nepriznano, saldo: delo - obveznost };
}

/** Preizkus intervala tipke: en odsek (žig s tipko -> vrnitev); trajanje do meje in prekoračitev. */
export function preizkusiTipko(od: number, doo: number, iv: PravilaIntervala & Okno) {
  const trajanje = Math.max(0, doo - od);
  const vStatistiki = iv.trajanje_max != null ? Math.min(trajanje, iv.trajanje_max) : trajanje;
  return { odVOknu: vOknu(od, iv), doVOknu: vOknu(doo, iv), trajanje, vStatistiki, prekoraceno: trajanje - vStatistiki };
}
