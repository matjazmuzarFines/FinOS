import { danVTednu, izCasa, stTedna, type DanPodatki, type Oznaka, type Zig } from "./cas";
import { imePraznika, urnikZaposlenega, veljaNa, type CasNastavitve, type Interval } from "./casNastavitve";

/**
 * TESTNA ŠTEMPLJANJA za koledar (samo UI, nič ni v bazi). Vedno enaka za isto osebo in dan (psevdonaključno iz id + datum).
 * Prihod je v oknu intervala (cas_od-cas_do) urnika zaposlenega (Urniki zaposlenih; brez urnika privzeto 06:00-09:00).
 * Ko bo baza štempljanj potrjena, se ta datoteka zamenja z branjem iz baze.
 */

function nakljucje(seme: number) {
  let a = seme >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const seme = (...deli: (string | number)[]) => [...deli.join("|")].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619), 2166136261);

/** Testno trajanje dela od prihoda (kasneje iz urnika in pogodbe). */
const DELOVNIK = 8 * 60;

/** Urnik zaposlenega: iz baze (Urniki zaposlenih); brez baze 010 testno (id % število urnikov). */
export function testniUrnik(idZaposlenega: number, n: CasNastavitve) {
  if (n.virUrnikov === "baza") return urnikZaposlenega(idZaposlenega, n);
  const urniki = n.urniki.filter((u) => u.visible);
  return urniki.length ? urniki[idZaposlenega % urniki.length] : null;
}

/** Zaposleni brez urnika: testna štempljanja po privzetem oknu (samo za prikaz koledarja). */
const PRIVZETI: Interval = { id: 0, ime: "PRIVZETO", prikazno_ime: "Prihod", opis: "", cas_od: "06:00", cas_do: "09:00", velja_od: null, velja_do: null, dnevi: [], id_statistike: null, visible: true };

/** Interval urnika, ki velja na datum (pri dveh izmenah se izmenjujeta po tednih). */
export function intervalNaDan(idZaposlenega: number, datum: string, n: CasNastavitve): Interval | null {
  const urnik = testniUrnik(idZaposlenega, n);
  const dan = danVTednu(datum);
  if (!urnik) return dan <= 5 && !imePraznika(datum, n) ? PRIVZETI : null;
  const idDneva = imePraznika(datum, n) ? n.dnevi.find((d) => d.iso == null)?.id : n.dnevi.find((d) => d.iso === dan)?.id;
  const kandidati = urnik.intervali
    .map((id) => n.intervali.find((x) => x.id === id && x.visible))
    .filter((x): x is Interval => !!x && idDneva != null && x.dnevi.includes(idDneva) && veljaNa(x, datum));
  if (!kandidati.length) return null;
  // ožji interval (npr. poletni petek) ima prednost pred splošnim
  const ozji = kandidati.filter((x) => x.velja_do);
  const izbor = ozji.length ? ozji : kandidati;
  return izbor[(stTedna(datum) + idZaposlenega) % izbor.length];
}

const PRAZEN: DanPodatki = { zigi: [], odsotnost: null, oznake: [] };

