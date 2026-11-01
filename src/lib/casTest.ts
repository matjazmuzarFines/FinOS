import { danVTednu, izCasa, stTedna, type DanPodatki, type Oznaka, type Zig } from "./cas";
import { imePraznika, PRAVILA_DEJANSKO, urnikZaposlenega, type CasNastavitve, type Interval } from "./casNastavitve";

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
const PRIVZETI: Interval = { ...PRAVILA_DEJANSKO, id: 0, ime: "PRIVZETO", prikazno_ime: "Prihod", opis: "", vrsta: "prihod", cas_od: "06:00", cas_do: "09:00", dnevi: [], id_statistike: null, id_tipke: null, visible: true };

/** Intervali urnika zaposlenega, ki veljajo na datum. */
function intervaliNaDan(idZaposlenega: number, datum: string, n: CasNastavitve): Interval[] {
  const urnik = testniUrnik(idZaposlenega, n);
  if (!urnik) return [];
  const idDneva = imePraznika(datum, n) ? n.dnevi.find((d) => d.iso == null)?.id : n.dnevi.find((d) => d.iso === danVTednu(datum))?.id;
  return n.intervali.filter((x) => x.visible && urnik.intervali.includes(x.id) && idDneva != null && x.dnevi.includes(idDneva));
}

/** Interval prihoda, ki velja na datum (pri dveh izmenah se izmenjujeta po tednih). */
export function intervalNaDan(idZaposlenega: number, datum: string, n: CasNastavitve): Interval | null {
  if (!testniUrnik(idZaposlenega, n)) return danVTednu(datum) <= 5 && !imePraznika(datum, n) ? PRIVZETI : null;
  const kandidati = intervaliNaDan(idZaposlenega, datum, n).filter((x) => x.vrsta === "prihod");
  if (!kandidati.length) return null;
  // več intervalov na dan (npr. dve izmeni) se menja po tednih
  return kandidati[(stTedna(datum) + idZaposlenega) % kandidati.length];
}

/** Čas v oknu intervala (od + delež dolžine okna); okno čez polnoč se nadaljuje čez 1440. */
const vOknuTest = (iv: Interval, delez: number) => {
  const od = izCasa(iv.cas_od);
  return od + Math.round(((izCasa(iv.cas_do) - od + 1440) % 1440) * delez);
};

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

  const zigi: Omit<Zig, "id">[] = [];
  const oznake: Oznaka[] = [];
  const dne = intervaliNaDan(idZaposlenega, datum, n);
  const tipkaNa = (mesto: "krmilnik" | "fin_me", samo = false) =>
    dne.filter((t) => {
      const p = n.tipke.find((x) => x.id === t.id_tipke)?.prikaz ?? [];
      return t.vrsta === "tipka" && p.includes(mesto) && (!samo || p.length === 1);
    });
  // delo od doma = tipka samo v FIN:ME ob prihodu
  const doma = tipkaNa("fin_me", true)[0];
  const domov = !prost && x < 0.16 && !!doma;
  const vir = domov ? "online" : "krmilnik";
  // prihod v zadnjih 2 h okna (okno 00:00-06:30 = prihodi med 4:30 in 6:30)
  let prihod = od + okno - Math.round(r() * Math.min(okno, 120));
  if (r() < 0.04) prihod = od + okno + 5 + Math.round(r() * 40); // zamuda - prihod izven okna (napaka)
  let odhod = prihod + DELOVNIK + Math.round(r() * 30 - 5);
  // okno izhoda (npr. po 14:30): večinoma v oknu, redko prej (napaka)
  const izhodIv = dne.find((x) => x.vrsta === "izhod");
  if (izhodIv) {
    const izhodOd = izCasa(izhodIv.cas_od) + (izCasa(izhodIv.cas_od) < od ? 1440 : 0);
    if (odhod < izhodOd && r() > 0.05) odhod = izhodOd + Math.round(r() * 45);
  }
  if (!domov && r() < 0.07) odhod = prihod + 12 * 60 + Math.round(r() * 40); // dolg dan -> 2 malici
  // žig nima smeri (določi jo knjiženje); tipka da interval (odmor, poslovni, privatni ...)
  zigi.push({ cas: prihod, id_tipke: domov ? doma.id_tipke : null, vir });

  const krmilnik = domov ? [] : tipkaNa("krmilnik");
  // odmor (tipka s seštetim trajanjem): v oknu, včasih predolg (prekoračitev) ali izven okna (napaka)
  const odmor = krmilnik.find((t) => t.trajanje_max != null);
  if (odmor && r() < 0.6) {
    const ozko = (izCasa(odmor.cas_do) - izCasa(odmor.cas_od) + 1440) % 1440 < 180;
    let m = ozko ? vOknuTest(odmor, r() * 0.2) : prihod + 180 + Math.round(r() * 60);
    if (r() < 0.04) m -= 30; // odšel prezgodaj - izven okna
    const trajanje = (odmor.trajanje_max ?? 30) - 8 + Math.round(r() * (r() < 0.15 ? 25 : 10));
    zigi.push({ cas: m, id_tipke: odmor.id_tipke, vir }, { cas: m + trajanje, id_tipke: null, vir });
  }
  // poslovni ali privatni izhod
  const ostali = krmilnik.filter((t) => t.trajanje_max == null);
  if (ostali.length && r() < 0.3) {
    const t = ostali[Math.floor(r() * ostali.length)];
    const zac = Math.max(prihod + 60, odhod - 200 - Math.round(r() * 60));
    zigi.push({ cas: zac, id_tipke: t.id_tipke, vir }, { cas: zac + 40 + Math.round(r() * 70), id_tipke: null, vir });
  }
  zigi.push({ cas: odhod, id_tipke: null, vir }); // lahko čez polnoč (> 1440) - šteje v dan prihoda
  zigi.sort((a, b) => a.cas - b.cas);

  if (r() < 0.07) {
    zigi[zigi.length - 1] = { ...zigi[zigi.length - 1], vir: "rocno" };
    oznake.push({ tip: "popravek", besedilo: "Ročni popravek: vodja je vnesel odhod (pozabljeno štempljanje)." });
  }
  if (r() < 0.05) oznake.push({ tip: "komentar", besedilo: "Komentar zaposlenega: zamuda zaradi zastoja na avtocesti." });

  // danes: samo žigi do zdaj
  // id je stalen (oseba, dan, zaporedje) - spregled ostane pri istem dogodku
  const zId = zigi.map((z, i): Zig => ({ ...z, id: `test|${idZaposlenega}|${datum}|${i}` }));
  const vidni = datum === danes ? zId.filter((z) => z.cas <= zdajMin) : zId;
  return { zigi: vidni, odsotnost: null, oznake: datum === danes && !vidni.length ? [] : oznake };
}