export function testniDan(idZaposlenega: number, datum: string, n: CasNastavitve, danes: string, zdajMin: number): DanPodatki {
  if (datum > danes) return PRAZEN;
  const iv = intervalNaDan(idZaposlenega, datum, n);
  if (!iv) return PRAZEN;
  const stat = (koda: string) => n.statistike.find((s) => s.koda === koda && s.visible)?.id ?? null;
  const r = nakljucje(seme(idZaposlenega, datum));
  const rTeden = nakljucje(seme(idZaposlenega, datum.slice(0, 4), stTedna(datum)));
  const dan = danVTednu(datum);
  const prost = dan >= 6 || !!imePraznika(datum, n);

  const od = izCasa(iv.cas_od);
  const okno = (izCasa(iv.cas_do) - od + 1440) % 1440; // okno čez polnoč: 22:00-02:00 = 240 min
  const delovna = iv.id_statistike ?? stat("DELO");
  if (prost && r() < 0.6) return PRAZEN; // dežurstvo / sobotna izmena: samo vsak drugi

  // celodnevne odsotnosti v blokih po tednih (prikaz od začetka okna, trajanje delovnika)
  const tipTedna = rTeden();
  const odDne = 1 + Math.floor(rTeden() * 3);
  const doDne = odDne + Math.floor(rTeden() * 3);
  const vBloku = !prost && dan >= odDne && dan <= doDne;
  const odsotnost = (koda: string): DanPodatki | null => {
    const id = stat(koda);
    return id ? { zigi: [], odsotnost: { id_statistike: id, od, do: od + DELOVNIK }, oznake: [] } : null;
  };
  if (vBloku && tipTedna < 0.08) return odsotnost("BOL") ?? PRAZEN;
  if (vBloku && tipTedna < 0.17) return odsotnost(tipTedna < 0.13 ? "DOP" : "LDOP") ?? PRAZEN;

  const x = r();
  if (!prost && x < 0.035) return PRAZEN; // pozabil štempljati -> "Ni vnosa"
  if (!prost && x < 0.05) return odsotnost("SLP") ?? PRAZEN;
  if (!prost && x < 0.058) return odsotnost("IZS") ?? PRAZEN;
  if (!prost && x < 0.066) return odsotnost("IZD") ?? PRAZEN;

  const zigi: Zig[] = [];
  const oznake: Oznaka[] = [];
  const domov = !prost && x < 0.16 && stat("DOM") != null;
  const vir = domov ? "online" : "krmilnik";
  const prihod = od + Math.round(r() * okno);
  let odhod = prihod + DELOVNIK + Math.round(r() * 30 - 5);
  if (!domov && r() < 0.07) odhod = prihod + 12 * 60 + Math.round(r() * 40); // dolg dan -> 2 malici
  zigi.push({ cas: prihod, smer: "prihod", id_statistike: domov ? stat("DOM") : delovna, vir });

  // malica (štempljana), zasebni ali službeni izhod
  if (!domov && r() < 0.45 && stat("MAL")) {
    const m = prihod + 180 + Math.round(r() * 60);
    zigi.push({ cas: m, smer: "odhod", id_statistike: stat("MAL"), vir }, { cas: m + 25 + Math.round(r() * 10), smer: "prihod", id_statistike: delovna, vir });
  }
  const izhod = r();
  if (!domov && izhod < 0.3) {
    const koda = izhod < 0.18 ? "ZAS" : "SLO";
    const zac = Math.max(prihod + 60, odhod - 200 - Math.round(r() * 60));
    if (stat(koda)) zigi.push({ cas: zac, smer: "odhod", id_statistike: stat(koda), vir }, { cas: zac + 40 + Math.round(r() * 70), smer: "prihod", id_statistike: delovna, vir });
  }
  zigi.push({ cas: odhod, smer: "odhod", id_statistike: null, vir }); // lahko čez polnoč (> 1440) - šteje v dan prihoda
  zigi.sort((a, b) => a.cas - b.cas);

  if (r() < 0.07) {
    zigi[zigi.length - 1] = { ...zigi[zigi.length - 1], vir: "rocno" };
    oznake.push({ tip: "popravek", besedilo: "Ročni popravek: vodja je vnesel odhod (pozabljeno štempljanje)." });
  }
  if (r() < 0.05) oznake.push({ tip: "komentar", besedilo: "Komentar zaposlenega: zamuda zaradi zastoja na avtocesti." });

  // danes: samo žigi do zdaj
  const vidni = datum === danes ? zigi.filter((z) => z.cas <= zdajMin) : zigi;
  return { zigi: vidni, odsotnost: null, oznake: datum === danes && !vidni.length ? [] : oznake };
}
